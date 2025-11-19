# 🧪 GUIA DE TESTES - MVP Completo

**Versão:** 1.0  
**Data:** 03/11/2025  
**Status:** Backend 100% implementado

---

## 🚀 INICIANDO TESTES

### 1. Preparação (já foi feito):
```bash
# Migration já aplicada ✅
npm run db:push

# Seeds já executados ✅
tsx server/seeds.ts
```

### 2. Iniciar servidor:
```bash
npm run dev
```

### 3. Acessar:
```
http://localhost:5000
```

---

## ✅ TESTE 1: Sistema de Roles e Permissões

### Teste como ADMIN:
1. **Login:**
   - Email: `admin@adaptafiscal.com.br`
   - Senha: `password123`
   - ✅ Deve fazer login com sucesso

2. **Cadastrar Cliente:**
   - Ir em "Clientes"
   - Clicar "Adicionar Cliente"
   - Preencher dados
   - ✅ Deve conseguir criar (apenas admin pode)

3. **Cadastrar Contabilidade:**
   - Ir em "Contabilidades"
   - Clicar "Adicionar"
   - ✅ Deve conseguir criar (apenas admin pode)

### Teste como CLIENTE:
1. **Login:**
   - Email: `cliente@adaptafiscal.com.br`
   - Senha: `password123`
   - ✅ Deve fazer login com sucesso

2. **Tentar Cadastrar Cliente:**
   - Abrir DevTools (F12) → Console
   - Tentar acessar POST `/api/companies`
   - ✅ Deve retornar erro 403 "Acesso negado"

3. **Ver apenas suas empresas:**
   - Lista de empresas deve mostrar apenas empresas vinculadas
   - ✅ Cliente não vê todas as empresas

---

## ✅ TESTE 2: Upload Automático (BREAKING CHANGE)

### Preparação:
Crie um XML de teste ou use um existente. Importante: o CNPJ do emitente NÃO deve estar cadastrado.

### Teste:
1. **Login como admin**

2. **Ir para Upload:**
   - Não é mais necessário selecionar empresa! ✨
   - Sistema identifica automaticamente

3. **Upload XML com CNPJ novo:**
   - Arrastar XML
   - Clicar "Processar"
   - ✅ Upload deve ser bem-sucedido

4. **Verificar Console do Servidor:**
```
[AUTO-CREATE] Criando empresa automaticamente para CNPJ: 12345678000190
[AUTO-CREATE] ✅ Empresa criada com sucesso: ...
[AUTO-CREATE] ✉️ Notificação enviada para admin: ...
[UPLOAD] ✨ Nova empresa criada automaticamente: ...
```

5. **Verificar no Banco de Dados:**
```sql
SELECT * FROM companies WHERE cnpj = '12345678000190';
-- Deve existir
-- status = 1 (Aguardando Liberação)
-- ativo = true
```

6. **Verificar Email (se configurado):**
   - Admin deve receber email de notificação
   - Assunto: "[Adapta Fiscal] Nova Empresa Criada Automaticamente"

---

## ✅ TESTE 3: Categorização Inteligente

### Cenário 1: Usuário é o Emitente
1. Upload XML onde `cnpj_emitente` = sua empresa
2. ✅ Categoria deve ser "emitida"
3. ✅ Deve aparecer com badge verde "EMIT"

### Cenário 2: Usuário é o Destinatário
1. Upload XML onde `cnpj_destinatario` = sua empresa
2. ✅ Categoria deve ser "recebida"
3. ✅ Deve aparecer com badge azul "DEST"

### Cenário 3: Usuário não está no XML
1. Upload XML onde CNPJ não é do usuário
2. ✅ Sistema cria empresa automaticamente
3. ✅ Vincula ao emitente
4. ✅ Categoria = "emitida"

---

## ✅ TESTE 4: Gestão de Usuários Vinculados (Backend API)

### Usando Postman/Insomnia/cURL:

### 1. Listar usuários da empresa:
```bash
GET /api/companies/{companyId}/users
Authorization: Bearer {seu_token_admin}

# Resposta esperada:
[
  {
    "id": "uuid",
    "email": "usuario@email.com",
    "name": "Nome Usuário",
    "role": "cliente",
    "active": true,
    "lastLoginAt": "2025-11-03T...",
    "createdAt": "2025-11-03T..."
  }
]
```

### 2. Adicionar usuário existente:
```bash
POST /api/companies/{companyId}/users
Authorization: Bearer {seu_token_admin}
Content-Type: application/json

{
  "email": "usuario_existente@email.com"
}

# Resposta esperada:
{
  "message": "User linked successfully",
  "user": { ... },
  "wasCreated": false
}
```

### 3. Criar novo usuário:
```bash
POST /api/companies/{companyId}/users
Authorization: Bearer {seu_token_admin}
Content-Type: application/json

{
  "email": "novo_usuario@email.com",
  "name": "Novo Usuário",
  "role": "cliente"
}

# Resposta esperada:
{
  "message": "User created and linked successfully. Activation email sent.",
  "user": { 
    "id": "uuid",
    "email": "novo_usuario@email.com",
    "name": "Novo Usuário",
    "role": "cliente",
    "active": false
  },
  "wasCreated": true
}
```

### 4. Verificar logs do servidor:
```
✉️ Email de ativação enviado (se configurado)
```

---

## ✅ TESTE 5: Sistema de Ativação (Backend API)

### 1. Validar token de ativação:
```bash
GET /api/auth/activate/{token}

# Token válido:
{
  "email": "usuario@email.com",
  "name": "Nome Usuário"
}

# Token inválido:
{
  "error": "Token inválido",
  "message": "Link de ativação inválido ou expirado"
}

# Token expirado (>24h):
{
  "error": "Token expirado",
  "message": "O link de ativação expirou. Solicite um novo link."
}
```

### 2. Ativar conta:
```bash
POST /api/auth/activate
Content-Type: application/json

{
  "token": "uuid-do-token",
  "password": "senha123"
}

# Sucesso:
{
  "message": "Conta ativada com sucesso!",
  "email": "usuario@email.com"
}
```

### 3. Fazer login com nova senha:
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "usuario@email.com",
  "password": "senha123"
}

# ✅ Deve fazer login com sucesso
```

### 4. Reenviar link de ativação:
```bash
POST /api/auth/resend-activation
Content-Type: application/json

{
  "email": "usuario@email.com"
}

# Resposta:
{
  "message": "Novo link de ativação enviado por email"
}
```

---

## ✅ TESTE 6: Login com Conta Inativa

### 1. Criar usuário inativo no banco:
```sql
INSERT INTO users (email, password_hash, name, role, active) 
VALUES ('inativo@test.com', '$2a$...', 'Teste Inativo', 'cliente', false);
```

### 2. Tentar fazer login:
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "inativo@test.com",
  "password": "qualquer_senha"
}

# Resposta esperada (403):
{
  "error": "Conta inativa",
  "message": "Sua conta precisa ser ativada. Verifique seu email ou solicite reenvio do link de ativação."
}
```

---

## ✅ TESTE 7: Middleware de Autorização

### Teste isAdmin:
```bash
# Como cliente (não admin):
POST /api/companies
Authorization: Bearer {token_cliente}

# ✅ Deve retornar 403 "Apenas administradores podem acessar este recurso"
```

### Teste canAccessCompany:
```bash
# Cliente tentando acessar empresa não vinculada:
GET /api/companies/{empresa_nao_vinculada}/users
Authorization: Bearer {token_cliente}

# ✅ Deve retornar 403 "Você não tem permissão para acessar esta empresa"

# Admin acessando qualquer empresa:
GET /api/companies/{qualquer_empresa}/users
Authorization: Bearer {token_admin}

# ✅ Deve funcionar (admin tem acesso a tudo)
```

---

## 🐛 CHECKLIST DE BUGS COMUNS

### ❌ "No token provided"
- Verificar se está enviando header: `Authorization: Bearer {token}`

### ❌ "Invalid token"
- Token pode ter expirado (7 dias)
- Fazer novo login

### ❌ "Conta inativa"
- Usuário não ativou a conta
- Verificar campo `active` no banco

### ❌ "Company ID is required" (OLD)
- Este erro NÃO deve mais aparecer no upload
- Se aparecer, verificar se código foi atualizado

### ❌ "Acesso negado"
- Verificar role do usuário
- Admin pode tudo, cliente apenas suas empresas

### ❌ Email não enviado
- Verificar configuração SMTP
- Ver logs do servidor
- Email de ativação é assíncrono (não bloqueia)

---

## 📊 QUERIES ÚTEIS PARA DEBUG

### Ver todos usuários e status:
```sql
SELECT id, email, name, role, active, activation_token IS NOT NULL as has_token
FROM users;
```

### Ver empresas criadas automaticamente:
```sql
SELECT id, cnpj, razao_social, status, ativo, created_at
FROM companies
WHERE status = 1  -- Aguardando Liberação
ORDER BY created_at DESC;
```

### Ver vínculos usuário-empresa:
```sql
SELECT 
  u.email,
  u.role,
  c.razao_social,
  cu.created_at as vinculado_em
FROM company_users cu
JOIN users u ON cu.user_id = u.id
JOIN companies c ON cu.company_id = c.id
ORDER BY cu.created_at DESC;
```

### Ver últimos logins:
```sql
SELECT email, name, role, active, last_login_at
FROM users
ORDER BY last_login_at DESC NULLS LAST;
```

---

## 🎯 CHECKLIST FINAL

Antes de considerar completo, verificar:

- [ ] ✅ Login como admin funciona
- [ ] ✅ Login como cliente funciona
- [ ] ✅ Cliente NÃO pode criar empresas (403)
- [ ] ✅ Admin PODE criar empresas (200)
- [ ] ✅ Upload sem selecionar empresa funciona
- [ ] ✅ Empresa criada automaticamente (logs)
- [ ] ✅ Notificação ao admin (logs de email)
- [ ] ✅ Categorização correta (emitida/recebida)
- [ ] ✅ API GET /companies/:id/users funciona
- [ ] ✅ API POST /companies/:id/users cria e envia email
- [ ] ✅ API GET /auth/activate/:token valida
- [ ] ✅ API POST /auth/activate ativa conta
- [ ] ✅ Login com conta inativa retorna 403
- [ ] ⏳ Componente React de usuários vinculados (FALTA)
- [ ] ⏳ Página React de ativação (FALTA)

---

## 🎉 RESULTADO ESPERADO

Se todos testes passarem:

```
✅ Sprint 1: Autenticação & Permissões - 100% FUNCIONAL
✅ Sprint 2: Processamento XML Ajustado - 100% FUNCIONAL  
✅ Sprint 3 (Backend): Gestão de Usuários - 100% FUNCIONAL
⏳ Sprint 3 (Frontend): Componentes React - PENDENTE

TOTAL: 83% do MVP Completo (10/12 itens) 🎯
```

---

**Documento gerado em:** 03/11/2025  
**Última atualização:** Backend completo  
**Próximo:** Implementar componentes frontend










