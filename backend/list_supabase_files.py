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

def list_all_buckets():
    print("🪣 Listando todos os buckets:")
    try:
        buckets = supabase.storage.list_buckets()
        for b in buckets:
            print(f"Bucket: {b.name}")
            list_files_recursive(b.name, "")
    except Exception as e:
        print(f"❌ Erro ao listar buckets: {str(e)}")

def list_files_recursive(bucket_name, path):
    try:
        res = supabase.storage.from_(bucket_name).list(path)
        if not res:
            return
        for file_obj in res:
            name = file_obj.get('name', 'N/A')
            metadata = file_obj.get('metadata')
            if metadata is None: # Likely a folder
                print(f"  📁 {path}/{name}".strip("/"))
                list_files_recursive(bucket_name, f"{path}/{name}".strip("/"))
            else:
                size = metadata.get('size', 0)
                print(f"  📄 {path}/{name} ({size} bytes)".strip("/"))
    except Exception as e:
        print(f"  ❌ Erro ao listar '{path}' no bucket '{bucket_name}': {str(e)}")

if __name__ == "__main__":
    list_all_buckets()
