from sqlalchemy import text

from database import engine


def column_exists(conn, table_name: str, column_name: str) -> bool:
    row = conn.execute(
        text(
            """
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = :table_name
              AND COLUMN_NAME = :column_name
            """
        ),
        {"table_name": table_name, "column_name": column_name},
    ).fetchone()
    return bool(row)


def migrate_transactions() -> None:
    with engine.begin() as conn:
        if conn.dialect.name != "mysql":
            print(f"Migracao pulada: banco atual eh '{conn.dialect.name}', esperado 'mysql'.")
            return

        alterations = [
            ("ano", "ALTER TABLE transactions ADD COLUMN ano INT NULL"),
            ("mes", "ALTER TABLE transactions ADD COLUMN mes INT NULL"),
            ("dia", "ALTER TABLE transactions ADD COLUMN dia INT NULL"),
            ("nome_cliente", "ALTER TABLE transactions ADD COLUMN nome_cliente VARCHAR(255) NULL"),
            ("comprovantes_json", "ALTER TABLE transactions ADD COLUMN comprovantes_json TEXT NULL"),
            ("notas_fiscais_json", "ALTER TABLE transactions ADD COLUMN notas_fiscais_json TEXT NULL"),
        ]

        for column_name, sql in alterations:
            if not column_exists(conn, "transactions", column_name):
                conn.execute(text(sql))
                print(f"Coluna transactions.{column_name} criada.")
            else:
                print(f"Coluna transactions.{column_name} ja existe.")

        conn.execute(
            text(
                """
                ALTER TABLE transactions
                MODIFY COLUMN status ENUM(
                    'PENDENTE',
                    'LIBERADO',
                    'AGUARDANDO_NF',
                    'CONFERENCIA',
                    'PAGO',
                    'ARQUIVADO'
                ) NOT NULL DEFAULT 'PENDENTE'
                """
            )
        )
        print("Enum transactions.status atualizado com sucesso.")


if __name__ == "__main__":
    migrate_transactions()
