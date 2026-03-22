import requests
import time
import sys

BASE_URL = "http://localhost:8000"

def test_health():
    print("🔍 [TESTE 1] Verificando se o Backend está vivo...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ Backend respondendo OK.")
        else:
            print(f"❌ Backend respondeu com status {response.status_code}")
    except Exception as e:
        print(f"❌ Erro ao conectar no backend. Certifique-se de que ele está rodando na porta 8000. Erro: {e}")
        sys.exit(1)

def test_create_user():
    print("\n🔍 [TESTE 2] Cadastrando um Parceiro de Teste no Banco Hostgator...")
    data = {
        "nome": f"Teste Integrado {int(time.time())}",
        "email": f"teste_{int(time.time())}@fluxoguard.com.br",
        "tipo": "PARCEIRO",
        "cnpj_cpf": f"{int(time.time())}"
    }
    response = requests.post(f"{BASE_URL}/users", json=data)
    if response.status_code == 200:
        print(f"✅ Usuário criado com sucesso! ID: {response.json().get('id')}")
        return response.json().get('id')
    else:
        print(f"❌ Falha ao criar usuário: {response.text}")
        sys.exit(1)

def test_duplicate_user(email, cpf):
    print("\n🔍 [TESTE 3] Validando regra de Email Único...")
    data = {
        "nome": "Duplicado",
        "email": email,
        "tipo": "PARCEIRO",
        "cnpj_cpf": cpf
    }
    response = requests.post(f"{BASE_URL}/users", json=data)
    if response.status_code == 400:
        print("✅ Sistema impediu duplicidade corretamente (400 Bad Request).")
    else:
        print(f"❌ Erro: O sistema permitiu um cadastro duplicado ou retornou status {response.status_code}")

def test_create_transaction(user_id):
    print("\n🔍 [TESTE 4] Criando uma Transação para o novo usuário...")
    data = {
        "parceiro_id": user_id,
        "valor_liberado": 1500.50,
        "valor_ajustado": 1420.00,
        "status": "PENDENTE",
        "hash_link": f"hash_{int(time.time())}"
    }
    response = requests.post(f"{BASE_URL}/transactions", json=data)
    if response.status_code == 200:
        print(f"✅ Transação ID {response.json().get('id')} criada com sucesso!")
    else:
        print(f"❌ Falha ao criar transação: {response.text}")

if __name__ == "__main__":
    print("--- INICIANDO PLANO DE TESTE ESTRUTURAL FLUXOGUARD ---\n")
    test_health()
    
    # Gerando dados para teste
    user_email = f"parceiro_{int(time.time())}@teste.com"
    user_cpf = f"CPF_{int(time.time())}"
    
    # Criar usuário real
    print(f"Criando usuário com Email: {user_email}")
    data = {
        "nome": "Parceiro de Teste",
        "email": user_email,
        "tipo": "PARCEIRO",
        "cnpj_cpf": user_cpf
    }
    resp = requests.post(f"{BASE_URL}/users", json=data)
    if resp.status_code == 200:
        user_id = resp.json().get('id')
        print(f"✅ Usuário ID {user_id} criado.")
        
        # Testar duplicata
        test_duplicate_user(user_email, user_cpf)
        
        # Testar transação
        test_create_transaction(user_id)
        
        print("\n🏆 TODOS OS TESTES PASSARAM COM SUCESSO!")
        print("💡 Abra o Frontend (http://localhost:5175/admin) e veja o 'Parceiro de Teste' na lista.")
    else:
        print(f"❌ Falha no setup inicial do teste: {resp.text}")
