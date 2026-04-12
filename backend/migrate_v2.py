import os
import pymysql
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"), override=True)

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "fluxoguard")

def migrate():
    connection = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )
    try:
        with connection.cursor() as cursor:
            # Adicionar coluna documento
            try:
                cursor.execute("ALTER TABLE users ADD COLUMN documento VARCHAR(18) AFTER cnpj_cpf")
                print("Coluna 'documento' adicionada.")
            except Exception as e:
                print(f"Aviso ao adicionar 'documento': {e}")

            # Adicionar coluna password_updated
            try:
                cursor.execute("ALTER TABLE users ADD COLUMN password_updated BOOLEAN DEFAULT FALSE AFTER password")
                print("Coluna 'password_updated' adicionada.")
            except Exception as e:
                print(f"Aviso ao adicionar 'password_updated': {e}")

            # Garantir UNIQUE no email
            try:
                cursor.execute("ALTER TABLE users ADD UNIQUE INDEX (email)")
                print("Índice UNIQUE no email garantido.")
            except Exception as e:
                print(f"Aviso ao adicionar UNIQUE no email: {e}")

            # Tornar cnpj_cpf nullable
            try:
                cursor.execute("ALTER TABLE users MODIFY cnpj_cpf VARCHAR(20) NULL")
                print("Coluna 'cnpj_cpf' alterada para nullable.")
            except Exception as e:
                print(f"Aviso ao alterar 'cnpj_cpf': {e}")

        connection.commit()
    finally:
        connection.close()

if __name__ == "__main__":
    migrate()
