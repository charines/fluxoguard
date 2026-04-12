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
    cnpj_cpf = Column(String(20), unique=True, nullable=True) # Mantendo legibilidade, mas agora documento é o foco
    documento = Column(String(18), unique=True, index=True, nullable=True)
    password = Column(String(50), nullable=True)
    password_updated = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Relationships
    transactions = relationship("Transaction", back_populates="parceiro")
    auth_tokens = relationship("AuthToken", back_populates="user")

class TransactionItem(Base):
    __tablename__ = "transaction_items"
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"))
    nome_cliente = Column(String(255), nullable=False)
    valor = Column(Float, nullable=False)
    data_emissao = Column(String(10), nullable=True)  # YYYY-MM-DD
    
    transaction = relationship("Transaction", back_populates="items")

class EmailTemplate(Base):
    __tablename__ = "email_templates"
    id = Column(Integer, primary_key=True, index=True)
    status = Column(String(50), unique=True, index=True) # AGUARDANDO_NOTA, PAGO, FINALIZADO, etc
    subject = Column(String(255), nullable=False)
    body = Column(String(5000), nullable=False)

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    parceiro_id = Column(Integer, ForeignKey("users.id"))
    ano = Column(Integer, nullable=True)
    mes = Column(Integer, nullable=True)
    dia = Column(Integer, nullable=True)
    nome_cliente = Column(String(255), nullable=True)
    valor_liberado = Column(Float, default=0.0)
    valor_ajustado = Column(Float, default=0.0)
    status = Column(
        Enum(
            "PENDENTE",
            "LIBERADO",
            "AGUARDANDO_NF",
            "AGUARDANDO_APROVACAO",
            "DIVERGENCIA",
            "CONFERENCIA",
            "PAGO",
            "FINALIZADO",
            "ARQUIVADO",
            name="transaction_status",
        ),
        default="PENDENTE",
    )
    hash_link = Column(String(255), unique=True)
    comprovantes_json = Column(String(5000), nullable=True)
    notas_fiscais_json = Column(String(5000), nullable=True)
    zip_contabilidade_url = Column(String(1024), nullable=True)
    data_criacao = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    parceiro = relationship("User", back_populates="transactions")
    items = relationship("TransactionItem", back_populates="transaction", cascade="all, delete-orphan")

class AuthToken(Base):
    __tablename__ = "auth_tokens"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    token = Column(String(255), unique=True, index=True)
    expires_at = Column(DateTime)

    # Relationships
    user = relationship("User", back_populates="auth_tokens")

class NotaFiscal(Base):
    __tablename__ = "notas_fiscais_supabase"
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(Integer, ForeignKey("transactions.id"))
    path = Column(String(500), nullable=False)
    data_upload = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Optional: Relationship with Transaction
    transaction = relationship("Transaction")
