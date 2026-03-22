from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum

# Enums matching models.py
class UserType(str, Enum):
    SUPERADMIN = "SUPERADMIN"
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
    telefone: Optional[str] = None
    tipo: UserType = UserType.PARCEIRO
    cnpj_cpf: str
    is_active: bool = True

class UserCreate(UserBase):
    pass

class AdminRegisterRequest(BaseModel):
    nome: str
    email: EmailStr
    telefone: str
    documento_cnpj_cpf: str
    tipo: UserType = UserType.ADMIN

class UnifiedLoginRequest(BaseModel):
    identifier: str
    code: str

class AuthUserProfile(BaseModel):
    id: int
    nome: str
    email: EmailStr
    tipo: UserType
    cnpj_cpf: str
    is_active: bool

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: AuthUserProfile

class UserStatusUpdateRequest(BaseModel):
    is_active: bool

class UserUpdateRequest(BaseModel):
    nome: Optional[str] = None
    email: Optional[EmailStr] = None
    telefone: Optional[str] = None
    cnpj_cpf: Optional[str] = None

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
