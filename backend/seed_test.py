from datetime import datetime, timedelta, timezone
from uuid import uuid4
import os

from database import Base, SessionLocal, engine
from models import AuthToken, User


PARTNERS = [
    {
        "nome": "Logística Express",
        "email": "log@teste.com",
        "cnpj_cpf": "11222333000100",
    },
    {
        "nome": "Consultoria Alpha",
        "email": "alpha@teste.com",
        "cnpj_cpf": "44555666000199",
    },
]


def get_or_create_partner(db, payload):
    partner = db.query(User).filter(User.email == payload["email"]).first()
    if not partner:
        partner = User(
            nome=payload["nome"],
            email=payload["email"],
            tipo="PARCEIRO",
            cnpj_cpf=payload["cnpj_cpf"],
        )
        db.add(partner)
        db.commit()
        db.refresh(partner)
        return partner, True

    partner.nome = payload["nome"]
    partner.cnpj_cpf = payload["cnpj_cpf"]
    partner.tipo = "PARCEIRO"
    db.commit()
    db.refresh(partner)
    return partner, False


def create_access_token(db, user_id):
    token_value = str(uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(days=15)

    token = AuthToken(
        user_id=user_id,
        token=token_value,
        expires_at=expires_at,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return token


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5175")

    try:
        print("Seed de parceiros de teste iniciada.")
        for payload in PARTNERS:
            partner, created = get_or_create_partner(db, payload)
            token = create_access_token(db, partner.id)
            status = "criado" if created else "atualizado"

            print(f"\nParceiro {status}: {partner.nome} ({partner.email})")
            print(f"CNPJ/CPF: {partner.cnpj_cpf}")
            print(f"Token: {token.token}")
            print(f"Expira em: {token.expires_at.isoformat()} UTC")
            print(f"Link de Acesso: {frontend_url}/login?token={token.token}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
