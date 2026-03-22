from sqlalchemy import Column, Integer, String, Float, Enum, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from database import Base
import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    telefone = Column(String(30), nullable=True)
    tipo = Column(Enum("SUPERADMIN", "ADMIN", "PARCEIRO", name="user_type"), default="PARCEIRO")
    cnpj_cpf = Column(String(20), unique=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    transactions = relationship("Transaction", back_populates="parceiro")
    auth_tokens = relationship("AuthToken", back_populates="user")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    parceiro_id = Column(Integer, ForeignKey("users.id"))
    valor_liberado = Column(Float, default=0.0)
    valor_ajustado = Column(Float, default=0.0)
    status = Column(Enum("PENDENTE", "AGUARDANDO_NF", "PAGO", "ARQUIVADO", name="transaction_status"), default="PENDENTE")
    hash_link = Column(String(255), unique=True)
    data_criacao = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    parceiro = relationship("User", back_populates="transactions")

class AuthToken(Base):
    __tablename__ = "auth_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    token = Column(String(255), unique=True, index=True)
    expires_at = Column(DateTime)

    # Relationships
    user = relationship("User", back_populates="auth_tokens")
