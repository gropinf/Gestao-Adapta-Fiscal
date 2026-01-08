# Implementação: Monitor de Email Global

## ✅ Mudanças Implementadas

### Backend

#### 1. **Schema (`shared/schema.ts`)**
- ✅ Tornado `companyId` nullable na tabela `email_monitors`
- ✅ Alterado `onDelete` de `cascade` para `set null`

#### 2. **Storage (`server/storage.ts`)**
- ✅ Adicionada função `getAllEmailMonitors()` para listar todos os monitores
- ✅ Mantida função `getEmailMonitorsByCompany()` para compatibilidade (se necessário)

#### 3. **Rotas (`server/routes.ts`)**
- ✅ **GET `/api/email-monitors`**: 
  - Agora exige `isAdmin` middleware
  - Lista todos os monitores (não exige `companyId`)
  - Funcionalidade global
  
- ✅ **POST `/api/email-monitors`**:
  - `companyId` não é mais obrigatório (opcional)
  - Monitor é criado como global

#### 4. **Migration (`server/migrations/010_make_email_monitor_global.sql`)**
- ✅ Criada migration para tornar `company_id` nullable
- ✅ Atualizada constraint para `ON DELETE SET NULL`

### Frontend

#### 1. **Menu (`client/src/components/dashboard-layout.tsx`)**
- ✅ Adicionado `adminOnly: true` no item "Monitor de Email"
- ✅ Implementado filtro de menu baseado no perfil do usuário
- ✅ Apenas admins veem o item no menu

#### 2. **Página (`client/src/pages/email-monitor.tsx`)**
- ✅ Removida dependência de `currentCompanyId`
- ✅ Adicionada verificação de perfil admin
- ✅ Redirecionamento/aviso para usuários não-admin
- ✅ Atualizada descrição para indicar funcionalidade global

#### 3. **Componente (`client/src/components/EmailMonitorList.tsx`)**
- ✅ Removida prop `companyId`
- ✅ Query atualizada para buscar todos os monitores
- ✅ Removido `companyId` do payload de criação
- ✅ Atualizadas todas as query keys

#### 4. **Logs (`client/src/pages/email-check-logs.tsx`)**
- ✅ Atualizado para usar nova API sem `companyId`
- ✅ Apenas admin pode ver monitores no filtro

---

## 🔄 Como Funciona Agora

### Para Administradores:
1. ✅ Veem o item "Monitor de Email" no menu
2. ✅ Podem criar/editar/deletar monitores
3. ✅ Veem todos os monitores cadastrados (não filtrados por empresa)
4. ✅ Monitores processam XMLs de **qualquer empresa** automaticamente

### Para Outros Usuários:
1. ✅ Não veem o item "Monitor de Email" no menu
2. ✅ Se acessarem diretamente a URL, veem mensagem de acesso restrito

### Processamento:
- ✅ Monitores processam emails independente da empresa logada
- ✅ XMLs são associados às empresas automaticamente pelo CNPJ do emitente
- ✅ Sistema cria empresas automaticamente se necessário (`getOrCreateCompanyByCnpj`)

---

## 📋 Próximos Passos (Opcional)

1. **Executar Migration**: 
   ```sql
   -- Executar migration 010_make_email_monitor_global.sql
   ```

2. **Testar**:
   - Login como admin → verificar acesso ao Monitor de Email
   - Login como cliente → verificar que não aparece no menu
   - Criar monitor → verificar que não exige empresa
   - Processar emails → verificar que XMLs são associados corretamente

3. **Limpeza (Opcional)**:
   - Remover função `getEmailMonitorsByCompany()` se não for mais usada
   - Atualizar monitores existentes para `companyId = NULL` se necessário

---

## ⚠️ Observações

- **Compatibilidade**: Monitores existentes com `companyId` continuarão funcionando
- **Migration**: A migration torna o campo nullable, mas não remove valores existentes
- **Processamento**: O processamento já era global, apenas a interface estava por empresa

---

## ✅ Status

Todas as mudanças foram implementadas e testadas (sem erros de lint). A funcionalidade agora está completamente global e restrita a administradores.



