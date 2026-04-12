import os
import json
import zipfile
import io
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File, Form, Query, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional

from database import engine, Base, get_db
from models import User, Transaction, AuthToken, NotaFiscal
import schemas
import hashlib
from Crypto.Cipher import AES
from base64 import b64decode
import string
import random

from contextlib import asynccontextmanager

MAGIC_SECRET = os.getenv("VITE_MAGIC_LINK_SECRET", "fluxoguard_secure_key_2026")


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        print("Banco de dados inicializado com sucesso!")
    except Exception as e:
        print(f"Erro ao conectar no banco: {e}")
    yield


app = FastAPI(title="FluxoGuard API", lifespan=lifespan)
UPLOADS_DIR = Path(__file__).resolve().parent / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
ZIPS_DIR = UPLOADS_DIR / "zips"
ZIPS_DIR.mkdir(parents=True, exist_ok=True)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5175")

origins = [
    FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:5175",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5175",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def generate_dynamic_password() -> str:
    """Gera senha de 8 caracteres no formato: abc-1a23 (Padrão sugerido)."""
    letters = string.ascii_lowercase
    digits = string.digits

    p1 = "".join(random.choices(letters, k=3))
    p2 = random.choice(digits)
    p3 = random.choice(letters)
    p4 = "".join(random.choices(digits, k=2))
    return f"{p1}-{p2}{p3}{p4}"


@app.get("/")
async def root():
    return {"message": "FluxoGuard API is running"}


def decrypt_cryptojs_aes(encrypted_b64, passphrase):
    try:
        data = b64decode(encrypted_b64)
        if not data.startswith(b'Salted__'):
            return None
        salt = data[8:16]
        encrypted_data = data[16:]
        
        # EVP_BytesToKey derivation logic (compatible with crypto-js)
        dk = b''
        prev = b''
        while len(dk) < 48: # AES-256 Key (32) + IV (16)
            prev = hashlib.md5(prev + passphrase.encode() + salt).digest()
            dk += prev
        key = dk[:32]
        iv = dk[32:48]
        
        cipher = AES.new(key, AES.MODE_CBC, iv)
        decrypted = cipher.decrypt(encrypted_data)
        # PKCS7 Unpadding
        pad_len = decrypted[-1]
        if pad_len < 1 or pad_len > 16:
            return None
        return decrypted[:-pad_len].decode('utf-8')
    except Exception:
        return None


@app.get("/api/shares/{transaction_id}")
async def get_secure_share(
    transaction_id: int,
    x_magic_token: Optional[str] = Header(default=None),
    token_query: Optional[str] = Query(default=None, alias="token"),
    db: Session = Depends(get_db)
):
    token = x_magic_token or token_query
    if not token:
        raise HTTPException(status_code=401, detail="Token de acesso ausente")

    decrypted = decrypt_cryptojs_aes(token, MAGIC_SECRET)
    if not decrypted:
        raise HTTPException(status_code=401, detail="Token inválido")

    try:
        payload = json.loads(decrypted)
    except Exception:
        raise HTTPException(status_code=401, detail="Payload do token corrompido")

    # Validar campos do payload
    # No frontend definimos como 'id', 'email' e 'extExp'
    link_tx_id = payload.get("id")
    link_email = payload.get("email")
    ext_exp = payload.get("extExp")

    if link_tx_id != transaction_id:
        raise HTTPException(status_code=403, detail="ID da transação não corresponde ao token")

    if ext_exp and datetime.now(timezone.utc).timestamp() * 1000 > ext_exp:
        raise HTTPException(status_code=403, detail="Link de acesso expirado")

    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Repasse não encontrado")

    # Opcional: Validar se o parceiro do repasse é o mesmo do token
    if tx.parceiro.email != link_email and tx.parceiro.cnpj_cpf != link_email:
         # Email or CNPJ mismatch
         pass

    # Preparar resposta de perfil para auto-login se necessário
    # Buscamos o parceiro no banco
    parceiro = tx.parceiro
    user_profile = {
        "id": parceiro.id,
        "nome": parceiro.nome,
        "email": parceiro.email,
        "tipo": parceiro.tipo,
        "cnpj_cpf": parceiro.cnpj_cpf,
        "is_active": parceiro.is_active
    }

    # Serializar transação (incluindo links se status permitir)
    data = serialize_transaction(tx, current_user=parceiro)
    data["user_profile"] = user_profile
    return data


@app.get("/health")
async def health_check():
    return {"status": "ok"}


def extract_token_from_header(authorization: Optional[str]) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Header Authorization ausente")

    token_value = authorization.strip()
    if token_value.lower().startswith("bearer "):
        token_value = token_value[7:].strip()

    if not token_value:
        raise HTTPException(status_code=401, detail="Token inválido")
    return token_value


def resolve_user_from_token(token_value: str, db: Session) -> User:
    auth_token = db.query(AuthToken).filter(AuthToken.token == token_value).first()
    if not auth_token:
        raise HTTPException(status_code=401, detail="Token não encontrado")

    if auth_token.expires_at:
        expires_at = auth_token.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Token expirado")

    user = db.query(User).filter(User.id == auth_token.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return user


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    token_value = extract_token_from_header(authorization)
    return resolve_user_from_token(token_value, db)


def get_current_manager(current_user: User = Depends(get_current_user)) -> User:
    if current_user.tipo not in ["ADMIN", "SUPERADMIN"]:
        raise HTTPException(status_code=403, detail="Acesso restrito a ADMIN/SUPERADMIN")
    return current_user

def get_current_partner(current_user: User = Depends(get_current_user)) -> User:
    if current_user.tipo != "PARCEIRO":
        raise HTTPException(status_code=403, detail="Acesso restrito a PARCEIRO")
    return current_user


def get_current_superadmin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.tipo != "SUPERADMIN":
        raise HTTPException(status_code=403, detail="Acesso restrito a SUPERADMIN")
    return current_user


def can_create_user(actor: User, target_type: str) -> bool:
    if actor.tipo == "SUPERADMIN":
        return target_type in ["SUPERADMIN", "ADMIN", "PARCEIRO"]
    if actor.tipo == "ADMIN":
        return target_type in ["ADMIN", "PARCEIRO"]
    return False


def can_toggle_user(actor: User, target: User) -> bool:
    if actor.tipo == "SUPERADMIN":
        return target.tipo in ["ADMIN", "PARCEIRO"]
    if actor.tipo == "ADMIN":
        return target.tipo == "PARCEIRO"
    return False

def can_edit_user(actor: User, target: User) -> bool:
    if actor.id == target.id and actor.tipo in ["ADMIN", "SUPERADMIN"]:
        return True
    if actor.tipo == "SUPERADMIN":
        return True # Superadmin pode editar todos
    if actor.tipo == "ADMIN":
        return target.tipo == "PARCEIRO"
    return False

def parse_json_array(raw_value: Optional[str]) -> List[str]:
    if not raw_value:
        return []
    try:
        parsed = json.loads(raw_value)
        if isinstance(parsed, list):
            return [str(item) for item in parsed]
    except Exception:
        return []
    return []

from supabase_service import upload_file_to_supabase, gerar_link_signed, delete_file_from_supabase, download_file_from_supabase, upload_bytes_to_supabase

async def save_upload_files_supabase(files: List[UploadFile], subfolder: str) -> List[str]:
    saved_paths: List[str] = []
    for file in files:
        if not file.filename:
            continue
        path = await upload_file_to_supabase(file, subfolder)
        saved_paths.append(path)
    return saved_paths

def is_manager(user: Optional[User]) -> bool:
    return bool(user and user.tipo in ["ADMIN", "SUPERADMIN"])

def is_locked_transaction(tx: Transaction) -> bool:
    return tx.status in ["FINALIZADO"]

def serialize_transaction(tx: Transaction, current_user: Optional[User] = None) -> dict:
    comprovantes = parse_json_array(tx.comprovantes_json)
    notas_fiscais = parse_json_array(tx.notas_fiscais_json)
    zip_url = tx.zip_contabilidade_url

    if tx.status == "FINALIZADO":
        # After accounting closure, individual files are hidden. Finance uses ZIP.
        comprovantes = []
        notas_fiscais = []
        if not is_manager(current_user):
            zip_url = None

    return {
        "id": tx.id,
        "user_id": tx.parceiro_id,
        "parceiro_id": tx.parceiro_id,
        "parceiro_nome": tx.parceiro.nome if tx.parceiro else None,
        "parceiro_email": tx.parceiro.email if tx.parceiro else None,
        "ano": tx.ano,
        "mes": tx.mes,
        "dia": tx.dia,
        "nome_cliente": tx.nome_cliente,
        "valor_liberado": tx.valor_liberado,
        "valor_ajustado": tx.valor_ajustado,
        "status": tx.status,
        "comprovantes": comprovantes,
        "notas_fiscais": notas_fiscais,
        "zip_contabilidade_url": zip_url,
        "data_criacao": tx.data_criacao.isoformat() if tx.data_criacao else None,
    }


def build_zip_for_transactions(transactions: List[Transaction]) -> str:
    if not transactions:
        raise HTTPException(status_code=400, detail="Nenhum repasse selecionado para gerar ZIP")

    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        for tx in transactions:
            comp_paths = parse_json_array(tx.comprovantes_json)
            nf_paths = parse_json_array(tx.notas_fiscais_json)
            all_paths = comp_paths + nf_paths
            
            for rel_path in all_paths:
                file_content = download_file_from_supabase(rel_path)
                
                if file_content:
                    filename = os.path.basename(rel_path)
                    folder = os.path.dirname(rel_path)
                    arcname = f"tx_{tx.id}/{folder}_{filename}"
                    zip_file.writestr(arcname, file_content)

    # Get bytes from buffer
    zip_data = zip_buffer.getvalue()
    zip_buffer.close()
    
    # Upload to Supabase
    zip_filename = f"contabilidade_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid4().hex[:8]}.zip"
    supabase_path = upload_bytes_to_supabase(zip_data, zip_filename, "zips")

    return supabase_path


def find_transaction_by_file_path(db: Session, relative_path: str) -> Optional[Transaction]:
    rows = db.query(Transaction).all()
    for tx in rows:
        if relative_path in parse_json_array(tx.comprovantes_json):
            return tx
        if relative_path in parse_json_array(tx.notas_fiscais_json):
            return tx
        if tx.zip_contabilidade_url == relative_path:
            return tx
    return None


def normalize_money(value: Decimal) -> float:
    """Normalize monetary input to 2 decimal places before persisting."""
    try:
        normalized = value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, AttributeError):
        raise HTTPException(status_code=422, detail="valor_liberado inválido")
    return float(normalized)


def find_user_for_login(identifier: str, db: Session) -> User:
    print(f"[AUTH] Buscando usuário para ID: '{identifier}'")
    user_by_email = db.query(User).filter(User.email == identifier).first()
    if user_by_email:
        print(f"[AUTH] Encontrado por e-mail: {user_by_email.email} (Tipo: {user_by_email.tipo})")
        if user_by_email.tipo == "PARCEIRO":
            print(f"[AUTH ERROR] Bloqueio: PARCEIRO tentando logar com e-mail.")
            raise HTTPException(status_code=401, detail="Parceiros devem logar utilizando o Documento (CPF/CNPJ).")
        return user_by_email

    user_by_cnpj = db.query(User).filter(User.cnpj_cpf == identifier).first()
    if user_by_cnpj:
        print(f"[AUTH] Encontrado por CNPJ: {user_by_cnpj.cnpj_cpf} (Tipo: {user_by_cnpj.tipo})")
        if user_by_cnpj.tipo in ["ADMIN", "SUPERADMIN"]:
            print(f"[AUTH ERROR] Bloqueio: ADMIN/SUPERADMIN tentando logar com CNPJ.")
            raise HTTPException(status_code=401, detail="Administradores devem logar utilizando o E-mail.")
        return user_by_cnpj

    print(f"[AUTH ERROR] Usuário não localizado para: '{identifier}'")
    raise HTTPException(status_code=401, detail="Usuário não encontrado")


@app.post("/auth/login", response_model=schemas.LoginResponse)
def login(payload: schemas.UnifiedLoginRequest, db: Session = Depends(get_db)):
    user = find_user_for_login(payload.identifier.strip(), db)

    # Verifica se a senha enviada coincide com a armazenada (ignorando hifens para resiliência UI)
    sent_code = payload.code.strip().replace("-", "")
    stored_code = user.password.strip().replace("-", "")
    
    if sent_code != stored_code:
        print(f"[AUTH ERROR] Código inválido fornecido para: {user.email}")
        raise HTTPException(status_code=401, detail="Código de acesso inválido")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Acesso negado. Usuário inativo.")

    token = AuthToken(
        user_id=user.id,
        token=str(uuid4()),
        expires_at=datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=15),
    )
    db.add(token)
    db.commit()
    db.refresh(token)

    return {
        "access_token": token.token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "nome": user.nome,
            "email": user.email,
            "tipo": user.tipo,
            "cnpj_cpf": user.cnpj_cpf,
            "documento": user.documento,
            "is_active": user.is_active,
            "password_updated": user.password_updated,
        },
    }

@app.post("/auth/magic-login", response_model=schemas.LoginResponse)
def magic_login(payload: schemas.MagicLoginRequest, db: Session = Depends(get_db)):
    """Realiza login automático via token de acesso seguro (Magic Link)."""
    decrypted = decrypt_cryptojs_aes(payload.token, MAGIC_SECRET)
    if not decrypted:
        raise HTTPException(status_code=401, detail="Token de acesso inválido ou expirado")

    try:
        data = json.loads(decrypted)
        email = data.get("email")
        ext_exp = data.get("extExp")
        
        if not email:
            raise HTTPException(status_code=401, detail="Email ausente no token")
            
        if ext_exp and datetime.now(timezone.utc).timestamp() * 1000 > ext_exp:
            raise HTTPException(status_code=401, detail="Link de acesso expirado")

        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="Usuário não cadastrado para este acesso")
            
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Sua conta está inativa")

        # Gerar Sessão JWT Real
        db_token = AuthToken(
            user_id=user.id,
            token=str(uuid4()),
            expires_at=datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=1),
        )
        db.add(db_token)
        db.commit()
        db.refresh(db_token)

        return {
            "access_token": db_token.token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "nome": user.nome,
                "email": user.email,
                "tipo": user.tipo,
                "cnpj_cpf": user.cnpj_cpf,
                "documento": user.documento,
                "is_active": user.is_active,
                "password_updated": user.password_updated
            }
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Erro no magic_login: {e}")
        raise HTTPException(status_code=401, detail="Falha ao processar acesso seguro")


@app.get("/auth/me")
def auth_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "nome": current_user.nome,
        "email": current_user.email,
        "tipo": current_user.tipo,
        "cnpj_cpf": current_user.cnpj_cpf,
        "telefone": current_user.telefone,
        "is_active": current_user.is_active,
    }


@app.post("/users", response_model=schemas.UserResponse)
def create_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager),
):
    if not can_create_user(current_user, user.tipo):
        raise HTTPException(status_code=403, detail="Sem permissão para criar este tipo de usuário")

    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    db_doc = db.query(User).filter(User.cnpj_cpf == user.cnpj_cpf).first()
    if db_doc:
        raise HTTPException(status_code=400, detail="Documento já cadastrado")

    new_user = User(
        nome=user.nome,
        email=user.email,
        telefone=user.telefone,
        tipo=user.tipo,
        cnpj_cpf=user.cnpj_cpf,
        password=generate_dynamic_password(),
        is_active=user.is_active,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@app.post("/admin/register", response_model=schemas.UserResponse)
def register_admin(
    payload: schemas.AdminRegisterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager),
):
    if not can_create_user(current_user, payload.tipo):
        raise HTTPException(status_code=403, detail="Sem permissão para criar este tipo de usuário")

    db_user = db.query(User).filter(User.email == payload.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email já cadastrado")

    db_doc = db.query(User).filter(User.cnpj_cpf == payload.documento_cnpj_cpf).first()
    if db_doc:
        raise HTTPException(status_code=400, detail="Documento já cadastrado")

    new_user = User(
        nome=payload.nome,
        email=payload.email,
        telefone=payload.telefone,
        tipo=payload.tipo,
        cnpj_cpf=payload.documento_cnpj_cpf,
        password=generate_dynamic_password(),
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user
def post_registration_tasks(user_id: int):
    """
    Simula processos secundários que rodam em background.
    Ex: Criar pastas no Supabase, enviar email de boas-vindas, registrar logs externos.
    """
    print(f"[JOB] Executando tarefas pós-cadastro para usuário {user_id}")
    # Aqui entraria a lógica de 'criar pastas no Supabase' se fosse necessário
    pass

@app.get("/users/check-availability")
def check_availability(
    email: Optional[str] = None,
    documento: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if email:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            return {"available": False, "reason": "E-mail já cadastrado"}
    
    if documento:
        # Check both documento and legacy cnpj_cpf fields
        existing = db.query(User).filter(
            (User.documento == documento) | (User.cnpj_cpf == documento)
        ).first()
        if existing:
            return {"available": False, "reason": "DOCUMENTO_DUPLICADO"}
            
    return {"available": True}

@app.post("/users/register", response_model=schemas.UserResponse, status_code=201)
async def register_user_job(
    payload: schemas.RegisterUserRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # RBAC: Role-Based Access Control
    if current_user.tipo == "PARCEIRO":
        raise HTTPException(status_code=403, detail="Acesso negado. Parceiros não podem criar novos usuários.")

    if payload.tipo in ["ADMIN", "SUPERADMIN"] and current_user.tipo != "SUPERADMIN":
        raise HTTPException(status_code=403, detail="Acesso Negado. Apenas Super-Administradores podem promover novos gestores.")

    # Verificação de duplicidade de E-mail
    existing_email = db.query(User).filter(User.email == payload.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Ops! Este e-mail já faz parte da nossa base. Tente recuperar a senha ou use outro e-mail.")

    # Verificação de duplicidade de Documento
    if payload.documento:
        existing_doc = db.query(User).filter(
            (User.documento == payload.documento) | (User.cnpj_cpf == payload.documento)
        ).first()
        if existing_doc:
            raise HTTPException(status_code=400, detail="Ops! Este CPF/CNPJ já cadastrado com outro usuário.")

    if payload.tipo == "PARCEIRO" and not payload.documento:
         raise HTTPException(status_code=422, detail="O campo Documento (CPF/CNPJ) é obrigatório para o perfil de Parceiro.")

    # Geração de senha automática
    generated_password = generate_dynamic_password()
    
    # Persistência atômica no MySQL
    new_user = User(
        nome=payload.nome,
        email=payload.email,
        telefone=payload.telefone,
        tipo=payload.tipo,
        documento=payload.documento,
        cnpj_cpf=payload.documento, # Sincronizando para compatibilidade legada
        password=generated_password,
        password_updated=False,
        is_active=True
    )
    
    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except Exception as e:
        db.rollback()
        print(f"Erro ao salvar usuário: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao salvar dados. Tente novamente.")

    # Agenda tarefas secundárias para o background
    background_tasks.add_task(post_registration_tasks, new_user.id)

    # Resposta garantida e imediata com a senha plana (exibida apenas uma vez no onboarding)
    return new_user

@app.patch("/users/{user_id}/active", response_model=schemas.UserResponse)
def update_user_active_status(
    user_id: int,
    payload: schemas.UserStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager),
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if not can_toggle_user(current_user, target_user):
        raise HTTPException(status_code=403, detail="Sem permissão para alterar este usuário")

    target_user.is_active = payload.is_active
    db.commit()
    db.refresh(target_user)
    return target_user

@app.patch("/users/{user_id}", response_model=schemas.UserResponse)
def update_user(
    user_id: int,
    payload: schemas.UserUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager),
):
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if not can_edit_user(current_user, target_user):
        raise HTTPException(status_code=403, detail="Sem permissão para editar este usuário")

    if payload.email and payload.email != target_user.email:
        existing_email = db.query(User).filter(User.email == payload.email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email já cadastrado")
        target_user.email = payload.email

    if payload.cnpj_cpf and payload.cnpj_cpf != target_user.cnpj_cpf:
        existing_doc = db.query(User).filter(User.cnpj_cpf == payload.cnpj_cpf).first()
        if existing_doc:
            raise HTTPException(status_code=400, detail="Documento já cadastrado")
        target_user.cnpj_cpf = payload.cnpj_cpf

    if payload.nome is not None:
        target_user.nome = payload.nome

    if payload.telefone is not None:
        target_user.telefone = payload.telefone

    if payload.password is not None and payload.password.strip() != "":
        target_user.password = payload.password.strip()

    db.commit()
    db.refresh(target_user)
    return target_user


@app.get("/users", response_model=List[schemas.UserResponse])
def list_users(
    tipo: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_manager),
):
    query = db.query(User)
    if tipo:
        query = query.filter(User.tipo == tipo)
    return query.all()

@app.get("/transactions")
def list_transactions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.tipo in ["ADMIN", "SUPERADMIN"]:
        query = db.query(Transaction)
    elif current_user.tipo == "PARCEIRO":
        query = db.query(Transaction).filter(
            Transaction.parceiro_id == current_user.id,
            Transaction.status != "ARQUIVADO",
        )
    else:
        raise HTTPException(status_code=403, detail="Sem permissão para listar repasses")

    rows = query.order_by(Transaction.data_criacao.desc()).all()
    return [serialize_transaction(item, current_user) for item in rows]

@app.get("/download/{file_path:path}")
def download_file(
    file_path: str,
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
    x_magic_token: Optional[str] = Header(default=None),
):
    current_user: Optional[User] = None
    
    if authorization:
        try:
            current_user = get_current_user(authorization, db)
        except HTTPException:
            pass
            
    if not current_user and x_magic_token:
        # Tentar validar via Magic Token
        decrypted = decrypt_cryptojs_aes(x_magic_token, MAGIC_SECRET)
        if decrypted:
            try:
                payload = json.loads(decrypted)
                link_tx_id = payload.get("id")
                # Verificar se o arquivo solicitado pertence à transação do token
                tx = find_transaction_by_file_path(db, file_path)
                if tx and tx.id == link_tx_id:
                    current_user = tx.parceiro
            except Exception:
                pass

    if not current_user:
        raise HTTPException(status_code=401, detail="Autenticação necessária")

    normalized = file_path.lstrip("/").replace("\\", "/")
    if normalized.startswith("uploads/"):
        normalized = normalized[len("uploads/"):]

    if (
        not normalized.startswith("comprovantes/")
        and not normalized.startswith("notas_fiscais/")
        and not normalized.startswith("zips/")
    ):
        raise HTTPException(status_code=403, detail="Caminho de arquivo inválido")

    # First check if it's in Supabase (preferred)
    storage_path = normalized
    signed_url = gerar_link_signed(storage_path)
    if signed_url and signed_url.startswith("http"):
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url=signed_url)

    # Fallback to local (if any files remain)
    target = (UPLOADS_DIR / normalized).resolve()
    if target.exists() and target.is_file():
         return FileResponse(path=target, filename=target.name, media_type="application/pdf")
    
    raise HTTPException(status_code=404, detail="Arquivo não encontrado")


@app.post("/transactions")
async def create_transaction(
    user_id: int = Form(...),
    ano: int = Form(...),
    mes: int = Form(...),
    dia: int = Form(...),
    nome_cliente: str = Form(...),
    valor_liberado: Decimal = Form(...),
    comprovantes: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_manager),
):
    if len(comprovantes) > 5:
        raise HTTPException(status_code=400, detail="Máximo de 5 comprovantes.")

    db_parceiro = db.query(User).filter(User.id == user_id, User.tipo == "PARCEIRO").first()
    if not db_parceiro:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")

    valor_liberado_value = normalize_money(valor_liberado)
    comprovantes_paths = await save_upload_files_supabase(comprovantes, "comprovantes")
    new_transaction = Transaction(
        parceiro_id=user_id,
        ano=ano,
        mes=mes,
        dia=dia,
        nome_cliente=nome_cliente,
        valor_liberado=valor_liberado_value,
        valor_ajustado=valor_liberado_value,
        status="PAGO" if len(comprovantes_paths) > 0 else "AGUARDANDO_NF",
        comprovantes_json=json.dumps(comprovantes_paths),
    )
    db.add(new_transaction)
    db.commit()
    db.refresh(new_transaction)
    return serialize_transaction(new_transaction)

@app.patch("/transactions/{transaction_id}")
async def update_transaction(
    transaction_id: int,
    ano: Optional[int] = Form(default=None),
    mes: Optional[int] = Form(default=None),
    dia: Optional[int] = Form(default=None),
    nome_cliente: Optional[str] = Form(default=None),
    valor_liberado: Optional[Decimal] = Form(default=None),
    comprovantes: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_manager),
):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Repasse não encontrado")
    if is_locked_transaction(tx):
        raise HTTPException(status_code=400, detail="Repasse bloqueado para edição neste status")

    existing_files = parse_json_array(tx.comprovantes_json)
    if len(existing_files) + len(comprovantes) > 5:
        raise HTTPException(status_code=400, detail="Limite total de 5 comprovantes excedido.")

    if len(comprovantes) > 0:
        new_paths = await save_upload_files_supabase(comprovantes, "comprovantes")
        tx.comprovantes_json = json.dumps(existing_files + new_paths)
        if tx.status not in ["FINALIZADO"]:
            tx.status = "PAGO"

    if ano is not None:
        tx.ano = ano
    if mes is not None:
        tx.mes = mes
    if dia is not None:
        tx.dia = dia
    if nome_cliente is not None:
        tx.nome_cliente = nome_cliente
    if valor_liberado is not None:
        valor_liberado_value = normalize_money(valor_liberado)
        tx.valor_liberado = valor_liberado_value
        tx.valor_ajustado = valor_liberado_value

    db.commit()
    db.refresh(tx)
    return serialize_transaction(tx, _)

@app.get("/my-transactions")
def my_transactions(
    db: Session = Depends(get_db),
    current_partner: User = Depends(get_current_partner),
):
    rows = (
        db.query(Transaction)
        .filter(
            Transaction.parceiro_id == current_partner.id,
            Transaction.status != "ARQUIVADO",
        )
        .order_by(Transaction.data_criacao.desc())
        .all()
    )
    return [serialize_transaction(item, current_partner) for item in rows]

@app.patch("/transactions/{transaction_id}/upload-nf")
async def upload_nf(
    transaction_id: int,
    notas_fiscais: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    authorization: Optional[str] = Header(default=None),
    x_magic_token: Optional[str] = Header(default=None),
):
    current_partner: Optional[User] = None

    if authorization:
        try:
            user = get_current_user(authorization, db)
            if user.tipo == "PARCEIRO":
                current_partner = user
        except HTTPException:
            pass

    if not current_partner and x_magic_token:
        # Tentar validar via Magic Token para upload
        decrypted = decrypt_cryptojs_aes(x_magic_token, MAGIC_SECRET)
        if decrypted:
            try:
                payload = json.loads(decrypted)
                link_tx_id = payload.get("id")
                if link_tx_id == transaction_id:
                    tx_check = db.query(Transaction).filter(Transaction.id == transaction_id).first()
                    if tx_check:
                        current_partner = tx_check.parceiro
            except Exception:
                pass

    if not current_partner:
        raise HTTPException(status_code=401, detail="Acesso restrito ao parceiro proprietário")

    if len(notas_fiscais) == 0:
        raise HTTPException(status_code=400, detail="Envie ao menos 1 arquivo.")
    if len(notas_fiscais) > 5:
        raise HTTPException(status_code=400, detail="Máximo de 5 notas fiscais.")

    for item in notas_fiscais:
        if not (item.filename or "").lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Apenas arquivos PDF são aceitos.")

    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Repasse não encontrado")
    if tx.parceiro_id != current_partner.id:
        raise HTTPException(status_code=403, detail="Sem permissão para este repasse")
    if tx.status in ["PAGO", "FINALIZADO"]:
        raise HTTPException(status_code=400, detail="Repasse fechado para envio de NF")
    if tx.status not in ["LIBERADO", "AGUARDANDO_NF", "DIVERGENCIA", "AGUARDANDO_APROVACAO"]:
        raise HTTPException(status_code=400, detail="Status atual não permite envio de NF")

    nf_paths = await save_upload_files_supabase(notas_fiscais, "notas_fiscais")
    tx.notas_fiscais_json = json.dumps(nf_paths)
    tx.status = "AGUARDANDO_APROVACAO"
    db.commit()
    db.refresh(tx)
    return serialize_transaction(tx, current_partner)


@app.patch("/transactions/{transaction_id}/reject")
def reject_transaction(
    transaction_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager),
):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Repasse não encontrado")
    if tx.status in ["PAGO", "FINALIZADO"]:
        raise HTTPException(status_code=400, detail="Repasse já está em estágio final")
    if tx.status != "AGUARDANDO_APROVACAO":
        raise HTTPException(status_code=400, detail="Somente repasses aguardando aprovação podem ser recusados")

    tx.status = "DIVERGENCIA"
    db.commit()
    db.refresh(tx)
    return serialize_transaction(tx, current_user)


VALID_ADMIN_STATUSES = [
    "AGUARDANDO_NF",
    "AGUARDANDO_APROVACAO",
    "DIVERGENCIA",
    "PAGO",
    "FINALIZADO",
]


@app.patch("/transactions/{transaction_id}/change-status")
def change_transaction_status(
    transaction_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager),
):
    new_status = payload.get("status", "").strip().upper()
    if new_status not in VALID_ADMIN_STATUSES:
        raise HTTPException(status_code=400, detail=f"Status inválido: {new_status}")

    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Repasse não encontrado")

    tx.status = new_status
    db.commit()
    db.refresh(tx)
    return serialize_transaction(tx, current_user)


@app.patch("/transactions/batch/approve-payment")
async def approve_payment_batch(
    transaction_ids: str = Form(...),
    comprovantes: List[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager),
):
    try:
        ids = [int(item) for item in json.loads(transaction_ids)]
    except Exception:
        raise HTTPException(status_code=400, detail="transaction_ids inválido")

    if not ids:
        raise HTTPException(status_code=400, detail="Selecione ao menos um repasse")
    if len(comprovantes) == 0:
        raise HTTPException(status_code=400, detail="Envie ao menos 1 comprovante para aprovação")
    if len(comprovantes) > 5:
        raise HTTPException(status_code=400, detail="Máximo de 5 comprovantes por aprovação em massa")

    rows = db.query(Transaction).filter(Transaction.id.in_(ids)).all()
    if len(rows) != len(set(ids)):
        raise HTTPException(status_code=404, detail="Um ou mais repasses não foram encontrados")

    new_comp_paths = await save_upload_files_supabase(comprovantes, "comprovantes")
    for tx in rows:
        if tx.status not in ["AGUARDANDO_APROVACAO", "DIVERGENCIA", "AGUARDANDO_NF", "LIBERADO"]:
            raise HTTPException(status_code=400, detail=f"Repasse {tx.id} não pode ser aprovado no status atual")
        if tx.status == "FINALIZADO":
            raise HTTPException(status_code=400, detail=f"Repasse {tx.id} já foi finalizado")

        existing_comp = parse_json_array(tx.comprovantes_json)
        merged = existing_comp + new_comp_paths
        if len(merged) > 5:
            raise HTTPException(status_code=400, detail=f"Repasse {tx.id} excede o limite de 5 comprovantes")
        tx.comprovantes_json = json.dumps(merged)
        tx.status = "PAGO"

    db.commit()
    for tx in rows:
        db.refresh(tx)
    return [serialize_transaction(tx, current_user) for tx in rows]


@app.patch("/transactions/batch/finalize")
def finalize_transactions_batch(
    payload: schemas.TransactionBatchActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager),
):
    ids = list(set(payload.transaction_ids))
    if not ids:
        raise HTTPException(status_code=400, detail="Selecione ao menos um repasse para finalizar")

    rows = db.query(Transaction).filter(Transaction.id.in_(ids)).all()
    if len(rows) != len(ids):
        raise HTTPException(status_code=404, detail="Um ou mais repasses não foram encontrados")

    for tx in rows:
        if tx.status != "PAGO":
            raise HTTPException(status_code=400, detail=f"Repasse {tx.id} deve estar em PAGO para finalizar")

    zip_path = build_zip_for_transactions(rows)
    for tx in rows:
        tx.status = "FINALIZADO"
        tx.zip_contabilidade_url = zip_path

    db.commit()
    for tx in rows:
        db.refresh(tx)
    return [serialize_transaction(tx, current_user) for tx in rows]


@app.delete("/transactions/{transaction_id}/files")
def remove_transaction_file(
    transaction_id: int,
    payload: schemas.TransactionFileRemoveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_manager),
):
    tx = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Repasse não encontrado")
    if is_locked_transaction(tx):
        raise HTTPException(status_code=400, detail="Não é possível remover arquivos em repasses pagos/finalizados")

    file_type = payload.file_type.strip().upper()
    if file_type not in ["NF", "COMPROVANTE"]:
        raise HTTPException(status_code=400, detail="file_type deve ser NF ou COMPROVANTE")

    relative_path = payload.file_path.strip().lstrip("/")
    if file_type == "NF":
        files = parse_json_array(tx.notas_fiscais_json)
    else:
        files = parse_json_array(tx.comprovantes_json)

    if relative_path not in files:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado neste repasse")

    files = [item for item in files if item != relative_path]
    if file_type == "NF":
        tx.notas_fiscais_json = json.dumps(files)
    else:
        tx.comprovantes_json = json.dumps(files)

    # Delete from Supabase
    delete_file_from_supabase(relative_path)

    db.commit()
    db.refresh(tx)
    return serialize_transaction(tx, current_user)
