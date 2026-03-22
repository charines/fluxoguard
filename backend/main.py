import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import FastAPI, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional

from database import engine, Base, get_db
from models import User, Transaction, AuthToken
import schemas

from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        print("Banco de dados inicializado com sucesso!")
    except Exception as e:
        print(f"Erro ao conectar no banco: {e}")
    yield


app = FastAPI(title="FluxoGuard API", lifespan=lifespan)

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


@app.get("/")
async def root():
    return {"message": "FluxoGuard API is running"}


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
        return target.tipo in ["ADMIN", "PARCEIRO"]
    if actor.tipo == "ADMIN":
        return target.tipo == "PARCEIRO"
    return False


def find_user_for_login(identifier: str, db: Session) -> User:
    user_by_email = db.query(User).filter(User.email == identifier).first()
    if user_by_email:
        if user_by_email.tipo == "PARCEIRO":
            raise HTTPException(status_code=401, detail="PARCEIRO deve logar com CNPJ")
        return user_by_email

    user_by_cnpj = db.query(User).filter(User.cnpj_cpf == identifier).first()
    if user_by_cnpj:
        if user_by_cnpj.tipo in ["ADMIN", "SUPERADMIN"]:
            raise HTTPException(status_code=401, detail="ADMIN/SUPERADMIN devem logar com Email")
        return user_by_cnpj

    raise HTTPException(status_code=401, detail="Usuário não encontrado")


@app.post("/auth/login", response_model=schemas.LoginResponse)
def login(payload: schemas.UnifiedLoginRequest, db: Session = Depends(get_db)):
    if payload.code != "123123":
        raise HTTPException(status_code=401, detail="Código inválido")

    user = find_user_for_login(payload.identifier.strip(), db)

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
            "is_active": user.is_active,
        },
    }


@app.get("/auth/me")
def auth_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "nome": current_user.nome,
        "email": current_user.email,
        "tipo": current_user.tipo,
        "cnpj_cpf": current_user.cnpj_cpf,
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
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
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

    db.commit()
    db.refresh(target_user)
    return target_user


@app.get("/users", response_model=List[schemas.UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_manager),
):
    return db.query(User).all()


@app.post("/transactions", response_model=schemas.TransactionResponse)
def create_transaction(transaction: schemas.TransactionCreate, db: Session = Depends(get_db)):
    db_parceiro = db.query(User).filter(User.id == transaction.parceiro_id).first()
    if not db_parceiro:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")

    new_transaction = Transaction(
        parceiro_id=transaction.parceiro_id,
        valor_liberado=transaction.valor_liberado,
        valor_ajustado=transaction.valor_ajustado,
        status=transaction.status,
        hash_link=transaction.hash_link,
    )
    db.add(new_transaction)
    db.commit()
    db.refresh(new_transaction)
    return new_transaction
