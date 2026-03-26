import os
import asyncio
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from models import Transaction, NotaFiscal
from supabase_service import upload_nota_fiscal, gerar_link_nota
from fastapi import UploadFile
import io

async def test_upload():
    print("🚀 Iniciando teste de integração Supabase + Hostinger...")
    
    # 1. Garantir que as tabelas existam
    Base.metadata.create_all(bind=engine)
    
    db: Session = SessionLocal()
    try:
        # 2. Buscar uma transação existente para vincular o teste
        tx = db.query(Transaction).first()
        if not tx:
            print("❌ Erro: Nenhuma transação encontrada no banco para vincular o teste.")
            return
            
        print(f"📦 Usando Transação ID: {tx.id} para o teste.")
        
        # 3. Criar um arquivo dummy (PDF minimalista válido)
        file_content = (
            b"%PDF-1.1\n"
            b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n"
            b"2 0 obj << /Type /Pages /Count 1 /Kids [3 0 R] >> endobj\n"
            b"3 0 obj << /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj\n"
            b"4 0 obj << /Length 51 >> stream\n"
            b"BT /F1 24 Tf 100 700 Td (FluxoGuard - Teste Supabase) Tj ET\n"
            b"endstream endobj\n"
            b"xref\n"
            b"0 5\n"
            b"0000000000 65535 f\n"
            b"0000000009 00000 n\n"
            b"0000000058 00000 n\n"
            b"0000000114 00000 n\n"
            b"0000000298 00000 n\n"
            b"trailer << /Size 5 /Root 1 0 R >>\n"
            b"startxref\n"
            b"399\n"
            b"%%EOF"
        )
        file_io = io.BytesIO(file_content)
        
        # Criar objeto UploadFile do FastAPI
        test_file = UploadFile(
            file=file_io, 
            filename="teste_ferramenta.pdf",
            headers={"content-type": "application/pdf"}
        )
        
        # 4. Tentar o Upload via nosso novo módulo
        print("📤 Enviando para Supabase...")
        new_nf = await upload_nota_fiscal(
            transaction_id=tx.id,
            user_id=tx.parceiro_id or 999,
            file=test_file,
            db=db
        )
        
        print(f"✅ Sucesso! Registro salvo no banco ID: {new_nf.id}")
        print(f"📍 Path no Supabase: {new_nf.path}")
        
        # 5. Gerar link de download
        print("🔗 Gerando link assinado (15 min)...")
        link = gerar_link_nota(new_nf.path)
        print(f"\n👉 CLIQUE AQUI PARA TESTAR O DOWNLOAD:\n{link}\n")
        
    except Exception as e:
        print(f"❌ FALHA NO TESTE: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(test_upload())
