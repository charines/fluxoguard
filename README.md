# 🛡️ FluxoGuard

**Controle rigoroso, transparência total e segurança no repasse de pagamentos.**

FluxoGuard é um sistema de gestão financeira especializado no monitoramento e execução de repasses (payouts). O sistema garante que o movimento do dinheiro — desde a origem (Exchange/Email) até o destino final (PIX para o parceiro) — seja auditável, seguro e em conformidade com as normas contábeis.

---

## 📖 O Conceito

O nome **FluxoGuard** reflete a alma do sistema:

*   **Fluxo:** Representa o dinamismo do dinheiro. O sistema mapeia o trajeto completo, garantindo que nenhum centavo se perca entre o recebimento do e-mail de notificação e a liquidação do pagamento.
*   **Guard:** Remete à segurança do "Kit Completo". O sistema exige a retenção de documentos por 6 meses e impõe uma conferência rigorosa por parte do Administrador antes de qualquer liberação de fundos.

---

## 🏗️ Arquitetura do Sistema

O FluxoGuard utiliza uma arquitetura moderna e escalável:

### **Frontend (Vite + React)**
*   **Interface:** Desenvolvida com Tailwind CSS para um design responsivo e de alta performance.
*   **Segurança:** Implementação de **Magic Links** (Links Seguros) com criptografia AES para que parceiros acessem seus comprovantes sem a necessidade de login complexo, mantendo a integridade dos dados.
*   **Portal do Parceiro:** Área dedicada para upload de Notas Fiscais e visualização de comprovantes de pagamento.

### **Backend (FastAPI + Python)**
*   **API:** Core em FastAPI para processamento rápido e documentação automática.
*   **ORM:** SQLAlchemy para gestão robusta de dados em banco relacional (MySQL).
*   **Processamento de Arquivos:** Integração com `pdfplumber` para validação de documentos e geração de pacotes ZIP para a contabilidade.
*   **Criptografia:** Protocolos de segurança em Python para geração e validação de tokens de acesso temporários.

### **Infraestrutura e Serviços**
*   **Armazenamento:** Integração com **Supabase Storage** para persistência segura de documentos (Comprovantes e Notas Fiscais) em nuvem.
*   **Deployment:** Configurado para **Render**, permitindo escalabilidade horizontal do backend e entrega estática otimizada do frontend.

---

## 🗺️ Jornadas do Sistema

O FluxoGuard foi desenhado para atender diferentes perfis de forma otimizada:

### **1. Jornada do Administrador (Gestão Operacional)**
*   **Gestão de Usuários:** Cadastro e controle de status de parceiros e outros administradores.
*   **Criação de Repasses:** Cadastro manual de novos pagamentos e upload de comprovantes iniciais.
*   **Notificação:** Geração de e-mails profissionais com links seguros (**Magic Links**) para cobrança de documentos.

### **2. Jornada do Financeiro (Conferência e Auditoria)**
*   **Aprovação de NF:** Revisão técnica das notas fiscais enviadas pelos parceiros.
*   **Gestão de Divergências:** Identificação de erros e notificação imediata para correção.
*   **Fechamento Contábil:** Geração de arquivo **ZIP consolidado** com todos os documentos do período para a contabilidade e arquivamento definitivo (`FINALIZADO`).

### **3. Jornada do Parceiro (Portal e Link Seguro)**
*   **Portal Interno:** Acesso via CNPJ para visualização de todo o histórico de repasses e downloads de recibos.
*   **Magic Link (Acesso Rápido):** Habilitação de pagamentos via upload de NF diretamente por um link criptografado recebido por E-mail/WhatsApp, sem necessidade de login.

---

## 🔄 Fluxo de Trabalho (Workflow)

1.  **Criação:** O Administrador cadastra um novo repasse (Transaction) no sistema.
2.  **Notificação:** O parceiro recebe o aviso de que o repasse está disponível.
3.  **Habilitação (NF):** O parceiro faz o upload da Nota Fiscal (PDF) através do Magic Link ou Portal.
4.  **Conferência:** O Administrador revisa a nota. Em caso de erro, o status muda para `DIVERGENCIA`. Se ok, o pagamento é processado.
5.  **Liquidação:** O Administrador realiza o PIX e anexa o comprovante de pagamento no sistema.
6.  **Arquivamento:** Após 6 meses de retenção ativa, os dados são preparados para o fechamento contábil.

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos
*   Node.js (v18+)
*   Python (v3.10+)
*   MySQL/MariaDB

### Backend
1. Entre na pasta `backend`.
2. Crie um ambiente virtual: `python -m venv .venv`.
3. Instale as dependências: `pip install -r requirements.txt`.
4. Configure o `.env` seguindo o `.env.example`.
5. Execute: `uvicorn main:app --reload`.

### Frontend
1. Entre na pasta `frontend`.
2. Instale as dependências: `npm install`.
3. Configure o `.env` com a URL do backend.
4. Execute: `npm run dev`.

---

## 🧪 Testes

O FluxoGuard possui uma suíte de testes automatizados para garantir a estabilidade das funcionalidades de backend e frontend.

### **Central de Testes (Recomendado)**
Na raiz do projeto, você pode usar o script interativo para rodar os testes de forma simples:
```bash
./test.sh
```
O script oferecerá as opções:
1. **Backend**: Executa o Pytest (FastAPI).
2. **Frontend**: Executa o Vitest (React).
3. **Ambos**: Executa a suíte completa.

### **Execução Manual**

#### **Backend (Pytest)**
1. Entre na pasta `backend`.
2. Execute: `python -m pytest test_main.py`
*(Nota: Os testes utilizam SQLite em memória para não afetar o banco de dados principal).*

#### **Frontend (Vitest)**
1. Entre na pasta `frontend`.
2. Execute: `npm test`

---

## 🔐 Segurança
*   **Autenticação:** Baseada em UUIDv4 e expiração controlada.
*   **Criptografia:** `AES-256-CBC` para links compartilháveis.
*   **Níveis de Acesso:** SUPERADMIN, ADMIN e PARCEIRO.

---

© 2026 FluxoGuard Team. Design focado em segurança e excelência financeira.
