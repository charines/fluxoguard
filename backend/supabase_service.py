import os
import datetime
from typing import List, Optional
from supabase import create_client, Client
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from models import NotaFiscal
from fastapi import HTTPException, UploadFile

# Load environment variables
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"), override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "notas-fiscais")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Warning: SUPABASE_URL or SUPABASE_KEY not found in .env")

# Initialize Supabase Client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def validate_file(file: UploadFile):
    """
    Validate if file is PDF or Image and max 100 KB.
    """
    # Max size 100 KB
    MAX_SIZE = 100 * 1024 
    
    # Read file content to check size (fast for 100KB)
    content = file.file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Arquivo muito grande. Máximo 100 KB.")
    
    # Reset file pointer
    file.file.seek(0)
    
    # Allowed extensions
    allowed_extensions = [".pdf", ".jpg", ".jpeg", ".png"]
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Extensão não permitida. Use PDF ou Imagem (JPG/PNG).")

async def upload_nota_fiscal(transaction_id: int, user_id: int, file: UploadFile, db: Session):
    """
    Upload file to Supabase Storage and save record to database.
    Naming pattern: YYYYMMDDHHmm_IDCLIENTE.ext
    """
    # 1. Validation
    validate_file(file)
    
    # 2. Renaming
    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M")
    ext = os.path.splitext(file.filename)[1].lower()
    new_filename = f"{timestamp}_{user_id}{ext}"
    
    # 3. Supabase Upload
    try:
        content = await file.read()
        storage_path = f"{new_filename}"
        
        # Uploading to Supabase
        res = supabase.storage.from_(SUPABASE_BUCKET).upload(
            storage_path, 
            content, 
            {"content-type": file.content_type}
        )
        
        # 4. Save to Hostinger Database
        new_nf = NotaFiscal(
            transaction_id=transaction_id,
            path=storage_path,
            data_upload=datetime.datetime.utcnow()
        )
        db.add(new_nf)
        db.commit()
        db.refresh(new_nf)
        
        return new_nf
        
    except Exception as e:
        # Check if error is because file already exists or other
        error_msg = str(e)
        if "already exists" in error_msg:
             raise HTTPException(status_code=400, detail="Este arquivo já existe no storage.")
        raise HTTPException(status_code=500, detail=f"Erro no upload para Supabase: {error_msg}")

async def upload_file_to_supabase(file: UploadFile, subfolder: str = ""):
    """
    Generic upload to Supabase storage.
    """
    # 1. Validation
    validate_file(file)
    
    # 2. Renaming
    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    unique_id = os.urandom(4).hex()
    ext = os.path.splitext(file.filename)[1].lower()
    
    # Organize in subfolder if provided
    filename = f"{timestamp}_{unique_id}{ext}"
    storage_path = f"{subfolder}/{filename}" if subfolder else filename
    
    try:
        content = await file.read()
        
        # Uploading to Supabase
        supabase.storage.from_(SUPABASE_BUCKET).upload(
            storage_path, 
            content, 
            {"content-type": file.content_type}
        )
        
        return storage_path
        
    except Exception as e:
        error_msg = str(e)
        if "already exists" in error_msg:
             return storage_path # Return existing if conflict
        raise HTTPException(status_code=500, detail=f"Erro no upload para Supabase: {error_msg}")

def delete_file_from_supabase(path: str):
    """
    Delete a file from Supabase storage.
    """
    try:
        supabase.storage.from_(SUPABASE_BUCKET).remove([path])
    except Exception as e:
        print(f"Erro ao deletar do Supabase: {str(e)}")

def gerar_link_signed(path: str, expiration: int = 3600):
    """
    Generates a signed URL (default 1 hour) for the given path.
    """
    try:
        res = supabase.storage.from_(SUPABASE_BUCKET).create_signed_url(path, expiration)
        if isinstance(res, dict) and "signedURL" in res:
            return res["signedURL"]
        return str(res) # Sometimes res is just a string depending on version
    except Exception as e:
        # If it's not starting with http, it's just the path
        return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{path}"

def download_file_from_supabase(path: str) -> Optional[bytes]:
    """
    Download file content from Supabase storage as bytes.
    """
    try:
        data = supabase.storage.from_(SUPABASE_BUCKET).download(path)
        return data
    except Exception as e:
        print(f"Erro ao baixar do Supabase: {str(e)}")
        return None

def upload_bytes_to_supabase(content: bytes, filename: str, subfolder: str = "zips") -> str:
    """
    Upload raw bytes to Supabase storage.
    """
    storage_path = f"{subfolder}/{filename}" if subfolder else filename
    try:
        supabase.storage.from_(SUPABASE_BUCKET).upload(
            storage_path,
            content,
            {"content-type": "application/zip"}
        )
        return storage_path
    except Exception as e:
        if "already exists" in str(e):
            return storage_path
        print(f"Erro ao subir bytes para Supabase: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro no upload do ZIP: {str(e)}")

def gerar_link_nota(path: str):
    return gerar_link_signed(path, 900)
