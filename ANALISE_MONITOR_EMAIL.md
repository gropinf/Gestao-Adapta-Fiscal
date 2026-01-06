# Análise do Monitor de Email - Adapta Fiscal

## 📋 Resumo Executivo

O **Monitor de Email** é uma funcionalidade que conecta-se automaticamente a caixas de entrada configuradas (via IMAP) e faz download de arquivos XML anexados. O sistema verifica periodicamente por novos emails e processa os XMLs encontrados.

**Problema Identificado:** A funcionalidade está implementada como **por empresa**, mas deveria ser **GLOBAL** e acessível apenas para usuários com perfil **admin**.

---

## 🔍 Como Funciona Atualmente

### 1. **Estrutura de Dados**

O monitor de email está vinculado a uma empresa no banco de dados:

```typescript
// shared/schema.ts
export const emailMonitors = pgTable("email_monitors", {
  id: varchar("id").primaryKey(),
  companyId: varchar("company_id").notNull().references(() => companies.id), // ❌ PROBLEMA: Vinculado a empresa
  email: varchar("email").notNull(),
  password: text("password").notNull(),
  host: varchar("host").notNull(),
  port: integer("port").notNull(),
  ssl: boolean("ssl").default(true),
  active: boolean("active").default(true),
  monitorSince: timestamp("monitor_since"),
  lastCheckedAt: timestamp("last_checked_at"),
  lastEmailId: text("last_email_id"),
  checkIntervalMinutes: integer("check_interval_minutes").default(15),
  // ...
});
```

### 2. **Rotas da API**

#### GET `/api/email-monitors` - Listar monitores
- **Acesso:** Qualquer usuário autenticado
- **Comportamento:** Lista monitores **por empresa** (`companyId` obrigatório)
- **Código:**
```typescript
app.get("/api/email-monitors", authMiddleware, async (req: AuthRequest, res) => {
  const { companyId } = req.query;
  if (!companyId) {
    return res.status(400).json({ error: "Company ID is required" });
  }
  const monitors = await storage.getEmailMonitorsByCompany(companyId as string);
  res.json(monitors);
});
```

#### POST `/api/email-monitors` - Criar monitor
- **Acesso:** ✅ Apenas admin (`isAdmin`)
- **Comportamento:** Cria monitor vinculado a uma empresa

#### PUT `/api/email-monitors/:id` - Atualizar monitor
- **Acesso:** ✅ Apenas admin (`isAdmin`)

#### DELETE `/api/email-monitors/:id` - Deletar monitor
- **Acesso:** ✅ Apenas admin (`isAdmin`)

#### POST `/api/email-monitors/:id/check` - Verificar emails manualmente
- **Acesso:** ✅ Apenas admin (`isAdmin`)

### 3. **Processamento de Emails**

O serviço `emailMonitorService.ts` processa emails da seguinte forma:

1. **Busca monitores ativos:** Usa `getAllActiveEmailMonitors()` - busca **TODOS** os monitores ativos, independente da empresa
2. **Conecta ao email:** Via IMAP
3. **Processa anexos XML:** Para cada XML encontrado:
   - Valida se é NFe/NFCe válido
   - Verifica duplicatas pela chave
   - **Busca ou cria empresa automaticamente** pelo CNPJ do emitente (`getOrCreateCompanyByCnpj`)
   - Determina categoria (emitida/recebida) baseado nos CNPJs do usuário logado
   - Salva XML no storage e no banco

**Observação Importante:** O processamento já é **GLOBAL** - processa XMLs de qualquer empresa, criando empresas automaticamente se necessário. O problema é apenas na **interface e controle de acesso**.

### 4. **Interface Frontend**

#### Página: `/configuracoes/email-monitor`
- **Acesso:** ❌ Aparece para **todos os usuários** no menu
- **Comportamento:** Mostra monitores apenas da empresa selecionada (`currentCompanyId`)
- **Componente:** `EmailMonitorList` recebe `companyId` como prop

#### Menu Lateral
- **Item:** "Monitor de Email" aparece para todos os usuários
- **Sem controle de acesso:** Não há verificação de `adminOnly` como em "Auditoria de Acessos"

---

## ⚠️ Problemas Identificados

### 1. **Controle de Acesso Inconsistente**
- ✅ Backend: Rotas de criação/edição/deleção exigem `isAdmin`
- ❌ Frontend: Página aparece no menu para todos os usuários
- ❌ Frontend: Usuários não-admin podem ver a página (mesmo que não consigam criar/editar)

### 2. **Funcionalidade por Empresa vs Global**
- ❌ **Banco de dados:** Monitor vinculado a `companyId`
- ❌ **API GET:** Lista monitores por empresa
- ❌ **Frontend:** Mostra monitores apenas da empresa selecionada
- ✅ **Processamento:** Já é global (processa XMLs de qualquer empresa)

### 3. **Lógica de Negócio Incorreta**
- O monitor deveria processar XMLs **independente da empresa logada**
- Os XMLs são associados às empresas automaticamente pelo CNPJ do emitente
- Não faz sentido ter um monitor "por empresa" quando o processamento é global

---

## ✅ Solução Proposta

### 1. **Tornar Monitor de Email Global**
- Remover `companyId` da tabela `email_monitors` (ou torná-lo opcional/nullable)
- Modificar API GET para listar **todos** os monitores (apenas admin)
- Modificar frontend para não filtrar por empresa

### 2. **Restringir Acesso Apenas para Admin**
- Adicionar `adminOnly: true` no menu item
- Adicionar verificação de perfil na página
- Manter `isAdmin` nas rotas do backend (já está correto)

### 3. **Atualizar Interface**
- Remover dependência de `companyId` no componente `EmailMonitorList`
- Mostrar todos os monitores cadastrados (apenas admin pode ver)

---

## 👥 Perfis de Usuário do Sistema

### Perfis Identificados no Código

#### 1. **`admin`** - Administrador
- **Acesso:** Total ao sistema
- **Permissões:**
  - ✅ Criar/editar/deletar empresas
  - ✅ Criar/editar/deletar contabilidades
  - ✅ Criar/editar/deletar usuários
  - ✅ Criar/editar/deletar monitores de email
  - ✅ Acessar auditoria de acessos
  - ✅ Aprovar/rejeitar solicitações de acesso
  - ✅ Acessar todas as empresas (sem restrição)

**Uso no código:**
```typescript
// middleware/authorization.ts
if (req.userRole !== "admin") {
  return res.status(403).json({ error: "Acesso negado" });
}
```

#### 2. **`cliente`** - Cliente
- **Acesso:** Apenas às empresas vinculadas
- **Permissões:**
  - ✅ Visualizar XMLs das empresas vinculadas
  - ✅ Upload de XMLs
  - ✅ Análise de sequência
  - ✅ Relatórios das empresas vinculadas
  - ❌ Não pode criar empresas
  - ❌ Não pode criar monitores de email
  - ❌ Não pode acessar auditoria

**Uso no código:**
```typescript
// schema.ts
role: text("role").notNull().default("cliente")
```

#### 3. **`contabilidade`** - Contabilidade
- **Acesso:** A empresas clientes vinculadas (via `accountant_companies`)
- **Permissões:**
  - ✅ Visualizar XMLs das empresas clientes
  - ✅ Receber XMLs por email
  - ⚠️ Implementação parcial (algumas rotas ainda não verificam este perfil)

**Uso no código:**
```typescript
// schema.ts
role: text("role").notNull().default("cliente") // admin, cliente, contabilidade
```

#### 4. **`viewer`** - Visualizador (Parcialmente Implementado)
- **Status:** Definido no código mas **não utilizado** efetivamente
- **Uso:** Apenas como valor padrão em algumas rotas de criação de usuário
- **Observação:** Não há lógica específica para este perfil

**Uso no código:**
```typescript
// routes.ts - criação de usuário
const { email, password, name, role = "viewer" } = req.body;
```

---

## 📊 Tabela Comparativa de Perfis

| Funcionalidade | Admin | Cliente | Contabilidade | Viewer |
|----------------|-------|---------|---------------|--------|
| Criar empresas | ✅ | ❌ | ❌ | ❌ |
| Criar contabilidades | ✅ | ❌ | ❌ | ❌ |
| Criar usuários | ✅ | ❌ | ❌ | ❌ |
| Criar monitores de email | ✅ | ❌ | ❌ | ❌ |
| Ver XMLs próprios | ✅ | ✅ | ✅ | ❓ |
| Ver XMLs de clientes | ✅ | ❌ | ✅ | ❓ |
| Upload de XMLs | ✅ | ✅ | ❓ | ❓ |
| Análise de sequência | ✅ | ✅ | ❓ | ❓ |
| Relatórios | ✅ | ✅ | ❓ | ❓ |
| Auditoria de acessos | ✅ | ❌ | ❌ | ❌ |
| Aprovar solicitações | ✅ | ❌ | ❌ | ❌ |

**Legenda:**
- ✅ = Permitido
- ❌ = Negado
- ❓ = Não verificado/implementado

---

## 🔧 Arquivos que Precisam ser Modificados

### Backend
1. **`shared/schema.ts`**
   - Tornar `companyId` nullable ou remover da tabela `email_monitors`

2. **`server/storage.ts`**
   - Modificar `getEmailMonitorsByCompany()` para `getAllEmailMonitors()`
   - Atualizar `createEmailMonitor()` para não exigir `companyId`

3. **`server/routes.ts`**
   - Modificar GET `/api/email-monitors` para listar todos (apenas admin)
   - Remover `companyId` obrigatório

### Frontend
1. **`client/src/components/dashboard-layout.tsx`**
   - Adicionar `adminOnly: true` no item "Monitor de Email"
   - Filtrar menu items baseado no perfil do usuário

2. **`client/src/pages/email-monitor.tsx`**
   - Remover dependência de `currentCompanyId`
   - Adicionar verificação de perfil admin

3. **`client/src/components/EmailMonitorList.tsx`**
   - Remover prop `companyId`
   - Buscar todos os monitores (não filtrar por empresa)
   - Remover `companyId` do payload de criação

---

## 📝 Conclusão

O **Monitor de Email** está parcialmente implementado como funcionalidade global (no processamento), mas a interface e banco de dados ainda estão vinculados a empresas. A correção envolve:

1. ✅ **Tornar funcionalidade global** (remover vínculo com empresa)
2. ✅ **Restringir acesso apenas para admin** (frontend e backend)
3. ✅ **Manter processamento global** (já está correto)

A funcionalidade deve processar XMLs de **qualquer empresa**, associando-os automaticamente pelo CNPJ do emitente, independente da empresa que o usuário admin está visualizando no momento.


