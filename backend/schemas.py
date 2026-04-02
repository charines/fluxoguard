from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
from decimal import Decimal

# Enums matching models.py
class UserType(str, Enum):
    SUPERADMIN = "SUPERADMIN"
    ADMIN = "ADMIN"
    PARCEIRO = "PARCEIRO"

class TransactionStatus(str, Enum):
    PENDENTE = "PENDENTE"
    LIBERADO = "LIBERADO"
    AGUARDANDO_NF = "AGUARDANDO_NF"
    AGUARDANDO_APROVACAO = "AGUARDANDO_APROVACAO"
    DIVERGENCIA = "DIVERGENCIA"
    CONFERENCIA = "CONFERENCIA"
    PAGO = "PAGO"
    FINALIZADO = "FINALIZADO"
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
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    password: Optional[str] = None

    class Config:
        from_attributes = True

# Transaction Schemas
class TransactionBase(BaseModel):
    parceiro_id: int
    ano: int
    mes: int
    dia: int
    nome_cliente: str
    valor_liberado: Decimal = Field(default=Decimal("0.00"))
    valor_ajustado: Decimal = Field(default=Decimal("0.00"))
    status: TransactionStatus = TransactionStatus.PENDENTE
    hash_link: Optional[str] = None
    comprovantes: List[str] = Field(default_factory=list)
    notas_fiscais: List[str] = Field(default_factory=list)
    zip_contabilidade_url: Optional[str] = None
    parceiro_nome: Optional[str] = None

class TransactionCreate(TransactionBase):
    parceiro_id: int
    ano: int
    mes: int
    dia: int
    nome_cliente: str
    valor_liberado: Decimal

class TransactionResponse(TransactionBase):
    id: int
    data_criacao: datetime

    class Config:
        from_attributes = True


class TransactionBatchActionRequest(BaseModel):
    transaction_ids: List[int]


class TransactionFileRemoveRequest(BaseModel):
    file_type: str
    file_path: str
