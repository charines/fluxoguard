---
description: Jornada Completa de Onboarding (E2E)
---

Este workflow executa a jornada completa de testes de onboarding, validando a criação de Superadmins e Parceiros, além da resiliência de login.

### Passos para o Subagente:

1. **Fase 1: Semente Superadmin**
   - Acessar `http://localhost:5175`.
   - Logar como `charles@inmade.com.br` / `dpj2o75`.
   - Ir em `Painel Administrativo` -> `Configurações de Admins`.
   - Criar um **SUPERADMIN** aleatório (ex: `test-super@...`). **Importante**: Ativar o toggle "Acesso Superadmin".
   - Na tela de sucesso, ativar "Mostrar dados de acesso?" e anotar a senha gerada (**PASS_A**).
   - Deslogar.

2. **Fase 2: Fluxo do Novo Superadmin**
   - Logar com o novo e-mail e **PASS_A**.
   - Ir em `Painel Administrativo` -> `Gerenciar Parceiros`.
   - Criar um **PARCEIRO** aleatório (ex: `test-partner@...`).
   - Na tela de sucesso, ativar "Mostrar dados de acesso?" e anotar a senha gerada (**PASS_B**).
   - Deslogar.

3. **Fase 3: Validação do Parceiro**
   - Logar como o novo Parceiro. **Nota**: O identificador deve ser o **CPF/CNPJ** cadastrado.
   - Validar acesso ao dashboard de repasses.
   - Deslogar.

4. **Relatório**: Reportar todas as senhas geradas e o status de cada login.
