import pytest
from main import generate_dynamic_password
from models import User

def test_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_create_user(client):
    # Primero login as admin (não temos admin ainda no sqlite de teste)
    # Vamos criar um admin manualmente na fixture ou no teste
    pass

@pytest.fixture
def test_admin(db):
    admin = User(
        nome="Admin Teste",
        email="admin@teste.com",
        tipo="ADMIN",
        cnpj_cpf="12345678901",
        password="password123",
        is_active=True
    )
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin

def test_login(client, test_admin, db):
    response = client.post("/auth/login", json={
        "identifier": "admin@teste.com",
        "code": "password123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "admin@teste.com"

def test_create_partner(client, test_admin):
    # Login to get token
    login_resp = client.post("/auth/login", json={
        "identifier": "admin@teste.com",
        "code": "password123"
    })
    token = login_resp.json()["access_token"]
    
    response = client.post(
        "/users",
        json={
            "nome": "Parceiro Teste",
            "email": "parceiro@teste.com",
            "tipo": "PARCEIRO",
            "cnpj_cpf": "98765432100",
            "telefone": "11999999999",
            "is_active": True
        },
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["nome"] == "Parceiro Teste"

import unittest.mock as mock

def test_create_transaction(client, test_admin, db):
    # Mocking supabase service
    with mock.patch("main.save_upload_files_supabase", return_value=["comprovante_fake.pdf"]):
        # Login
        login_resp = client.post("/auth/login", json={
            "identifier": "admin@teste.com",
            "code": "password123"
        })
        token = login_resp.json()["access_token"]
        
        # Create partner first
        partner = User(
            nome="Parceiro para Transacao",
            email="p2@teste.com",
            tipo="PARCEIRO",
            cnpj_cpf="11122233344",
            password="pass",
            is_active=True
        )
        db.add(partner)
        db.commit()
        db.refresh(partner)
        
        # Create transaction
        response = client.post(
            "/transactions",
            data={
                "user_id": partner.id,
                "ano": 2026,
                "mes": 4,
                "dia": 2,
                "nome_cliente": "Cliente Teste",
                "valor_liberado": "1000.50"
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert response.json()["nome_cliente"] == "Cliente Teste"
        assert "comprovantes" in response.json()
        assert response.json()["comprovantes"] == ["comprovante_fake.pdf"]

def test_register_user_job(client, test_admin):
    # Login to get token (only superadmin can create admins, but let's test a partner first with an admin token)
    login_resp = client.post("/auth/login", json={
        "identifier": "admin@teste.com",
        "code": "password123"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Test Parceiro registration (Admins CAN create Partners)
    response = client.post(
        "/users/register",
        json={
            "nome": "Parceiro Onboarding",
            "email": "onboarding@teste.com",
            "tipo": "PARCEIRO",
            "documento": "123.456.789-00",
            "telefone": "11988887777"
        },
        headers=headers
    )
    assert response.status_code == 201
    data = response.json()
    assert data["nome"] == "Parceiro Onboarding"
    assert "password" in data 

    # Test duplication
    response_dup = client.post(
        "/users/register",
        json={
            "nome": "Outro",
            "email": "onboarding@teste.com",
            "tipo": "PARCEIRO",
            "documento": "000"
        },
        headers=headers
    )
    assert response_dup.status_code == 400
    assert "já faz parte da nossa base" in response_dup.json()["detail"]

    # Test User (Admin-like) registration without documento
    response_user = client.post(
        "/users/register",
        json={
            "nome": "User Interno",
            "email": "interno@teste.com",
            "tipo": "ADMIN"
        },
        headers=headers
    )
    # This should fail with 403 because admin cannot create admin
    assert response_user.status_code == 403
