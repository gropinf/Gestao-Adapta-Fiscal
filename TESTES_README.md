# 🧪 GUIA DE TESTES - Adapta Fiscal

## 🚀 INÍCIO RÁPIDO

### **1. Acessar o Sistema**

```bash
# No Replit, o servidor já está rodando!
# URL: https://[seu-projeto].replit.dev
```

**Credenciais de Teste:**
- 📧 Email: `admin@adaptafiscal.com.br`
- 🔑 Senha: `password123`

---

## 🧪 TESTES AUTOMATIZADOS

### **Opção 1: Testes Backend (Terminal)**

```bash
# Executar script de testes do banco de dados
tsx server/test-api.ts
```

**O que testa:**
- ✅ Conexão com banco
- ✅ Seeds carregados (usuários, empresas, XMLs, alertas)
- ✅ Estrutura de dados
- ✅ Integridade referencial
- ✅ Validações (CNPJs, chaves NFe, categorias)
- ✅ Estatísticas (total faturado, períodos)

**Resultado Esperado:** 21/21 testes ✅ (100%)

---

### **Opção 2: Testes de API (Navegador)**

**Acesse:**
```
https://[seu-projeto].replit.dev/diagnostico.html
```

**Como Usar:**
1. Abra a página no navegador
2. Clique em **"▶️ Executar Todos os Testes"**
3. Aguarde 30-60 segundos
4. Veja resultados em tempo real
5. Copie JSONs de testes específicos (botão "Copiar Resultado")
6. Exporte relatório completo (botão "📥 Exportar JSON")

**O que testa:**
- 🔐 Autenticação (login válido/inválido, rotas protegidas)
- 🏢 CRUD de Empresas
- 📊 CRUD de Contadores
- 📄 Listagem e filtros de XMLs
- 📥 Download de XMLs
- 🚨 Sistema de Alertas
- 🔍 Integração ReceitaWS

**Resultado Esperado:** Todos os testes em verde ✅

---

## 📋 TESTES MANUAIS (Frontend)

### **Roteiro Básico:**

#### **1. Login e Dashboard (5 min)**
- [ ] Fazer login com credenciais válidas
- [ ] Verificar dashboard carrega
- [ ] Confirmar KPIs exibidos:
  - Total de XMLs: **7**
  - Total Faturado: **R$ 13.629,90**
  - Média por Nota: **R$ 1.947,13**
- [ ] Verificar gráficos renderizando
- [ ] Conferir alertas (deve mostrar **2 alertas**)

#### **2. Multi-tenant (3 min)**
- [ ] Abrir seletor de empresas (canto superior)
- [ ] Trocar para outra empresa
- [ ] Verificar dashboard atualiza automaticamente
- [ ] Conferir XMLs da nova empresa

#### **3. Lista de XMLs (5 min)**
- [ ] Acessar página `/xmls`
- [ ] Verificar lista exibe 7 XMLs (ou quantidade da empresa)
- [ ] Testar filtro "Emitidas" (deve mostrar 5)
- [ ] Testar filtro "Recebidas" (deve mostrar 2)
- [ ] Testar busca por chave NFe
- [ ] Clicar em "Ver Detalhes" de um XML
- [ ] Conferir accordion com produtos, impostos, endereços

#### **4. Upload de XML (5 min)**
- [ ] Acessar página `/upload`
- [ ] Selecionar empresa
- [ ] Fazer upload de 1 XML válido
- [ ] Verificar progresso e mensagem de sucesso
- [ ] Conferir XML aparece na lista

#### **5. Gestão de Empresas (5 min)**
- [ ] Acessar página `/clients`
- [ ] Verificar 3+ empresas listadas
- [ ] Clicar em "Nova Empresa"
- [ ] Digitar CNPJ válido (ex: 00.000.000/0001-91)
- [ ] Verificar campos preenchem automaticamente (ReceitaWS)
- [ ] Salvar empresa
- [ ] Editar empresa
- [ ] Conferir dados atualizados

#### **6. Gestão de Contadores (3 min)**
- [ ] Acessar página `/accountants`
- [ ] Verificar 2 contadores listados
- [ ] Criar novo contador
- [ ] Associar empresas (multi-select)
- [ ] Salvar e conferir

#### **7. Sistema de Alertas (3 min)**
- [ ] Voltar ao dashboard
- [ ] Verificar card de alertas (2 alertas)
- [ ] Clicar em "Ver XML" de um alerta (se disponível)
- [ ] Clicar em "Resolver" alerta
- [ ] Conferir alerta some da lista
- [ ] Badge de contagem atualiza

#### **8. Exportação Excel (3 min)**
- [ ] Na página `/xmls`
- [ ] Clicar em "Exportar Excel Detalhado"
- [ ] Abrir arquivo baixado
- [ ] Verificar todas as colunas e dados
- [ ] Clicar em "Exportar Excel Resumo"
- [ ] Verificar totalizadores

#### **9. Responsividade (2 min)**
- [ ] Abrir DevTools (F12)
- [ ] Mudar para Mobile (375x667)
- [ ] Navegar pelo dashboard
- [ ] Conferir layout se adapta
- [ ] Testar Tablet (768x1024)

---

## 🎯 CRITÉRIOS DE ACEITE

### ✅ **Sistema APROVADO se:**
- 100% dos testes backend passarem (21/21)
- 95%+ dos testes de API passarem (16+/18)
- 90%+ dos testes manuais passarem
- 0 erros críticos (crash, perda de dados)
- UI responsiva em 3 resoluções

### ⚠️ **Atenção Necessária se:**
- 80-94% de sucesso
- Erros não-críticos detectados
- UX degradada em alguma tela

### 🔴 **Reprovado se:**
- <80% de sucesso
- Erros críticos presentes
- Funcionalidades core quebradas

---

## 📊 RESULTADOS ATUAIS

### **Testes Backend:** ✅ **100% (21/21)**
```
✅ Conexão Database
✅ Seeds completos
✅ Estrutura de dados
✅ Categorização XMLs
✅ Sistema de alertas
✅ Integridade referencial
✅ Validações
✅ Estatísticas
```

### **Testes de API:** ⏳ **Aguardando execução**
Execute em `/diagnostico.html`

### **Testes Manuais:** ⏳ **Aguardando execução**
Use checklist acima

---

## 🐛 REPORTAR PROBLEMAS

Se encontrar algum erro:

1. **Anote detalhes:**
   - O que você fez (passo a passo)
   - O que esperava acontecer
   - O que realmente aconteceu
   - Mensagem de erro (se houver)

2. **Copie informações técnicas:**
   - URL da página
   - Navegador e versão
   - Console do navegador (F12 > Console)

3. **Tire screenshot** (se visual)

4. **Informe ao desenvolvedor**

---

## 📁 ARQUIVOS DE TESTE

- `CHECKLIST_TESTES.md` - Checklist completo (162 casos de teste)
- `RESULTADOS_TESTES.md` - Resultados dos testes backend
- `client/public/diagnostico.html` - Página de testes automatizados
- `server/test-api.ts` - Script de testes backend
- `server/seeds.ts` - Script de seeds (dados de teste)

---

## 🎓 DADOS DE TESTE DISPONÍVEIS

### **Usuários:**
- admin@adaptafiscal.com.br (password123) - Admin
- editor@adaptafiscal.com.br (password123) - Editor

### **Empresas:**
- Empresa Exemplo LTDA (12.345.678/0001-90)
- Tech Solutions SA (98.765.432/0001-00)
- Comércio ABC Ltda (11.222.333/0001-44)

### **Contadores:**
- Contabilidade Silva & Associados
- Escritório Fiscal Premium

### **XMLs:**
- 7 XMLs de exemplo
- 5 Emitidas + 2 Recebidas
- 4 NFe + 3 NFCe
- Período: 29/10/2024 a 02/11/2024
- Total: R$ 13.629,90

### **Alertas:**
- 1 High severity (XML inválido)
- 1 Low severity (Informativo)

---

## ⏱️ TEMPO ESTIMADO

- **Testes Backend:** 2 min
- **Testes de API:** 1 min
- **Testes Manuais Completos:** 30 min
- **Testes Manuais Básicos:** 10 min

---

## 🚀 PRÓXIMOS PASSOS APÓS TESTES

1. ✅ Documentar resultados
2. ✅ Corrigir erros encontrados
3. ✅ Re-testar funcionalidades corrigidas
4. ✅ Validar com usuário final
5. ✅ Deploy para produção

---

**Boa sorte com os testes! 🍀**

Se tiver dúvidas, consulte a documentação completa em `/attached_assets/`.












