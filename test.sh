#!/bin/bash

# Script de Teste FluxoGuard (Monorepo)
# Esse script facilita a execução dos testes de backend e frontend.

ROOT_DIR=$(pwd)

echo "🧪 FluxoGuard - Central de Testes"
echo "--------------------------------"
echo "Selecione o que deseja testar:"
echo "1) Backend (FastAPI + Pytest)"
echo "2) Frontend (React + Vitest)"
echo "3) Ambos (Backend + Frontend)"
echo "4) Sair"
echo "--------------------------------"
read -p "Opção [1-4]: " OPCAO

case $OPCAO in
    1)
        echo "🐍 [BACKEND] Iniciando testes com Pytest..."
        cd "$ROOT_DIR/backend"
        if [ -f "../.venv/bin/python" ]; then
            "../.venv/bin/python" -m pytest test_main.py
        else
            python3 -m pytest test_main.py
        fi
        ;;
    2)
        echo "⚛️  [FRONTEND] Iniciando testes com Vitest..."
        cd "$ROOT_DIR/frontend"
        npm test -- --run
        ;;
    3)
        echo "🚀 [FULL-SYSTEM] Executando todos os testes..."
        
        echo -e "\n--- BACKEND ---"
        cd "$ROOT_DIR/backend"
        if [ -f "../.venv/bin/python" ]; then
            "../.venv/bin/python" -m pytest test_main.py
        else
            python3 -m pytest test_main.py
        fi
        
        echo -e "\n--- FRONTEND ---"
        cd "$ROOT_DIR/frontend"
        npm test -- --run
        ;;
    4)
        echo "👋 Saindo..."
        exit 0
        ;;
    *)
        echo "❌ Opção inválida."
        exit 1
        ;;
esac
