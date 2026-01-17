# 📋 ANÁLISE COMPLETA DE PENDÊNCIAS DE DESENVOLVIMENTO

**Data:** 09/01/2026  
**Analista:** Sistema de Gestão Adapta Fiscal  
**Status:** Em Análise

---

## 📊 ETAPA 1 – ANÁLISE E ORGANIZAÇÃO

### 1.1 Itens por Módulo/Função

#### **MÓDULO A: Autoatendimento e Cadastro de Empresas** 
**Itens:** 1

#### **MÓDULO B: Autenticação e Senhas**
**Itens:** 2, 6, 7

#### **MÓDULO C: Importação de XMLs de Eventos**
**Itens:** 3, 4

#### **MÓDULO D: Análise de Sequência de Notas**
**Itens:** 5

---

### 1.2 Classificação Detalhada dos Itens

#### **ITEM 1: Página de Cadastro/Autoatendimento por CNPJ**
**Módulo:** Autoatendimento e Cadastro de Empresas  
**Tipo:** 🆕 **Nova Funcionalidade / Ajuste de Usabilidade**  
**Prioridade:** **CRÍTICA** ⚠️

**Descrição:**
Criar página pública que suporte/contador acessa para:
- a) Digitar CNPJ → se já existe: mostra info + emails vinculados
- b) Se não existe: busca na ReceitaWS, mostra info, pede confirmação de inclusão
- c) Após a/b: cadastrar email (obrigatório mínimo 1) para vincular à empresa
- d) Se email novo: enviar link de ativação (cadastrar senha)
- e) Se email existe: enviar link apenas com informações
- f) Email deve conter dados da empresa

**Dependências:**
- `receitaWS.ts` (busca CNPJ) ✅
- `emailService.ts` (envio de emails) ✅
- `storage.ts` (criação de empresas/usuários) ✅
- `auth.ts` (geração de tokens de ativação) ✅

**Pontos Ambíguos:**
1. A página será pública ou requer algum token de acesso compartilhado pelo suporte?
2. Quando email já existe, o link deve simplesmente informar ou também permitir alguma ação?
3. O usuário precisa estar autenticado para acessar essa página?
4. Qual a URL sugerida? `/cadastro-empresa` ou `/public/check-company`?

---

#### **ITEM 2: Email de Validação ao Cadastrar Usuário**
**Módulo:** Autenticação  
**Tipo:** 🐛 **Bug / Ajuste de Regra**  
**Prioridade:** **IMPORTANTE** ⚠️

**Descrição:**
Ao cadastrar usuário (qualquer fluxo), enviar email para validação contendo:
- Link de ativação
- Informações do app/sistema

**Situação Atual:**
- ✅ Sistema já tem tokens de ativação (`activationToken`, `activationExpiresAt`)
- ✅ Página `/activate` existe
- ❌ Não envia email ao cadastrar usuário via `POST /api/auth/register`
- ❌ Não envia email ao criar usuário via admin (`POST /api/users`)

**Dependências:**
- `emailService.ts` ✅
- Sistema de templates de email ✅

**Pontos Ambíguos:**
1. O email deve ser enviado apenas no registro público ou também quando admin cria usuário?
2. Quais informações do app devem constar no email? (URL do sistema, nome do sistema, etc.)

---

#### **ITEM 3: Verificar Importação de XMLs de Inutilização**
**Módulo:** Importação de XMLs  
**Tipo:** 🧪 **Teste / Verificação**  
**Prioridade:** **IMPORTANTE** ⚠️

**Descrição:**
Verificar se XMLs de inutilização estão sendo importados corretamente.

**Situação Atual:**
- ✅ Parser de inutilização existe (`xmlEventParser.ts`)
- ✅ Endpoint de upload de eventos existe (`POST /api/xml-events/upload`)
- ✅ Tabela `xml_events` suporta inutilizações
- ❓ **PRECISA TESTAR:** Se está funcionando end-to-end

**Dependências:**
- `xmlEventParser.ts` ✅
- `xmlStorageService.ts` ✅
- `storage.ts` (createXmlEvent) ✅

---

#### **ITEM 4: Verificar Importação de XMLs de Carta de Correção**
**Módulo:** Importação de XMLs  
**Tipo:** 🧪 **Teste / Verificação**  
**Prioridade:** **IMPORTANTE** ⚠️

**Descrição:**
Verificar se XMLs de carta de correção estão sendo importados corretamente.

**Situação Atual:**
- ✅ Parser de carta de correção existe (`xmlEventParser.ts`)
- ✅ Endpoint de upload de eventos existe
- ✅ Tabela `xml_events` suporta `tipoEvento: "carta_correcao"`
- ❓ **PRECISA TESTAR:** Se está funcionando end-to-end

**Dependências:**
- Mesmas do item 3

---

#### **ITEM 5: Verificação de Numeração Considerar Inutilização**
**Módulo:** Análise de Sequência  
**Tipo:** ✅ **VERIFICADO - JÁ IMPLEMENTADO**  
**Prioridade:** **TESTE NECESSÁRIO** ⚠️

**Descrição:**
Na verificação de numeração, levar em conta inutilizações.

**Situação Atual:**
- ✅ Endpoint `/api/xmls/sequence-analysis` já busca inutilizações
- ✅ Já filtra inutilizações por modelo e série
- ✅ Já marca números inutilizados na sequência
- ✅ Já calcula `totalInutilizadas` no resumo
- ❓ **PRECISA TESTAR:** Se está funcionando corretamente

**Código Relevante:**
```1391:1500:server/routes.ts
// Get inutilizações for the period
const allEvents = await storage.getXmlEventsByPeriod(
  companyId as string,
  periodStart as string,
  periodEnd as string
);

const inutilizacoes = allEvents.filter(e => 
  e.tipoEvento === "inutilizacao" && 
  e.modelo === modelo &&
  (!serie || e.serie === serie)
);
// ... verifica se número está inutilizado antes de marcar como faltante
```

**Dependências:**
- `storage.getXmlEventsByPeriod()` ✅

---

#### **ITEM 6: Verificar Rotina Trocar Senha**
**Módulo:** Autenticação  
**Tipo:** 🧪 **Teste / Verificação**  
**Prioridade:** **IMPORTANTE** ⚠️

**Descrição:**
Testar funcionalidade de trocar senha do perfil.

**Situação Atual:**
- ✅ Página `/perfil` existe com formulário de troca de senha
- ✅ Endpoint `PUT /api/users/me` suporta atualização de senha
- ✅ Valida senha atual obrigatória
- ✅ Valida mínimo de 6 caracteres
- ❓ **PRECISA TESTAR:** Fluxo completo end-to-end

**Dependências:**
- `routes.ts` (PUT /api/users/me) ✅
- `storage.ts` (updateUser) ✅
- `auth.ts` (comparePassword, hashPassword) ✅

---

#### **ITEM 7: Verificar Rotina Esqueci Minha Senha**
**Módulo:** Autenticação  
**Tipo:** 🧪 **Teste / Verificação**  
**Prioridade:** **IMPORTANTE** ⚠️

**Descrição:**
Testar funcionalidade de recuperação de senha.

**Situação Atual:**
- ✅ Página `/forgot-password` existe
- ✅ Página `/reset-password/:token` existe
- ✅ Endpoint `POST /api/auth/forgot-password` existe
- ✅ Endpoint `POST /api/auth/reset-password` existe
- ✅ Sistema de tokens de reset existe
- ❓ **PRECISA TESTAR:** Fluxo completo end-to-end

**Dependências:**
- `routes.ts` (forgot-password, reset-password) ✅
- `storage.ts` (setPasswordResetToken, getUserByResetToken, resetPassword) ✅
- `emailService.ts` (envio de email) ✅

---

### 1.3 Identificação de Dependências entre Módulos

```
MÓDULO A (Item 1)
├── Módulo B (gera token de ativação)
├── ReceitaWS (busca CNPJ)
├── EmailService (envio de emails)
└── Storage (empresas/usuários)

MÓDULO B (Items 2, 6, 7)
├── EmailService (envio de emails)
└── Storage (usuários)

MÓDULO C (Items 3, 4)
├── XMLParser (parse de eventos)
├── XMLStorage (armazenamento)
└── Storage (persistência)

MÓDULO D (Item 5)
└── Módulo C (dados de inutilização)
```

---

### 1.4 Dúvidas e Pontos Ambíguos

#### **Dúvidas Críticas (Item 1):**

1. **Autenticação da Página Pública:**
   - A página será completamente pública ou requer token compartilhado?
   - Sugestão: Página pública com validação de rate limiting

2. **Comportamento quando email já existe:**
   - O link apenas informa ou permite alguma ação?
   - Sugestão: Link informa dados da empresa e permite vincular à conta existente

3. **Fluxo de vinculação:**
   - Se email já existe, como vincular empresa ao usuário?
   - Sugestão: Criar vínculo automático em `company_users`

4. **URL da página:**
   - Qual URL usar?
   - Sugestão: `/public/cadastro-empresa` ou `/cadastro-empresa`

#### **Dúvidas Secundárias (Item 2):**

5. **Quando enviar email:**
   - Apenas registro público ou também criação por admin?
   - Sugestão: Sempre que usuário é criado com `active: false`

6. **Conteúdo do email:**
   - Quais informações do app incluir?
   - Sugestão: Nome do sistema, URL, dados de acesso

---

## 📋 ETAPA 2 – PLANEJAMENTO

### 2.1 Checklist Técnico de Implementação

#### **ITEM 1: Página de Cadastro/Autoatendimento**

- [ ] **Backend:**
  - [ ] Criar endpoint `POST /api/public/check-cnpj` (busca CNPJ e verifica se existe)
  - [ ] Criar endpoint `POST /api/public/create-company` (cria empresa após confirmação)
  - [ ] Criar endpoint `POST /api/public/link-email` (vincula email à empresa)
  - [ ] Implementar lógica de verificação de email existente
  - [ ] Gerar token de ativação para emails novos
  - [ ] Enviar email com link de ativação ou informações
  - [ ] Criar template de email com dados da empresa

- [ ] **Frontend:**
  - [ ] Criar página `/public/cadastro-empresa` (ou `/cadastro-empresa`)
  - [ ] Formulário de entrada de CNPJ
  - [ ] Exibição de informações da empresa (se existe ou busca ReceitaWS)
  - [ ] Modal/Seção de confirmação de criação (se não existe)
  - [ ] Formulário de cadastro de emails (mínimo 1 obrigatório)
  - [ ] Botão "Copiar Resultado" em cada seção (conforme memória)
  - [ ] Feedback visual de sucesso/erro
  - [ ] Validação de CNPJ
  - [ ] Validação de emails

- [ ] **Integrações:**
  - [ ] Integrar com `receitaWS.ts` para busca de CNPJ
  - [ ] Integrar com `emailService.ts` para envio
  - [ ] Integrar com `storage.ts` para criação

- [ ] **Segurança:**
  - [ ] Rate limiting na página pública
  - [ ] Validação de CNPJ no backend
  - [ ] Sanitização de dados

---

#### **ITEM 2: Email de Validação ao Cadastrar**

- [ ] **Backend:**
  - [ ] Modificar `POST /api/auth/register` para enviar email
  - [ ] Modificar `POST /api/users` (criação por admin) para enviar email
  - [ ] Criar template de email de ativação com informações do app
  - [ ] Gerar token de ativação (se não existe)
  - [ ] Enviar email com link de ativação

- [ ] **Frontend:**
  - [ ] (Nenhuma alteração necessária - apenas backend)

- [ ] **Email Template:**
  - [ ] Incluir nome do sistema
  - [ ] Incluir URL do sistema
  - [ ] Incluir instruções de ativação
  - [ ] Incluir dados de acesso (email)

---

#### **ITEMS 3 e 4: Testes de Importação**

- [ ] **Testes:**
  - [ ] Preparar XML de inutilização de teste
  - [ ] Preparar XML de carta de correção de teste
  - [ ] Testar upload via endpoint `POST /api/xml-events/upload`
  - [ ] Verificar se dados foram salvos corretamente
  - [ ] Verificar se arquivo foi salvo no storage
  - [ ] Verificar se pode ser recuperado via `GET /api/xml-events`

---

#### **ITEM 5: Teste de Verificação de Numeração**

- [ ] **Testes:**
  - [ ] Criar cenário com notas emitidas
  - [ ] Criar inutilização que cobre algumas notas
  - [ ] Chamar endpoint `GET /api/xmls/sequence-analysis`
  - [ ] Verificar se inutilizações aparecem corretamente
  - [ ] Verificar se números inutilizados não aparecem como faltantes
  - [ ] Verificar cálculo de `totalInutilizadas`

---

#### **ITEMS 6 e 7: Testes de Senha**

- [ ] **Item 6 - Trocar Senha:**
  - [ ] Fazer login
  - [ ] Ir para `/perfil`
  - [ ] Preencher senha atual
  - [ ] Preencher nova senha
  - [ ] Confirmar nova senha
  - [ ] Salvar
  - [ ] Fazer logout
  - [ ] Fazer login com nova senha
  - [ ] Verificar se funcionou

- [ ] **Item 7 - Esqueci Minha Senha:**
  - [ ] Ir para `/forgot-password`
  - [ ] Digitar email
  - [ ] Verificar se email foi recebido
  - [ ] Clicar no link do email
  - [ ] Verificar se abriu `/reset-password/:token`
  - [ ] Digitar nova senha
  - [ ] Confirmar nova senha
  - [ ] Salvar
  - [ ] Fazer login com nova senha
  - [ ] Verificar se funcionou

---

### 2.2 Backlog Priorizado

#### **🔴 CRÍTICO (Fazer Primeiro)**

1. **ITEM 1** - Página de Cadastro/Autoatendimento
   - Impacto: Alto (nova funcionalidade solicitada)
   - Complexidade: Alta
   - Tempo estimado: 4-6 horas

#### **🟡 IMPORTANTE (Fazer Depois)**

2. **ITEM 2** - Email de Validação ao Cadastrar
   - Impacto: Médio (melhora UX)
   - Complexidade: Baixa
   - Tempo estimado: 1-2 horas

3. **ITEM 3** - Teste Importação Inutilização
   - Impacto: Médio (garantir qualidade)
   - Complexidade: Baixa
   - Tempo estimado: 0.5-1 hora

4. **ITEM 4** - Teste Importação Carta Correção
   - Impacto: Médio (garantir qualidade)
   - Complexidade: Baixa
   - Tempo estimado: 0.5-1 hora

5. **ITEM 5** - Teste Verificação Numeração
   - Impacto: Médio (garantir qualidade)
   - Complexidade: Baixa
   - Tempo estimado: 0.5-1 hora

6. **ITEM 6** - Teste Trocar Senha
   - Impacto: Médio (garantir qualidade)
   - Complexidade: Baixa
   - Tempo estimado: 0.5-1 hora

7. **ITEM 7** - Teste Esqueci Minha Senha
   - Impacto: Médio (garantir qualidade)
   - Complexidade: Baixa
   - Tempo estimado: 0.5-1 hora

#### **🟢 DESEJÁVEL (Fazer Por Último)**

- Nenhum item nesta categoria no momento.

---

### 2.3 Comportamento Esperado de Cada Correção

#### **ITEM 1 - Página de Cadastro/Autoatendimento:**

**Comportamento Esperado:**

1. Usuário acessa página pública `/cadastro-empresa`
2. Digita CNPJ (formato livre, sistema limpa)
3. Sistema verifica se CNPJ já existe no banco:
   - **Se existe:**
     - Mostra informações da empresa (razão social, CNPJ, endereço)
     - Lista emails já vinculados
     - Permite adicionar novos emails
   - **Se não existe:**
     - Busca na ReceitaWS
     - Mostra informações encontradas
     - Solicita confirmação para criar empresa
     - Após confirmação, cria empresa
4. Após empresa existir (seja cadastrada ou já existente):
   - Formulário para cadastrar emails
   - Validação: mínimo 1 email obrigatório
   - Para cada email:
     - Verifica se email já existe no sistema
     - **Se não existe:**
       - Gera token de ativação
       - Cria usuário com `active: false`
       - Vincula usuário à empresa
       - Envia email com link de ativação e dados da empresa
     - **Se existe:**
       - Vincula usuário existente à empresa
       - Envia email informativo com dados da empresa (sem link de ativação)
5. Feedback de sucesso ao final

---

#### **ITEM 2 - Email de Validação ao Cadastrar:**

**Comportamento Esperado:**

1. Quando usuário é criado (qualquer fluxo):
   - Se `active: false` (padrão):
     - Gera token de ativação (se não existe)
     - Envia email com:
       - Link de ativação (`/activate/:token`)
       - Nome do sistema (Adapta Fiscal)
       - URL do sistema
       - Email cadastrado
       - Instruções de ativação
2. Email deve ser enviado mesmo se usuário for criado por admin

---

#### **ITEMS 3 e 4 - Testes de Importação:**

**Comportamento Esperado:**

1. Upload de XML de inutilização:
   - XML é validado
   - É parseado corretamente
   - Dados são salvos em `xml_events` com `tipoEvento: "inutilizacao"`
   - Arquivo é salvo no storage
   - Retorna sucesso

2. Upload de XML de carta de correção:
   - XML é validado
   - É parseado corretamente
   - Dados são salvos em `xml_events` com `tipoEvento: "carta_correcao"`
   - Arquivo é salvo no storage
   - Retorna sucesso

---

#### **ITEM 5 - Teste Verificação Numeração:**

**Comportamento Esperado:**

1. Sistema possui notas emitidas (ex: 1-100)
2. Sistema possui inutilização (ex: números 50-60)
3. Ao chamar análise de sequência:
   - Números 50-60 aparecem como "inutilizada"
   - Números 50-60 NÃO aparecem como "faltante"
   - `totalInutilizadas` está correto (11 no exemplo)
   - Outros números faltantes são identificados corretamente

---

#### **ITEMS 6 e 7 - Testes de Senha:**

**Item 6 - Trocar Senha:**
- Usuário logado consegue trocar senha no perfil
- Nova senha funciona no login

**Item 7 - Esqueci Minha Senha:**
- Email é recebido
- Link funciona
- Nova senha pode ser definida
- Nova senha funciona no login

---

## ⏸️ AGUARDANDO VALIDAÇÃO

**Dúvidas que precisam ser respondidas antes da implementação:**

1. **ITEM 1 - Página Pública:**
   - A página será pública ou requer token?
   - Qual URL usar?
   - Comportamento quando email já existe (apenas informa ou permite ação)?

2. **ITEM 2 - Email de Validação:**
   - Enviar apenas no registro público ou também na criação por admin?

---

## 📝 PRÓXIMOS PASSOS

Após validação das dúvidas:

1. ✅ Implementar Item 1 (CRÍTICO)
2. ✅ Implementar Item 2 (IMPORTANTE)
3. ✅ Executar testes dos Items 3-7
4. ✅ Documentar resultados
5. ✅ Atualizar documentação

---

**Status:** ⏸️ **AGUARDANDO VALIDAÇÃO DAS DÚVIDAS**
