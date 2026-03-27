import os
import json
from sqlalchemy import text
from database import SessionLocal, engine, Base
from supabase_service import supabase, SUPABASE_BUCKET

def cleanup():
    print("🧹 Iniciando limpeza geral (Mantendo apenas usuários e seus dados)...")
    
    # 1. Limpar Banco de Dados (Hostinger)
    db = SessionLocal()
    try:
        # Desabilitar check de chaves estrangeiras para limpeza rápida
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        
        print("🗑️ Limpando tabelas no MySQL (Transações, NF, Tokens)...")
        # Ajustado para os nomes em models.py
        db.execute(text("TRUNCATE TABLE notas_fiscais_supabase;"))
        db.execute(text("TRUNCATE TABLE auth_tokens;"))
        db.execute(text("TRUNCATE TABLE transactions;"))
        
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        db.commit()
        print("✅ Tabelas MySQL limpas. Tabela 'users' preservada.")
        
    except Exception as e:
        print(f"❌ Erro ao limpar MySQL: {str(e)}")
        db.rollback()
    finally:
        db.close()

    # 2. Limpar Supabase Storage
    print(f"☁️ Limpando arquivos no bucket '{SUPABASE_BUCKET}' do Supabase...")
    
    def delete_recursive(path=""):
        try:
            res = supabase.storage.from_(SUPABASE_BUCKET).list(path)
            if not res:
                return
            
            for file_obj in res:
                name = file_obj.get('name', 'N/A')
                metadata = file_obj.get('metadata')
                full_path = f"{path}/{name}".strip("/")
                
                # Regra: Se for algo com "usuarios", pula (preserva)
                if "usuarios" in full_path.lower():
                    print(f"⏩ Preservando: {full_path}")
                    continue

                if metadata is None: # Folder
                    delete_recursive(full_path)
                    # Tentamos remover a pasta se ela agora estiver vazia (Opcional no Supabase)
                else:
                    # É um arquivo
                    print(f"🗑️ Deletando: {full_path}")
                    supabase.storage.from_(SUPABASE_BUCKET).remove([full_path])
        
        except Exception as e:
            print(f"❌ Erro ao processar '{path}': {str(e)}")

    delete_recursive()
    print("✅ Limpeza do storage concluída (arquivos 'entregues' removidos).")

    print("\n✨ Sistema pronto. Apenas os usuários cadastrados foram mantidos.")

if __name__ == "__main__":
    cleanup()
