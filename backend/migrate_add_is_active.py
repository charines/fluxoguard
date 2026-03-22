from sqlalchemy import text

from database import engine


def migrate_add_is_active_column() -> None:
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
                  AND COLUMN_NAME = 'is_active'
                """
            )
        ).fetchone()

        if row:
            print("Migração já aplicada: coluna users.is_active já existe.")
            return

        conn.execute(
            text(
                """
                ALTER TABLE users
                ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1
                """
            )
        )
        print("Migração aplicada com sucesso: coluna users.is_active criada.")


if __name__ == "__main__":
    migrate_add_is_active_column()
