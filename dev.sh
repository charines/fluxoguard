#!/bin/bash

# Script de Desenvolvimento FluxoGuard (Monorepo)
# Esse script garante que o backend no venv e o frontend rodem isolados

echo "🚀 Iniciando FluxoGuard (Monorepo) em localhost..."

# Caminho raiz absoluto
ROOT_DIR=$(pwd)

# 1. Parar processos se as portas estiverem ocupadas (limpeza de segurança)
echo "🧹 Limpando processos antigos nas portas 8000 e 5175..."
fuser -k 8000/tcp 5175/tcp 2>/dev/null

# 2. Iniciar o Backend no VENV do FluxoGuard
echo "🐍 [BACKEND] Iniciando FastAPI na porta 8000..."
cd "$ROOT_DIR/backend"
# Certificar que o venv existe antes de rodar
if [ ! -f "$ROOT_DIR/.venv/bin/python" ]; then
    echo "❌ Erro: Ambiente virtual (.venv) não encontrado na raiz."
    exit 1
fi
FRONTEND_URL="http://localhost:5175" "$ROOT_DIR/.venv/bin/python" -m uvicorn main:app --reload --port 8000 > "$ROOT_DIR/backend.log" 2>&1 &
BACKEND_PID=$!

# 3. Iniciar o Frontend Vite
echo "⚛️  [FRONTEND] Iniciando React/Vite na porta 5175..."
cd "$ROOT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    echo "📦 Node modules não encontrados. Rodando npm install..."
    npm install
fi
npm run dev -- --port 5175 > "$ROOT_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

# Exibir Links
echo ""
echo "✅ Sistema Disponível em:"
echo "📡 Backend API/docs: http://localhost:8000/docs"
echo "🌐 Interface UI:      http://localhost:5175"
echo ""
echo "📝 Logs salvos em backend.log e frontend.log na raiz."
echo "Press [Ctrl+C] para encerrar."

# Função para garantir que os processos morram ao sair (trap)
trap "kill $BACKEND_PID $FRONTEND_PID; echo -e '\n🛑 Serviços do FluxoGuard encerrados.'; exit" SIGINT

# Esperar para manter o terminal ativo e monitorar PIDs
wait $BACKEND_PID $FRONTEND_PID
