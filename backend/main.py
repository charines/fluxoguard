import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from database import engine, Base, get_db
from models import User, Transaction, AuthToken
import schemas

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables on startup
    try:
        Base.metadata.create_all(bind=engine)
        print("Banco de dados inicializado com sucesso!")
    except Exception as e:
        print(f"Erro ao conectar no banco: {e}")
    yield

app = FastAPI(title="FluxoGuard API", lifespan=lifespan)

# Configure CORS
# In production, RENDER_EXTERNAL_URL could be used, or a predefined domain.
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

origins = [
    FRONTEND_URL,
    "http://localhost:5173",
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

# 1. POST /users: Criar usuário
@app.post("/users", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email já cadastrado")
    
    new_user = User(
        nome=user.nome,
        email=user.email,
        tipo=user.tipo,
        cnpj_cpf=user.cnpj_cpf
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

# 2. GET /users: Listar usuários
@app.get("/users", response_model=List[schemas.UserResponse])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).all()

# 3. POST /transactions: Registrar nova transação
@app.post("/transactions", response_model=schemas.TransactionResponse)
def create_transaction(transaction: schemas.TransactionCreate, db: Session = Depends(get_db)):
    # Validar se o parceiro existe
    db_parceiro = db.query(User).filter(User.id == transaction.parceiro_id).first()
    if not db_parceiro:
        raise HTTPException(status_code=404, detail="Parceiro não encontrado")
    
    new_transaction = Transaction(
        parceiro_id=transaction.parceiro_id,
        valor_liberado=transaction.valor_liberado,
        valor_ajustado=transaction.valor_ajustado,
        status=transaction.status,
        hash_link=transaction.hash_link
    )
    db.add(new_transaction)
    db.commit()
    db.refresh(new_transaction)
    return new_transaction
