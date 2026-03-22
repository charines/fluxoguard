from sqlalchemy import text

from database import engine


def migrate_mysql_user_type_enum() -> None:
    with engine.begin() as conn:
        dialect = conn.dialect.name
        if dialect != "mysql":
            print(f"Migração pulada: banco atual é '{dialect}', esperado 'mysql'.")
            return

        result = conn.execute(
            text(
                """
                SELECT COLUMN_TYPE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'users'
                  AND COLUMN_NAME = 'tipo'
                """
            )
        ).fetchone()

        if not result:
            raise RuntimeError("Coluna users.tipo não encontrada.")

        column_type = (result[0] or "").lower()
        if "superadmin" in column_type:
            print("Migração já aplicada: SUPERADMIN já existe no ENUM users.tipo.")
            return

        conn.execute(
            text(
                """
                ALTER TABLE users
                MODIFY COLUMN tipo ENUM('SUPERADMIN','ADMIN','PARCEIRO')
                NOT NULL DEFAULT 'PARCEIRO'
                """
            )
        )
        print("Migração aplicada com sucesso: users.tipo agora aceita SUPERADMIN.")


if __name__ == "__main__":
    migrate_mysql_user_type_enum()
