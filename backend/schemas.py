from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum

# Enums matching models.py
class UserType(str, Enum):
    ADMIN = "ADMIN"
    PARCEIRO = "PARCEIRO"

class TransactionStatus(str, Enum):
    PENDENTE = "PENDENTE"
    AGUARDANDO_NF = "AGUARDANDO_NF"
    PAGO = "PAGO"
    ARQUIVADO = "ARQUIVADO"

# User Schemas
class UserBase(BaseModel):
    nome: str
    email: EmailStr
    tipo: UserType = UserType.PARCEIRO
    cnpj_cpf: str

class UserCreate(UserBase):
    pass

class UserResponse(UserBase):
    id: int

    class Config:
        from_attributes = True

# Transaction Schemas
class TransactionBase(BaseModel):
    parceiro_id: int
    valor_liberado: float = 0.0
    valor_ajustado: float = 0.0
    status: TransactionStatus = TransactionStatus.PENDENTE
    hash_link: Optional[str] = None

class TransactionCreate(TransactionBase):
    pass

class TransactionResponse(TransactionBase):
    id: int
    data_criacao: datetime

    class Config:
        from_attributes = True
