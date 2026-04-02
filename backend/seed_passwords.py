import string
import random
from sqlalchemy.orm import Session
from database import SessionLocal
from models import User

def generate_dynamic_password() -> str:
    """Gera senha de 8 caracteres no formato: abc-1a23."""
    letters = string.ascii_lowercase
    digits = string.digits

    p1 = "".join(random.choices(letters, k=3))
    p2 = random.choice(digits)
    p3 = random.choice(letters)
    p4 = "".join(random.choices(digits, k=2))
    return f"{p1}-{p2}{p3}{p4}"

def migrate_passwords():
    db: Session = SessionLocal()
    try:
        users = db.query(User).all()
        updated_count = 0
        for user in users:
            # Apenas gera para quem não tem ou se o usuário quiser forçar todos (como é teste)
            if not user.password:
                new_pass = generate_dynamic_password()
                user.password = new_pass
                print(f"✅ Usuário: {user.nome} ({user.email}) -> Nova Senha: {new_pass}")
                updated_count += 1
        
        db.commit()
        print(f"\n🚀 Sucesso! {updated_count} usuários atualizados com senhas dinâmicas.")
    except Exception as e:
        print(f"❌ Erro na migração: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate_passwords()
