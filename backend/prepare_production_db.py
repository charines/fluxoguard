from sqlalchemy import text
from sqlalchemy.orm import Session

from database import SessionLocal
from models import User
from supabase_service import supabase, SUPABASE_BUCKET


TARGET_SUPERADMINS = [
    {
        "nome": "charles",
        "email": "charles@inmade.com.br",
        "password": "dpj2o75",
        "documento": "000.000.000-00",
        "cnpj_cpf": "000.000.000-00",
    },
    {
        "nome": "financeiro",
        "email": "financeiro@andalafat.com.br",
        "password": "ine5o07",
        "documento": "000.000.000-01",
        "cnpj_cpf": "000.000.000-01",
    },
]


def truncate_operational_tables(db: Session) -> None:
    # Ordem importante para respeitar dependencias.
    db.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
    db.execute(text("TRUNCATE TABLE transaction_items;"))
    db.execute(text("TRUNCATE TABLE notas_fiscais_supabase;"))
    db.execute(text("TRUNCATE TABLE auth_tokens;"))
    db.execute(text("TRUNCATE TABLE transactions;"))
    db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))


def keep_only_target_superadmins(db: Session) -> None:
    allowed_emails = [item["email"] for item in TARGET_SUPERADMINS]

    # Remove todos os usuarios fora da whitelist.
    db.query(User).filter(~User.email.in_(allowed_emails)).delete(synchronize_session=False)

    # Cria ou atualiza os superadmins esperados.
    for target in TARGET_SUPERADMINS:
        user = db.query(User).filter(User.email == target["email"]).first()
        if not user:
            user = User(email=target["email"])
            db.add(user)

        user.nome = target["nome"]
        user.password = target["password"]
        user.tipo = "SUPERADMIN"
        user.is_active = True
        user.password_updated = False
        user.documento = target["documento"]
        user.cnpj_cpf = target["cnpj_cpf"]


def purge_supabase_bucket() -> None:
    print(f"Limpando bucket do Supabase: {SUPABASE_BUCKET}")

    def list_all_files(path: str = "") -> list[str]:
        files_to_delete: list[str] = []
        response = supabase.storage.from_(SUPABASE_BUCKET).list(path)
        if not response:
            return files_to_delete

        for entry in response:
            name = entry.get("name")
            if not name:
                continue
            full_path = f"{path}/{name}".strip("/")
            # No retorno atual, metadata ausente indica "pasta".
            if entry.get("metadata") is None:
                files_to_delete.extend(list_all_files(full_path))
            else:
                files_to_delete.append(full_path)
        return files_to_delete

    files = list_all_files("")
    if not files:
        print("Bucket já está vazio.")
        return

    batch_size = 100
    deleted = 0
    for i in range(0, len(files), batch_size):
        batch = files[i:i + batch_size]
        supabase.storage.from_(SUPABASE_BUCKET).remove(batch)
        deleted += len(batch)

    print(f"Arquivos removidos do Supabase: {deleted}")


def prepare_production_db() -> None:
    db: Session = SessionLocal()
    try:
        truncate_operational_tables(db)
        keep_only_target_superadmins(db)
        db.commit()
        purge_supabase_bucket()
        print("Base preparada para produção com sucesso.")
        print("Superadmins mantidos:")
        for item in TARGET_SUPERADMINS:
            print(f"- {item['email']}")
    except Exception as exc:
        db.rollback()
        print(f"Erro ao preparar base: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    confirm = input(
        "Isso limpará banco e apagará TODOS os arquivos do Supabase, mantendo apenas 2 superadmins. Continuar? (S/N): "
    ).strip().upper()
    if confirm == "S":
        prepare_production_db()
    else:
        print("Operação cancelada.")
