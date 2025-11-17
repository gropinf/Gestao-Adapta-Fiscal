# 🧪 CHECKLIST DE TESTES - Adapta Fiscal

**Data de Criação:** 03/11/2025  
**Versão:** 1.0  
**Sistema:** Gestão de XMLs Fiscais

---

## 📋 ÍNDICE DE TESTES

1. [Autenticação e Segurança](#1-autenticação-e-segurança)
2. [Gestão de Empresas (Clientes)](#2-gestão-de-empresas-clientes)
3. [Gestão de Contadores](#3-gestão-de-contadores)
4. [Upload e Processamento de XMLs](#4-upload-e-processamento-de-xmls)
5. [Visualização e Listagem de XMLs](#5-visualização-e-listagem-de-xmls)
6. [Dashboard e KPIs](#6-dashboard-e-kpis)
7. [Sistema de Alertas](#7-sistema-de-alertas)
8. [Envio de Emails](#8-envio-de-emails)
9. [Exportação Excel](#9-exportação-excel)
10. [Multi-tenant (Troca de Empresa)](#10-multi-tenant-troca-de-empresa)
11. [Integração ReceitaWS](#11-integração-receitaws)
12. [Performance e Limites](#12-performance-e-limites)

---

## 1. AUTENTICAÇÃO E SEGURANÇA

### 1.1 Login
- [ ] **T1.1.1** - Login com credenciais válidas (admin@adaptafiscal.com.br / password123)
- [ ] **T1.1.2** - Login com credenciais inválidas (deve rejeitar)
- [ ] **T1.1.3** - Login com email inexistente
- [ ] **T1.1.4** - Login com senha incorreta
- [ ] **T1.1.5** - Persistência de sessão (JWT funciona após refresh)
- [ ] **T1.1.6** - Logout funcional
- [ ] **T1.1.7** - Redirecionamento após login bem-sucedido

### 1.2 Proteção de Rotas
- [ ] **T1.2.1** - Tentar acessar /dashboard sem autenticação (deve redirecionar para login)
- [ ] **T1.2.2** - Tentar acessar /xmls sem autenticação
- [ ] **T1.2.3** - Tentar acessar APIs sem token JWT (deve retornar 401)

---

## 2. GESTÃO DE EMPRESAS (CLIENTES)

### 2.1 Listagem
- [ ] **T2.1.1** - Página /clients carrega corretamente
- [ ] **T2.1.2** - Lista exibe todas as empresas do usuário (3 empresas dos seeds)
- [ ] **T2.1.3** - Cards exibem CNPJ formatado
- [ ] **T2.1.4** - Cards exibem razão social e nome fantasia
- [ ] **T2.1.5** - Cards exibem endereço completo

### 2.2 Criação de Empresa
- [ ] **T2.2.1** - Abrir modal "Nova Empresa"
- [ ] **T2.2.2** - Validação de CNPJ (formato correto)
- [ ] **T2.2.3** - Máscara de CNPJ funcionando (##.###.###/####-##)
- [ ] **T2.2.4** - Máscara de CEP funcionando (#####-###)
- [ ] **T2.2.5** - Integração ReceitaWS ao digitar CNPJ válido
- [ ] **T2.2.6** - Campos preenchidos automaticamente após ReceitaWS
- [ ] **T2.2.7** - Salvar empresa com todos os campos obrigatórios
- [ ] **T2.2.8** - Validação de campos obrigatórios (Razão Social, CNPJ, etc)
- [ ] **T2.2.9** - Erro ao tentar criar empresa com CNPJ duplicado
- [ ] **T2.2.10** - Toast de sucesso ao criar empresa

### 2.3 Edição de Empresa
- [ ] **T2.3.1** - Abrir modal de edição
- [ ] **T2.3.2** - Campos pré-preenchidos com dados atuais
- [ ] **T2.3.3** - Alterar dados e salvar
- [ ] **T2.3.4** - Toast de sucesso ao editar
- [ ] **T2.3.5** - Dados atualizados na lista após salvar

### 2.4 Exclusão de Empresa
- [ ] **T2.4.1** - Botão de exclusão visível
- [ ] **T2.4.2** - Confirmação antes de excluir
- [ ] **T2.4.3** - Empresa removida da lista após exclusão
- [ ] **T2.4.4** - Toast de sucesso ao excluir

---

## 3. GESTÃO DE CONTADORES

### 3.1 Listagem
- [ ] **T3.1.1** - Página /accountants carrega corretamente
- [ ] **T3.1.2** - Lista exibe todos os contadores (2 dos seeds)
- [ ] **T3.1.3** - Cards exibem nome e email do contador
- [ ] **T3.1.4** - Lista de empresas associadas visível

### 3.2 Criação de Contador
- [ ] **T3.2.1** - Abrir modal "Novo Contador"
- [ ] **T3.2.2** - Validação de email
- [ ] **T3.2.3** - Multi-select de empresas funcionando
- [ ] **T3.2.4** - Salvar contador com empresas associadas
- [ ] **T3.2.5** - Toast de sucesso ao criar

### 3.3 Edição de Contador ✅ CORRIGIDO
- [x] **T3.3.1** - Abrir modal de edição (botão Edit adicionado)
- [x] **T3.3.2** - Campos pré-preenchidos
- [x] **T3.3.3** - Empresas já associadas marcadas no multi-select
- [x] **T3.3.4** - Adicionar/remover empresas
- [x] **T3.3.5** - Salvar alterações (updateMutation implementada)
- [x] **T3.3.6** - Toast de sucesso ao editar

**Status:** ✅ Funcionalidade implementada e pronta para teste manual

### 3.4 Exclusão de Contador
- [ ] **T3.4.1** - Botão de exclusão visível
- [ ] **T3.4.2** - Confirmação antes de excluir
- [ ] **T3.4.3** - Contador removido da lista
- [ ] **T3.4.4** - Toast de sucesso ao excluir

---

## 4. UPLOAD E PROCESSAMENTO DE XMLs

### 4.1 Upload Simples (1 arquivo)
- [ ] **T4.1.1** - Página /upload carrega corretamente
- [ ] **T4.1.2** - Seletor de empresa funcional
- [ ] **T4.1.3** - Dropzone aceita arquivo .xml
- [ ] **T4.1.4** - Upload de NFe válida
- [ ] **T4.1.5** - Parsing completo executado
- [ ] **T4.1.6** - XML salvo no storage (/storage/validated)
- [ ] **T4.1.7** - Registro criado no banco de dados
- [ ] **T4.1.8** - Categorização automática (emitida/recebida)
- [ ] **T4.1.9** - Toast de sucesso ao finalizar
- [ ] **T4.1.10** - Progresso visível durante upload

### 4.2 Upload Batch (múltiplos arquivos)
- [ ] **T4.2.1** - Selecionar múltiplos XMLs (5+ arquivos)
- [ ] **T4.2.2** - Todos os arquivos processados
- [ ] **T4.2.3** - Resumo de sucesso/falha exibido
- [ ] **T4.2.4** - Barra de progresso funcional

### 4.3 Validações e Erros
- [ ] **T4.3.1** - Upload de arquivo não-XML (deve rejeitar)
- [ ] **T4.3.2** - Upload de XML inválido (formato corrompido)
- [ ] **T4.3.3** - Upload de XML duplicado (mesma chave)
- [ ] **T4.3.4** - Alerta criado automaticamente para XML inválido
- [ ] **T4.3.5** - Mensagem de erro clara ao usuário
- [ ] **T4.3.6** - Upload sem selecionar empresa (deve alertar)

### 4.4 Detecção de Duplicatas
- [ ] **T4.4.1** - Tentar fazer upload do mesmo XML 2x
- [ ] **T4.4.2** - Sistema detecta duplicata no banco
- [ ] **T4.4.3** - Sistema detecta duplicata no storage
- [ ] **T4.4.4** - Mensagem informando que XML já existe

---

## 5. VISUALIZAÇÃO E LISTAGEM DE XMLs

### 5.1 Listagem
- [ ] **T5.1.1** - Página /xmls carrega corretamente
- [ ] **T5.1.2** - Lista exibe XMLs da empresa selecionada (7 XMLs dos seeds)
- [ ] **T5.1.3** - Tabela exibe chave NFe (truncada)
- [ ] **T5.1.4** - Tabela exibe data de emissão
- [ ] **T5.1.5** - Tabela exibe destinatário
- [ ] **T5.1.6** - Tabela exibe valor total formatado (R$)
- [ ] **T5.1.7** - Badge de categoria (Emitida/Recebida) visível

### 5.2 Filtros
- [ ] **T5.2.1** - Filtro por categoria (Todas/Emitida/Recebida)
- [ ] **T5.2.2** - Filtrar "Emitidas" - exibe apenas emitidas
- [ ] **T5.2.3** - Filtrar "Recebidas" - exibe apenas recebidas
- [ ] **T5.2.4** - Filtro por tipo (NFe/NFCe)
- [ ] **T5.2.5** - Busca por chave NFe
- [ ] **T5.2.6** - Busca por destinatário

### 5.3 Paginação
- [ ] **T5.3.1** - Paginação funcional (se houver mais de 10 XMLs)
- [ ] **T5.3.2** - Navegação entre páginas
- [ ] **T5.3.3** - Total de itens exibido corretamente

### 5.4 Ações
- [ ] **T5.4.1** - Botão "Ver Detalhes" funcional
- [ ] **T5.4.2** - Botão "Download" funcional
- [ ] **T5.4.3** - Download retorna arquivo .xml correto

---

## 6. DASHBOARD E KPIs

### 6.1 KPIs Gerais
- [ ] **T6.1.1** - Página /dashboard carrega corretamente
- [ ] **T6.1.2** - Card "Total de XMLs" exibe valor correto (7)
- [ ] **T6.1.3** - Card "Total Faturado" exibe soma correta
- [ ] **T6.1.4** - Card "Média por Nota" calculada corretamente
- [ ] **T6.1.5** - Valores formatados em R$

### 6.2 Gráficos
- [ ] **T6.2.1** - Gráfico de XMLs por categoria (Emitidas vs Recebidas)
- [ ] **T6.2.2** - Dados corretos no gráfico
- [ ] **T6.2.3** - Gráfico de XMLs por mês
- [ ] **T6.2.4** - Gráfico renderiza corretamente (sem erros)

### 6.3 XMLs Recentes
- [ ] **T6.3.1** - Tabela de XMLs recentes visível
- [ ] **T6.3.2** - Exibe últimos 5 XMLs
- [ ] **T6.3.3** - Ordenados por data (mais recente primeiro)

### 6.4 Multi-tenant no Dashboard
- [ ] **T6.4.1** - Trocar empresa no seletor
- [ ] **T6.4.2** - Dashboard atualiza dados automaticamente
- [ ] **T6.4.3** - KPIs refletem dados da nova empresa

---

## 7. SISTEMA DE ALERTAS

### 7.1 Card de Alertas
- [ ] **T7.1.1** - Card de alertas visível no dashboard
- [ ] **T7.1.2** - Badge com quantidade de alertas não resolvidos (2)
- [ ] **T7.1.3** - Alertas exibem ícone de severidade correto
- [ ] **T7.1.4** - Cores de severidade aplicadas (critical/high/medium/low)

### 7.2 Detalhes do Alerta
- [ ] **T7.2.1** - Título do alerta visível
- [ ] **T7.2.2** - Mensagem do alerta visível
- [ ] **T7.2.3** - Botão "Ver XML" funcional (se xmlId presente)
- [ ] **T7.2.4** - Botão "Resolver" funcional

### 7.3 Resolver Alerta
- [ ] **T7.3.1** - Clicar em "Resolver"
- [ ] **T7.3.2** - Alerta marcado como resolvido no backend
- [ ] **T7.3.3** - Alerta removido da lista de não resolvidos
- [ ] **T7.3.4** - Toast de sucesso exibido
- [ ] **T7.3.5** - Badge de contagem atualizada

### 7.4 Criação Automática de Alertas
- [ ] **T7.4.1** - Upload de XML inválido cria alerta automaticamente
- [ ] **T7.4.2** - Alerta com severity "high"
- [ ] **T7.4.3** - Upload de XML duplicado cria alerta
- [ ] **T7.4.4** - Alerta aparece no dashboard imediatamente

---

## 8. ENVIO DE EMAILS

### 8.1 Email Individual
- [ ] **T8.1.1** - Selecionar XML na lista
- [ ] **T8.1.2** - Abrir modal de envio de email
- [ ] **T8.1.3** - Campos de email preenchíveis
- [ ] **T8.1.4** - Validação de email
- [ ] **T8.1.5** - Enviar email com anexo
- [ ] **T8.1.6** - Email recebido com XML anexado
- [ ] **T8.1.7** - Template HTML profissional
- [ ] **T8.1.8** - Toast de sucesso ao enviar

### 8.2 Email em Lote (ZIP)
- [ ] **T8.2.1** - Selecionar contador
- [ ] **T8.2.2** - Filtrar XMLs por período
- [ ] **T8.2.3** - Enviar lote de XMLs
- [ ] **T8.2.4** - ZIP gerado automaticamente
- [ ] **T8.2.5** - Email recebido com ZIP anexado
- [ ] **T8.2.6** - ZIP contém todos os XMLs selecionados
- [ ] **T8.2.7** - Nomes dos arquivos no padrão correto

---

## 9. EXPORTAÇÃO EXCEL

### 9.1 Export Detalhado
- [ ] **T9.1.1** - Botão "Exportar Excel Detalhado" visível
- [ ] **T9.1.2** - Clicar e iniciar download
- [ ] **T9.1.3** - Arquivo .xlsx baixado
- [ ] **T9.1.4** - Abrir arquivo no Excel/LibreOffice
- [ ] **T9.1.5** - Todas as colunas presentes (chave, data, emitente, destinatário, valor, etc)
- [ ] **T9.1.6** - Dados corretos em cada linha
- [ ] **T9.1.7** - Formatação aplicada (cabeçalhos em negrito, bordas)

### 9.2 Export Resumo
- [ ] **T9.2.1** - Botão "Exportar Excel Resumo" visível
- [ ] **T9.2.2** - Clicar e iniciar download
- [ ] **T9.2.3** - Arquivo .xlsx baixado
- [ ] **T9.2.4** - Abrir arquivo
- [ ] **T9.2.5** - Resumo por categoria (Emitidas/Recebidas)
- [ ] **T9.2.6** - Totalizadores corretos

### 9.3 Filtros na Exportação
- [ ] **T9.3.1** - Aplicar filtro (categoria = Emitidas)
- [ ] **T9.3.2** - Exportar
- [ ] **T9.3.3** - Excel contém apenas XMLs emitidos

---

## 10. MULTI-TENANT (TROCA DE EMPRESA)

### 10.1 Seletor de Empresa
- [ ] **T10.1.1** - Seletor de empresa visível no header
- [ ] **T10.1.2** - Lista exibe todas as empresas do usuário (3)
- [ ] **T10.1.3** - Empresa atual destacada

### 10.2 Troca de Empresa
- [ ] **T10.2.1** - Selecionar outra empresa
- [ ] **T10.2.2** - Dashboard atualiza dados automaticamente
- [ ] **T10.2.3** - Lista de XMLs atualiza (exibe XMLs da nova empresa)
- [ ] **T10.2.4** - KPIs recalculados
- [ ] **T10.2.5** - Alertas da nova empresa exibidos
- [ ] **T10.2.6** - Persistência da empresa selecionada (após refresh)

### 10.3 Isolamento de Dados
- [ ] **T10.3.1** - Empresa A não vê XMLs da Empresa B
- [ ] **T10.3.2** - Empresa A não vê alertas da Empresa B
- [ ] **T10.3.3** - Upload em Empresa A não afeta Empresa B

---

## 11. INTEGRAÇÃO RECEITAWS

### 11.1 Busca por CNPJ
- [ ] **T11.1.1** - Abrir modal de nova empresa
- [ ] **T11.1.2** - Digitar CNPJ válido (ex: 00.000.000/0001-91)
- [ ] **T11.1.3** - Loader exibido durante busca
- [ ] **T11.1.4** - Dados retornados e preenchidos automaticamente:
  - Razão Social
  - Nome Fantasia
  - Logradouro
  - Número
  - Bairro
  - Cidade
  - UF
  - CEP
- [ ] **T11.1.5** - Usuário pode editar campos após preenchimento

### 11.2 Erros ReceitaWS
- [ ] **T11.2.1** - CNPJ inválido (retorna erro da API)
- [ ] **T11.2.2** - Toast de erro exibido
- [ ] **T11.2.3** - Campos permanecem editáveis

---

## 12. PERFORMANCE E LIMITES

### 12.1 Upload em Lote
- [ ] **T12.1.1** - Upload de 10 XMLs simultâneos
- [ ] **T12.1.2** - Upload de 50 XMLs simultâneos
- [ ] **T12.1.3** - Upload de 100 XMLs (limite máximo)
- [ ] **T12.1.4** - Sistema processa todos sem travar
- [ ] **T12.1.5** - Feedback de progresso durante processamento

### 12.2 Tamanho de Arquivos
- [ ] **T12.2.1** - Upload de XML grande (>5MB)
- [ ] **T12.2.2** - Sistema aceita ou rejeita conforme limite
- [ ] **T12.2.3** - Mensagem clara sobre limite de tamanho

### 12.3 Responsividade
- [ ] **T12.3.1** - Dashboard em desktop (1920x1080)
- [ ] **T12.3.2** - Dashboard em tablet (768x1024)
- [ ] **T12.3.3** - Dashboard em mobile (375x667)
- [ ] **T12.3.4** - Layout se adapta corretamente
- [ ] **T12.3.5** - Sem quebras de UI

---

## 📊 RESUMO DE TESTES

**Total de Casos de Teste:** 162

**Por Categoria:**
- Autenticação: 10 testes
- Gestão de Empresas: 18 testes
- Gestão de Contadores: 14 testes
- Upload XMLs: 18 testes
- Visualização XMLs: 17 testes
- Dashboard: 13 testes
- Alertas: 14 testes
- Emails: 15 testes
- Excel: 13 testes
- Multi-tenant: 13 testes
- ReceitaWS: 7 testes
- Performance: 10 testes

---

## ✅ CRITÉRIOS DE ACEITE

**Sistema aprovado se:**
- ✅ 100% dos testes de autenticação passarem
- ✅ 95%+ dos testes funcionais passarem
- ✅ 0 erros críticos (crash, perda de dados)
- ✅ UI responsiva em 3 resoluções
- ✅ Feedback visual em todas as ações
- ✅ Multi-tenant funcionando perfeitamente

---

**Responsável pelos Testes:** AI Assistant  
**Ambiente de Teste:** Replit Production  
**Data de Execução:** A ser definida

