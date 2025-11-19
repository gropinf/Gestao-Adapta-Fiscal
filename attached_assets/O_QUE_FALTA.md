# ⏳ O QUE FALTA IMPLEMENTAR - Baseado no Prompt Grok

**Data:** 03/11/2025  
**Referência:** Prompt original do Grok + BACKLOG_ATUALIZADO.md  
**Status Atual:** 83% MVP Completo (10/12 itens Opção B)

---

## 📊 RESUMO EXECUTIVO

```
╔═══════════════════════════════════════════════════════════════╗
║  IMPLEMENTADO:  ████████░░ 83% (10/12 itens MVP)              ║
║  FALTANDO:      ██░░░░░░░░ 17% (2 itens frontend + extras)    ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## ⏳ FALTANDO - MVP (OPÇÃO B) - 2 ITENS

### 🎨 **CATEGORIA: FRONTEND (Sprint 3)**

#### 1. Aba "Usuários Vinculados" no Cadastro de Empresa ⏳
**Status:** Backend 100% pronto, falta frontend  
**Prioridade:** 🔴 ALTA (parte do MVP)  
**Estimativa:** 1-2 horas

**O que fazer:**
- **Criar arquivo:** `client/src/components/CompanyUsersTab.tsx`
- **Funcionalidades:**
  - Tabela de usuários vinculados à empresa
  - Colunas: Nome, Email, Role, Ativo (Sim/Não), Último Acesso, Ações
  - Botão "Adicionar Usuário" (abre modal)
  - Modal com formulário:
    - Campo: Email
    - Campo: Nome (se usuário novo)
    - Campo: Role (dropdown: cliente/contabilidade)
  - Ações por usuário:
    - 📧 Reenviar link de ativação
    - 👁️ Ver detalhes
    - ✏️ Editar (role, status ativo)
    - 🗑️ Excluir vínculo

**Endpoints disponíveis (já implementados):**
```typescript
GET /api/companies/:id/users        // Lista usuários
POST /api/companies/:id/users       // Adiciona/cria usuário
DELETE /api/companies/:companyId/users/:userId  // Remove vínculo
POST /api/auth/resend-activation    // Reenvia email
```

**Integração:**
- Adicionar aba na página de **edição de empresa** (`client/src/pages/clientes.tsx`)
- Usar React Query para data fetching
- Usar React Hook Form para formulário
- Usar Dialog/Modal do Shadcn UI

---

#### 2. Sistema de Ativação de Conta (Frontend) ⏳
**Status:** Backend 100% pronto, falta frontend  
**Prioridade:** 🔴 ALTA (parte do MVP)  
**Estimativa:** 1 hora

**O que fazer:**

**A) Criar página de ativação:**
- **Arquivo:** `client/src/pages/activate.tsx`
- **Rota:** `/activate/:token`
- **Funcionalidades:**
  - Validar token ao carregar página (GET `/api/auth/activate/:token`)
  - Se token válido:
    - Mostrar nome e email do usuário (readonly)
    - Form: Senha, Confirmar Senha
    - Botão "Ativar Conta"
    - Validação: senha mínimo 6 caracteres
    - POST `/api/auth/activate` com token e senha
    - Redirect para `/login` após sucesso
  - Se token inválido/expirado:
    - Mensagem de erro
    - Botão "Solicitar novo link"
    - Campo email + POST `/api/auth/resend-activation`

**B) Adicionar link no Login:**
- Editar `client/src/pages/login.tsx`
- Adicionar link "Reenviar ativação" abaixo do form
- Modal ou página para reenvio

**Endpoints disponíveis (já implementados):**
```typescript
GET /api/auth/activate/:token       // Valida token
POST /api/auth/activate              // Ativa conta
POST /api/auth/resend-activation     // Reenvia link
```

---

## 📋 FALTANDO - REQUISITOS ADICIONAIS DO GROK

### 🔐 **CATEGORIA 1: AUTENTICAÇÃO** (1 item)

#### 3. "Esqueci Minha Senha" - Fluxo Completo ⏳
**Status:** NÃO iniciado  
**Prioridade:** 🟡 MÉDIA (não era parte do MVP Opção B)  
**Estimativa:** 2 horas (backend + frontend)

**Backend (falta):**
- **Criar endpoints:**
  - `POST /api/auth/forgot-password`
    - Recebe: email
    - Gera token de reset (UUID)
    - Expira em 1 hora
    - Envia email com link
  - `GET /api/auth/reset-password/:token`
    - Valida token de reset
    - Retorna email do usuário
  - `POST /api/auth/reset-password`
    - Recebe: token, nova senha
    - Valida token e expiração
    - Atualiza senha
    - Limpa token

- **Adicionar no schema:**
  ```typescript
  users.resetToken (varchar)
  users.resetExpiresAt (timestamp)
  ```

- **Adicionar no storage:**
  ```typescript
  getUserByResetToken(token)
  updateResetToken(userId, token, expiresAt)
  resetPassword(userId, passwordHash)
  ```

**Frontend (falta):**
- **Arquivo:** `client/src/pages/forgot-password.tsx`
- **Rota:** `/forgot-password`
- Form: Email + botão "Enviar link"

- **Arquivo:** `client/src/pages/reset-password.tsx`
- **Rota:** `/reset-password/:token`
- Form: Nova senha, Confirmar senha

- **Editar login.tsx:**
  - Adicionar link "Esqueci minha senha"

---

### 📧 **CATEGORIA 2: MONITORAMENTO DE EMAIL (IMAP)** (4 itens)

#### 4. Tabela `email_monitors` ⏳
**Status:** NÃO iniciado  
**Prioridade:** 🟡 MÉDIA  
**Estimativa:** 0.3 hora

**O que fazer:**
- **Adicionar no schema:** `shared/schema.ts`
```typescript
export const emailMonitors = pgTable("email_monitors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  password: text("password").notNull(), // Encrypted
  host: text("host").notNull(),
  port: integer("port").notNull(),
  ssl: boolean("ssl").default(true),
  active: boolean("active").default(true),
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```
- **Migration:** `npm run db:push`

---

#### 5. Página de Configuração de Monitoramento ⏳
**Status:** NÃO iniciado  
**Prioridade:** 🟡 MÉDIA  
**Estimativa:** 1.5 horas

**Backend (falta):**
- **Endpoints:**
  - `GET /api/email-monitors` - Lista monitores da empresa
  - `POST /api/email-monitors` - Cria monitor
  - `PUT /api/email-monitors/:id` - Atualiza
  - `DELETE /api/email-monitors/:id` - Remove
  - `POST /api/email-monitors/:id/test` - Testa conexão IMAP

**Frontend (falta):**
- **Arquivo:** `client/src/pages/email-monitor.tsx`
- **Rota:** `/configuracoes/email-monitor`
- Tabela de emails cadastrados
- Botão "Adicionar E-mail" (modal)
- Ações: Ativar/Desativar, Testar, Editar, Excluir

**Remover do cadastro de empresa:**
- Campo "Configure para monitoramento" (obsoleto)

---

#### 6. Implementação IMAP (Backend) ⏳
**Status:** NÃO iniciado  
**Prioridade:** 🟡 MÉDIA  
**Estimativa:** 1 hora

**O que fazer:**
- **Instalar:** `npm install imap-simple`
- **Criar arquivo:** `server/imapMonitor.ts`
- **Funções:**
  - `checkEmailAccount(monitorId)`
    - Conecta via IMAP
    - Busca emails não lidos com anexos .xml
    - Download para `/uploads/raw`
    - Processa como upload batch
    - Marca email como lido
    - Atualiza `last_checked_at`
  - `checkAllActiveMonitors()`
    - Busca todos monitores ativos
    - Executa check em cada um

---

#### 7. Cron Job para IMAP ⏳
**Status:** NÃO iniciado  
**Prioridade:** 🟡 MÉDIA  
**Estimativa:** 0.5 hora

**O que fazer:**
- **Instalar:** `npm install node-cron`
- **Editar:** `server/index.ts`
- **Configurar cron:**
```typescript
import cron from 'node-cron';
import { checkAllActiveMonitors } from './imapMonitor';

// A cada 5 minutos
cron.schedule('*/5 * * * *', async () => {
  console.log('[CRON] Verificando emails...');
  await checkAllActiveMonitors();
});
```

---

### 🌐 **CATEGORIA 3: API EXTERNA** (4 itens)

#### 8. Sistema de API Tokens ⏳
**Status:** NÃO iniciado  
**Prioridade:** 🟢 BAIXA  
**Estimativa:** 1.5 horas

**Backend (falta):**
- **Criar tabela:**
```typescript
export const apiTokens = pgTable("api_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  token: varchar("token", { length: 255 }).unique().notNull(),
  name: text("name"), // Nome descritivo
  active: boolean("active").default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

- **Endpoints:**
  - `GET /api/tokens` - Lista tokens
  - `POST /api/tokens` - Gera token
  - `DELETE /api/tokens/:id` - Revoga

**Frontend (falta):**
- **Arquivo:** `client/src/pages/api-tokens.tsx`
- **Rota:** `/configuracoes/api-tokens`
- Lista de tokens
- Botão "Gerar Token" (modal exibe token UMA VEZ)
- Ação: Revogar

---

#### 9. Endpoint Externo de Upload ⏳
**Status:** NÃO iniciado  
**Prioridade:** 🟢 BAIXA  
**Estimativa:** 1 hora

**O que fazer:**
- **Criar endpoint:** `POST /api/external/upload`
- Autenticação via Bearer token (api_tokens)
- Middleware para validar token
- Aceita múltiplos XMLs
- Retorna: `{ success, processed, skipped, errors[] }`

---

#### 10. Rate Limiting API Externa ⏳
**Status:** NÃO iniciado  
**Prioridade:** 🟢 BAIXA  
**Estimativa:** 0.3 hora

**O que fazer:**
- **Instalar:** `npm install express-rate-limit`
- **Aplicar em:** `/api/external/*`
- Limite: 100 requests/hora por token

---

#### 11. Documentação Swagger/OpenAPI ⏳
**Status:** NÃO iniciado  
**Prioridade:** 🟢 BAIXA  
**Estimativa:** 1 hora

**O que fazer:**
- **Instalar:** `npm install swagger-ui-express swagger-jsdoc`
- **Criar:** `api-docs.yaml` (OpenAPI spec)
- **Endpoint:** `GET /api-docs` (Swagger UI)
- Documentar `/api/external/upload`

---

### 👤 **CATEGORIA 4: AUDITORIA** (4 itens)

#### 12. Tabela `user_access_logs` ⏳
**Status:** NÃO iniciado  
**Prioridade:** 🟢 BAIXA  
**Estimativa:** 0.3 hora

**O que fazer:**
- **Adicionar no schema:**
```typescript
export const userAccessLogs = pgTable("user_access_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  companyId: varchar("company_id").references(() => companies.id),
  loginAt: timestamp("login_at"),
  logoutAt: timestamp("logout_at"),
  switchedCompanyAt: timestamp("switched_company_at"),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

---

#### 13. Registro de Login/Logout/Troca ⏳
**Status:** NÃO iniciado  
**Prioridade:** 🟢 BAIXA  
**Estimativa:** 0.5 hora

**O que fazer:**
- Atualizar endpoint `POST /api/auth/login`
  - Criar registro em `user_access_logs`
  - Capturar IP e User Agent
- Criar endpoint `POST /api/auth/logout`
  - Atualizar `logout_at`
- Atualizar troca de empresa
  - Criar registro com `switched_company_at`

---

#### 14. Página de Auditoria (Admin) ⏳
**Status:** NÃO iniciado  
**Prioridade:** 🟢 BAIXA  
**Estimativa:** 1 hora

**Frontend (falta):**
- **Arquivo:** `client/src/pages/auditoria.tsx`
- **Rota:** `/auditoria/acessos`
- Apenas admin
- Filtros: Usuário, Empresa, Período, Tipo
- Tabela: Usuário, Empresa, Login, Logout, Duração, IP
- Exportar para Excel

---

### 🎨 **CATEGORIA 5: UI/UX** (3 itens)

#### 15. Ícone de Perfil no Header ⏳
**Status:** NÃO iniciado  
**Prioridade:** 🟡 MÉDIA  
**Estimativa:** 0.8 hora

**O que fazer:**
- **Editar:** `client/src/components/dashboard-layout.tsx`
- **Adicionar dropdown:**
  - Nome do usuário + avatar (inicial)
  - "Meu Perfil" → `/perfil`
  - "Configurações" → `/configuracoes`
  - "Sair" → logout

- **Criar página:** `client/src/pages/perfil.tsx`
  - Form: Nome, Email, Senha
  - Endpoint: `PUT /api/users/me`

---

#### 16. Ícone de Configurações no Header ⏳
**Status:** NÃO iniciado  
**Prioridade:** 🟡 MÉDIA  
**Estimativa:** 0.4 hora

**O que fazer:**
- **Adicionar no header:** Ícone de engrenagem ⚙️
- **Dropdown com links:**
  - "Monitoramento de E-mail" → `/configuracoes/email-monitor`
  - "Tokens de API" → `/configuracoes/api-tokens`
  - "Preferências" → `/configuracoes/preferencias`
- Visível apenas para: admin e cliente

---

#### 17. Coluna "Tipo" (EMIT/DEST) na Lista de XMLs ⏳
**Status:** NÃO iniciado  
**Prioridade:** 🟡 MÉDIA  
**Estimativa:** 0.4 hora

**O que fazer:**
- **Editar:** `client/src/pages/xmls.tsx`
- **Adicionar coluna "Tipo":**
  - Badge verde "EMIT" se usuário é emitente
  - Badge azul "DEST" se usuário é destinatário
  - Lógica:
```typescript
const tipo = xml.cnpjEmitente === currentCompany.cnpj ? 'EMIT' : 'DEST';
```
- **Remover coluna:** `company_id` (não é mais relevante)

---

### 📄 **CATEGORIA 6: RECURSOS EXTRAS** (2 itens do checklist original)

#### 18. Geração de DANFE (PDF) ⏳
**Status:** NÃO iniciado (Item 4.1 do checklist)  
**Prioridade:** 🟢 BAIXA  
**Estimativa:** 1 sessão

---

#### 19. Relatório PDF ⏳
**Status:** NÃO iniciado (Item 4.3 do checklist)  
**Prioridade:** 🟢 BAIXA  
**Estimativa:** 1 sessão

---

#### 20. Validação SEFAZ ⏳
**Status:** NÃO iniciado (Item 2.6 do checklist)  
**Prioridade:** 🟢 BAIXA  
**Estimativa:** 1 sessão

---

## 📊 RESUMO POR PRIORIDADE

### 🔴 ALTA PRIORIDADE (MVP) - 2 itens
1. ⏳ Aba Usuários Vinculados (frontend) - **1-2h**
2. ⏳ Página de Ativação (frontend) - **1h**

**Total MVP:** ~2-3 horas

---

### 🟡 MÉDIA PRIORIDADE - 7 itens
3. ⏳ "Esqueci minha senha" (backend + frontend) - **2h**
4. ⏳ Tabela email_monitors - **0.3h**
5. ⏳ Página Monitoramento Email - **1.5h**
6. ⏳ Implementação IMAP - **1h**
7. ⏳ Cron Job IMAP - **0.5h**
8. ⏳ Ícone de Perfil no Header - **0.8h**
9. ⏳ Ícone de Configurações - **0.4h**
10. ⏳ Coluna Tipo (EMIT/DEST) - **0.4h**

**Total Média:** ~6.9 horas

---

### 🟢 BAIXA PRIORIDADE - 11 itens
11. ⏳ Sistema de API Tokens - **1.5h**
12. ⏳ Endpoint Externo Upload - **1h**
13. ⏳ Rate Limiting API - **0.3h**
14. ⏳ Documentação Swagger - **1h**
15. ⏳ Tabela user_access_logs - **0.3h**
16. ⏳ Registro Login/Logout - **0.5h**
17. ⏳ Página Auditoria - **1h**
18. ⏳ Geração DANFE - **1 sessão**
19. ⏳ Relatório PDF - **1 sessão**
20. ⏳ Validação SEFAZ - **1 sessão**

**Total Baixa:** ~6.6h + 3 sessões

---

## 📈 ROADMAP SUGERIDO

### 🎯 **Fase 1: Completar MVP (Prioridade)**
- Tempo: 2-3 horas
- Itens: 1, 2
- **Objetivo:** 100% do MVP Opção B funcional

### 🎯 **Fase 2: UX e Funcionalidades Médias**
- Tempo: ~7 horas
- Itens: 3, 4, 5, 6, 7, 8, 9, 10
- **Objetivo:** Sistema polido e com automações

### 🎯 **Fase 3: Recursos Avançados**
- Tempo: ~7 horas + 3 sessões
- Itens: 11-20
- **Objetivo:** Sistema completo enterprise

---

## 🎯 PRÓXIMA AÇÃO RECOMENDADA

### **IMEDIATO (para 100% MVP):**
1. Criar `CompanyUsersTab.tsx` (1-2h)
2. Criar página `/activate/:token` (1h)
3. Testar fluxo completo
4. ✅ **MVP 100% COMPLETO!**

### **DEPOIS:**
5. "Esqueci minha senha" (2h)
6. Coluna Tipo EMIT/DEST (0.4h)
7. Ícones no Header (1.2h)
8. Sistema de Email Monitor (3.3h)

---

## 📝 NOTAS IMPORTANTES

### ✅ **O que JÁ ESTÁ 100% PRONTO (testável agora):**
- Sistema de roles e permissões
- Upload automático por CNPJ
- Criação automática de empresas
- APIs de gestão de usuários
- APIs de ativação de conta
- Middleware de autorização
- Notificação ao admin
- Categorização inteligente

### ⏳ **O que FALTA (resumo):**
- 2 componentes React (MVP)
- 7 funcionalidades médias (UX + Email)
- 11 funcionalidades baixas (API Externa + Auditoria + Extras)

---

## 🎉 CONCLUSÃO

**Implementado:** 10/12 itens MVP = **83%** ✅  
**Faltando para MVP:** 2 itens frontend = **17%** ⏳  
**Extras faltando:** 18 itens opcionais 🟢

**Tempo para completar MVP:** 2-3 horas de frontend  
**Tempo para tudo:** ~16h + 3 sessões

---

**Documento criado em:** 03/11/2025  
**Baseado em:** Prompt Grok + BACKLOG_ATUALIZADO.md  
**Status:** Lista completa do que falta










