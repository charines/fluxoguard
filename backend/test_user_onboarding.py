import pytest
from models import User
from main import generate_dynamic_password
import schemas

@pytest.fixture
def test_superadmin(db):
    user = User(
        nome="Superadmin Test",
        email="super@guard.com",
        tipo="SUPERADMIN",
        password="root",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@pytest.fixture
def test_admin(db):
    user = User(
        nome="Admin Test",
        email="admin@guard.com",
        tipo="ADMIN",
        password="root",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@pytest.fixture
def auth_headers_super(client, test_superadmin):
    response = client.post("/auth/login", json={
        "identifier": "super@guard.com",
        "code": "root"
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture
def auth_headers_admin(client, test_admin):
    response = client.post("/auth/login", json={
        "identifier": "admin@guard.com",
        "code": "root"
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_rbac_admin_cannot_create_admin(client, auth_headers_admin):
    response = client.post(
        "/users/register",
        json={
            "nome": "New Admin",
            "email": "newadmin@test.com",
            "tipo": "ADMIN"
        },
        headers=auth_headers_admin
    )
    assert response.status_code == 403
    assert "Apenas Super-Administradores podem promover novos gestores" in response.json()["detail"]

def test_rbac_super_can_create_admin(client, auth_headers_super):
    response = client.post(
        "/users/register",
        json={
            "nome": "Authorized Admin",
            "email": "authadmin@test.com",
            "tipo": "ADMIN"
        },
        headers=auth_headers_super
    )
    assert response.status_code == 201
    assert response.json()["tipo"] == "ADMIN"
    assert "password" in response.json()

def test_duplicate_email_integrity(client, auth_headers_super):
    # First create one
    client.post(
        "/users/register",
        json={
            "nome": "First User",
            "email": "duplicate@test.com",
            "tipo": "PARCEIRO",
            "documento": "111.111.111-11"
        },
        headers=auth_headers_super
    )
    
    # Try duplicate
    response = client.post(
        "/users/register",
        json={
            "nome": "Second User",
            "email": "duplicate@test.com",
            "tipo": "ADMIN"
        },
        headers=auth_headers_super
    )
    assert response.status_code == 400
    assert "já faz parte da nossa base" in response.json()["detail"]

def test_conditional_validation_partner_needs_doc(client, auth_headers_super):
    response = client.post(
        "/users/register",
        json={
            "nome": "No Doc Partner",
            "email": "nodoc@test.com",
            "tipo": "PARCEIRO"
        },
        headers=auth_headers_super
    )
    assert response.status_code == 422
    assert "Documento (CPF/CNPJ) é obrigatório" in response.json()["detail"]

def test_auto_password_generation(client, auth_headers_super):
    response = client.post(
        "/users/register",
        json={
            "nome": "Auto Pass User",
            "email": "autopass@test.com",
            "tipo": "ADMIN"
        },
        headers=auth_headers_super
    )
    assert response.status_code == 201
    password = response.json()["password"]
    assert len(password) >= 8
    assert "-" in password # Protocol format: abc-1a23

@pytest.mark.asyncio
async def test_idempotency_simulated_dual_click(client, auth_headers_super):
    payload = {
        "nome": "Idem Test",
        "email": "idem@test.com",
        "tipo": "PARCEIRO",
        "documento": "222.222.222-22"
    }
    
    # Simulate two immediate requests
    resp1 = client.post("/users/register", json=payload, headers=auth_headers_super)
    resp2 = client.post("/users/register", json=payload, headers=auth_headers_super)
    
    assert resp1.status_code == 201
    assert resp2.status_code == 400 # Second one fails due to email uniqueness
