# 🧪 Guia de Teste - Aba "Usuários Vinculados"

**Data:** 04/11/2025  
**Funcionalidade:** Gestão de usuários vinculados a empresas  
**Status:** ✅ Integração Completa

---

## 📋 O QUE FOI IMPLEMENTADO

### ✅ Backend (3 rotas API)
1. `GET /api/companies/:id/users` - Lista usuários vinculados
2. `POST /api/companies/:id/users` - Adiciona/cria usuário
3. `DELETE /api/companies/:companyId/users/:userId` - Remove vínculo

### ✅ Frontend (2 componentes)
1. `CompanyUsersTab.tsx` - Aba de gestão de usuários
2. `CompanyEditDialog.tsx` - Dialog com sistema de abas

### ✅ Integração
- Página `clientes.tsx` agora usa o novo componente com abas
- Modo de edição: mostra sistema de abas
- Modo de criação: mantém dialog simples

---

## 🧪 ROTEIRO DE TESTES

### Teste 1: Visualizar Aba de Usuários Vinculados

**Passo a passo:**
1. Faça login no sistema como **admin**
2. Navegue até **Clientes**
3. Clique no botão **Editar** de qualquer empresa
4. **ESPERADO:** Dialog abre com 2 abas:
   - 📋 Dados da Empresa
   - 👥 Usuários Vinculados
5. Clique na aba **"Usuários Vinculados"**
6. **ESPERADO:** Tabela com colunas:
   - Nome
   - Email
   - Role
   - Status (Ativo/Aguardando Ativação)
   - Último Acesso
   - Ações

✅ **Resultado esperado:** Você deve ver a nova aba que ANTES não existia!

---

### Teste 2: Adicionar Usuário Existente

**Passo a passo:**
1. Na aba "Usuários Vinculados", clique em **"Adicionar Usuário"**
2. Digite um email de usuário que JÁ EXISTE no sistema
3. Selecione uma Role (Cliente ou Contabilidade)
4. Clique em **"Adicionar"**
5. **ESPERADO:** 
   - Toast: "Usuário vinculado!"
   - Usuário aparece na tabela
   - Não envia email (usuário já existe)

---

### Teste 3: Criar Novo Usuário

**Passo a passo:**
1. Clique em **"Adicionar Usuário"**
2. Digite um email que NÃO EXISTE no sistema
3. Digite o nome do novo usuário
4. Selecione uma Role
5. Clique em **"Adicionar"**
6. **ESPERADO:**
   - Toast: "Usuário criado! Email de ativação enviado"
   - Usuário aparece na tabela com status "Aguardando Ativação"
   - Email de ativação enviado

---

### Teste 4: Reenviar Email de Ativação

**Passo a passo:**
1. Encontre um usuário com status "Aguardando Ativação"
2. Clique no botão **"Reenviar"** (ícone de envelope)
3. **ESPERADO:**
   - Toast: "Email reenviado!"
   - Novo link de ativação enviado para o email

---

### Teste 5: Remover Vínculo

**Passo a passo:**
1. Clique no ícone de **lixeira** ao lado de qualquer usuário
2. Confirme a exclusão no dialog
3. **ESPERADO:**
   - Toast: "Usuário removido"
   - Usuário desaparece da tabela
   - **IMPORTANTE:** O usuário NÃO é deletado do sistema, apenas o vínculo é removido

---

### Teste 6: Criar Novo Cliente (Sem Abas)

**Passo a passo:**
1. Na página de Clientes, clique em **"Novo Cliente"**
2. **ESPERADO:**
   - Dialog simples abre (SEM abas)
   - Apenas formulário de cadastro
   - Botão "Salvar Cliente"

✅ **Isso é correto!** No modo de CRIAÇÃO não faz sentido ter aba de usuários (empresa ainda não existe).

---

## 🔍 CHECKLIST DE VALIDAÇÃO

Marque conforme testar:

- [ ] Aba "Usuários Vinculados" aparece ao editar empresa
- [ ] Tabela de usuários é exibida corretamente
- [ ] Botão "Adicionar Usuário" funciona
- [ ] Modal de adicionar usuário abre corretamente
- [ ] Adicionar usuário existente vincula corretamente
- [ ] Criar novo usuário envia email de ativação
- [ ] Badge de status (Ativo/Aguardando) aparece corretamente
- [ ] Último acesso é exibido corretamente
- [ ] Botão "Reenviar" email funciona
- [ ] Remover vínculo funciona
- [ ] Dialog de confirmação de remoção aparece
- [ ] Novo cliente continua abrindo dialog simples (sem abas)

---

## 🎯 DIFERENÇAS ANTES vs DEPOIS

### ❌ ANTES (Ontem)
- Clicar em "Editar Cliente" → Dialog simples
- Apenas formulário de dados da empresa
- **Não havia como** vincular usuários à empresa

### ✅ AGORA
- Clicar em "Editar Cliente" → Dialog com 2 abas
- Aba 1: Dados da Empresa (igual a antes)
- Aba 2: **NOVA!** Usuários Vinculados
- Gestão completa de usuários por empresa

---

## 🐛 POSSÍVEIS PROBLEMAS

Se algo não funcionar, verifique:

1. **Servidor rodando?** `npm run dev`
2. **Usuário é admin?** Apenas admin pode acessar a aba
3. **Cache do navegador?** Ctrl+Shift+R (hard refresh)
4. **Console do navegador?** F12 → Console (verifique erros)

---

## 📊 ENDPOINTS USADOS

A aba faz chamadas para:

```
GET    /api/companies/{id}/users          → Lista usuários
POST   /api/companies/{id}/users          → Adiciona/cria usuário
DELETE /api/companies/{id}/users/{userId} → Remove vínculo
POST   /api/auth/resend-activation        → Reenvia email
```

---

## ✅ CONCLUSÃO

A funcionalidade está **100% INTEGRADA**. Todos os componentes foram criados e conectados corretamente. Agora quando você abrir o sistema e editar uma empresa, verá a nova aba "Usuários Vinculados".

**Autor:** AI Assistant  
**Data:** 04/11/2025








