from sqlalchemy import text
from database import engine

def migrate():
    with engine.connect() as connection:
        # Check if password column exists
        result = connection.execute(text("SHOW COLUMNS FROM users LIKE 'password'"))
        if not result.fetchone():
            print("🆕 Adicionando coluna 'password' na tabela 'users'...")
            connection.execute(text("ALTER TABLE users ADD COLUMN password VARCHAR(50) DEFAULT NULL AFTER cnpj_cpf"))
            connection.commit()
            print("✅ Coluna adicionada com sucesso!")
        else:
            print("⚠️ A coluna 'password' já existe.")

if __name__ == "__main__":
    migrate()
