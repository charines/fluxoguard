from sqlalchemy import text

from database import engine


def migrate_add_telefone_column() -> None:
    with engine.begin() as conn:
        if conn.dialect.name != "mysql":
            print(f"Migração pulada: banco atual é '{conn.dialect.name}', esperado 'mysql'.")
            return

        row = conn.execute(
            text(
                """
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'users'
                  AND COLUMN_NAME = 'telefone'
                """
            )
        ).fetchone()

        if row:
            print("Migração já aplicada: coluna users.telefone já existe.")
            return

        conn.execute(
            text(
                """
                ALTER TABLE users
                ADD COLUMN telefone VARCHAR(30) NULL
                """
            )
        )
        print("Migração aplicada com sucesso: coluna users.telefone criada.")


if __name__ == "__main__":
    migrate_add_telefone_column()
