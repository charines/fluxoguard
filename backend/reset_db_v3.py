import os
from sqlalchemy import create_engine, MetaData
from sqlalchemy.orm import sessionmaker
from database import Base, SQLALCHEMY_DATABASE_URL
from models import User

print(f"Limpando o banco de dados: {SQLALCHEMY_DATABASE_URL}")

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def reset_and_seed():
    # 1. Limpar todas as tabelas (Drop e Create ou delete persistente)
    # Vamos usar drop_all e create_all para garantir que os esquemas novos (documento, etc) sejam criados corretamente
    print("Removendo tabelas antigas...")
    Base.metadata.drop_all(bind=engine)
    
    print("Criando novas tabelas...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # 2. Criar o Superuser conforme solicitado
        print("Criando superuser: charles@inmade.com.br")
        super_user = User(
            nome="charles",
            email="charles@inmade.com.br",
            password="dpj2o75",
            tipo="SUPERADMIN",
            is_active=True,
            password_updated=False,
            documento="000.000.000-00", # Placeholder para superadmin
            cnpj_cpf="000.000.000-00"
        )
        db.add(super_user)
        db.commit()
        print("Superuser criado com sucesso!")
        
    except Exception as e:
        print(f"Erro ao resetar banco: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    confirm = input("Isso apagará TODOS os dados. Tem certeza? (S/N): ")
    if confirm.upper() == 'S':
        reset_and_seed()
    else:
        print("Operação cancelada.")
