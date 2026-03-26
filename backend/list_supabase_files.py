import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Carregar variáveis
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"), override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = "notas-fiscais"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def list_files():
    print(f"🔍 Listando arquivos no bucket '{SUPABASE_BUCKET}':")
    try:
        res = supabase.storage.from_(SUPABASE_BUCKET).list()
        for file in res:
            print(f"📄 {file['name']} (Tamanho: {file['metadata']['size']} bytes)")
    except Exception as e:
        print(f"❌ Erro ao listar: {str(e)}")

if __name__ == "__main__":
    list_files()
