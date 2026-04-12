from sqlalchemy import text

from database import engine


def migrate_add_data_emissao_column() -> None:
    with engine.begin() as conn:
        if conn.dialect.name != "mysql":
            print(f"Migracao pulada: banco atual e '{conn.dialect.name}', esperado 'mysql'.")
            return

        row = conn.execute(
            text(
                """
                SELECT COLUMN_NAME
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'transaction_items'
                  AND COLUMN_NAME = 'data_emissao'
                """
            )
        ).fetchone()

        if row:
            print("Migracao ja aplicada: coluna transaction_items.data_emissao ja existe.")
            return

        conn.execute(
            text(
                """
                ALTER TABLE transaction_items
                ADD COLUMN data_emissao VARCHAR(10) NULL
                """
            )
        )
        print("Migracao aplicada: coluna transaction_items.data_emissao criada.")


if __name__ == "__main__":
    migrate_add_data_emissao_column()
