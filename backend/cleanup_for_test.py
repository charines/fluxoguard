import os
from sqlalchemy import text
from database import SessionLocal, engine, Base
from supabase_service import supabase, SUPABASE_BUCKET

def cleanup():
    print("🧹 Iniciando limpeza geral (exceto usuários)...")
    
    # 1. Limpar Banco de Dados (Hostinger)
    db = SessionLocal()
    try:
        # Desabilitar check de chaves estrangeiras para limpeza rápida
        db.execute(text("SET FOREIGN_KEY_CHECKS = 0;"))
        
        print("🗑️ Limpando tabelas no MySQL...")
        # NOTA: Ajuste os nomes se necessário baseando-se no models.py
        db.execute(text("TRUNCATE TABLE notas_fiscais_supabase;"))
        db.execute(text("TRUNCATE TABLE auth_tokens;"))
        db.execute(text("TRUNCATE TABLE transactions;"))
        
        db.execute(text("SET FOREIGN_KEY_CHECKS = 1;"))
        db.commit()
        print("✅ Tabelas MySQL limpas (Usuários preservados).")
        
    except Exception as e:
        print(f"❌ Erro ao limpar MySQL: {str(e)}")
        db.rollback()
    finally:
        db.close()

    # 2. Limpar Supabase Storage
    print(f"☁️ Limpando arquivos no bucket '{SUPABASE_BUCKET}' do Supabase...")
    try:
        # Listar todos os arquivos
        res = supabase.storage.from_(SUPABASE_BUCKET).list()
        if res:
            file_names = [f['name'] for f in res]
            if file_names:
                supabase.storage.from_(SUPABASE_BUCKET).remove(file_names)
                print(f"✅ {len(file_names)} arquivos removidos do Supabase.")
            else:
                print("ℹ️ Nenhum arquivo encontrado no Supabase.")
        else:
             print("ℹ️ Nenhum arquivo para remover no Supabase.")
    except Exception as e:
        print(f"❌ Erro ao limpar Supabase: {str(e)}")

    print("\n✨ Limpeza concluída! Pronto para novos testes.")

if __name__ == "__main__":
    cleanup()
