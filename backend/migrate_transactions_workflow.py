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


def migrate_transactions_workflow() -> None:
    with engine.begin() as conn:
        if conn.dialect.name != "mysql":
            print(f"Migracao pulada: banco atual eh '{conn.dialect.name}', esperado 'mysql'.")
            return

        if not column_exists(conn, "transactions", "zip_contabilidade_url"):
            conn.execute(
                text(
                    """
                    ALTER TABLE transactions
                    ADD COLUMN zip_contabilidade_url VARCHAR(1024) NULL
                    """
                )
            )
            print("Coluna transactions.zip_contabilidade_url criada.")
        else:
            print("Coluna transactions.zip_contabilidade_url ja existe.")

        conn.execute(
            text(
                """
                ALTER TABLE transactions
                MODIFY COLUMN status ENUM(
                    'PENDENTE',
                    'LIBERADO',
                    'AGUARDANDO_NF',
                    'AGUARDANDO_APROVACAO',
                    'DIVERGENCIA',
                    'CONFERENCIA',
                    'PAGO',
                    'FINALIZADO',
                    'ARQUIVADO'
                ) NOT NULL DEFAULT 'PENDENTE'
                """
            )
        )
        print("Enum transactions.status atualizado com sucesso para workflow financeiro.")


if __name__ == "__main__":
    migrate_transactions_workflow()
