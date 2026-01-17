# 🧪 TESTES - ITEMS 3 A 7

**Data:** 09/01/2026  
**Status:** Em Execução

---

## 📋 RESUMO DOS TESTES

Este documento descreve os testes práticos para validar os Items 3 a 7 das pendências de desenvolvimento.

---

## ✅ ITEM 3: TESTE DE IMPORTAÇÃO DE XMLs DE INUTILIZAÇÃO

### **Cenário de Teste:**

1. **Arquivo de teste disponível:**
   - `attached_assets/35254871800400013655001000008847000008848-procInutNFe.xml`
   - CNPJ: 48718004000136
   - Ano: 25
   - Série: 1
   - Números: 8847 a 8848
   - Modelo: 55 (NFe)

### **Comportamento Esperado:**

1. ✅ XML deve ser validado como inutilização válida
2. ✅ XML deve ser parseado corretamente
3. ✅ Dados devem ser salvos na tabela `xml_events` com:
   - `tipoEvento: "inutilizacao"`
   - `cnpj: "48718004000136"`
   - `ano: "25"`
   - `serie: "1"`
   - `numeroInicial: "8847"`
   - `numeroFinal: "8848"`
   - `modelo: "55"`
   - `justificativa: "Numeração Não Utilizada"`
   - `protocolo: "135252501610699"`
   - `dataEvento: "2025-08-29"`
   - `chaveNFe: null` (inutilização não tem chave)
   - `xmlId: null` (não está vinculado a XML específico)
4. ✅ Arquivo deve ser salvo no storage
5. ✅ Endpoint deve retornar sucesso

### **Como Testar:**

**Opção 1: Via Interface Web**
1. Fazer login no sistema
2. Ir para `/upload-eventos`
3. Selecionar arquivo `35254871800400013655001000008847000008848-procInutNFe.xml`
4. Fazer upload
5. Verificar mensagem de sucesso
6. Verificar se aparece na lista de eventos

**Opção 2: Via API (cURL)**
```bash
curl -X POST http://localhost:5000/api/xml-events/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "files=@35254871800400013655001000008847000008848-procInutNFe.xml"
```

**Opção 3: Via HTML de Teste**
1. Abrir `test-upload-eventos.html`
2. Selecionar arquivo XML de inutilização
3. Fazer upload
4. Verificar resultado

### **Verificações no Banco:**

```sql
SELECT * FROM xml_events 
WHERE tipo_evento = 'inutilizacao' 
  AND cnpj = '48718004000136'
  AND ano = '25'
  AND serie = '1'
  AND numero_inicial = '8847'
  AND numero_final = '8848';
```

**Resultado Esperado:**
- Deve retornar 1 registro
- Todos os campos devem estar preenchidos corretamente

### **Evidência de Teste:**

- ✅ **Cenário testado:** Upload de XML de inutilização
- ✅ **Resultado esperado:** XML parseado e salvo corretamente
- ⏸️ **Resultado obtido:** [Aguardando execução do teste]
- ⏸️ **Status:** [Aguardando execução]

---

## ✅ ITEM 4: TESTE DE IMPORTAÇÃO DE XMLs DE CARTA DE CORREÇÃO

### **Cenário de Teste:**

1. **Arquivo de teste necessário:**
   - XML de carta de correção (código evento 110110)
   - Formato: procEventoNFe

### **Comportamento Esperado:**

1. ✅ XML deve ser validado como evento válido
2. ✅ XML deve ser parseado corretamente
3. ✅ Dados devem ser salvos na tabela `xml_events` com:
   - `tipoEvento: "carta_correcao"`
   - `codigoEvento: "110110"`
   - `chaveNFe: "CHAVE_DA_NOTA"`
   - `correcao: "TEXTO_DA_CORREÇÃO"`
   - Campos de data, hora, protocolo, etc.
4. ✅ Arquivo deve ser salvo no storage
5. ✅ Endpoint deve retornar sucesso

### **Como Testar:**

**Opção 1: Via Interface Web**
1. Fazer login no sistema
2. Ir para `/upload-eventos`
3. Selecionar arquivo XML de carta de correção
4. Fazer upload
5. Verificar mensagem de sucesso
6. Verificar se aparece na lista de eventos com tipo "Carta de Correção"

**Opção 2: Via API (cURL)**
```bash
curl -X POST http://localhost:5000/api/xml-events/upload \
  -H "Authorization: Bearer TOKEN" \
  -F "files=@carta-correcao.xml"
```

### **Verificações no Banco:**

```sql
SELECT * FROM xml_events 
WHERE tipo_evento = 'carta_correcao'
ORDER BY created_at DESC
LIMIT 5;
```

**Resultado Esperado:**
- Deve retornar registros de carta de correção
- Campo `correcao` deve estar preenchido
- Campo `codigo_evento` deve ser "110110"

### **Evidência de Teste:**

- ✅ **Cenário testado:** Upload de XML de carta de correção
- ✅ **Resultado esperado:** XML parseado e salvo corretamente
- ⏸️ **Resultado obtido:** [Aguardando execução do teste]
- ⏸️ **Status:** [Aguardando execução]

---

## ✅ ITEM 5: TESTE DE VERIFICAÇÃO DE NUMERAÇÃO COM INUTILIZAÇÃO

### **Cenário de Teste:**

**Pré-requisitos:**
1. Empresa cadastrada com CNPJ
2. Notas fiscais emitidas (ex: números 1-100)
3. Inutilização cadastrada (ex: números 50-60)

**Setup de Teste:**
- Empresa: CNPJ 48718004000136
- Modelo: 55 (NFe)
- Série: 1
- Notas emitidas: 8840-8850 (exemplo)
- Inutilização: 8847-8848

### **Comportamento Esperado:**

1. ✅ Endpoint `/api/xmls/sequence-analysis` deve:
   - Buscar notas emitidas
   - Buscar inutilizações do período
   - Filtrar inutilizações por modelo e série
   - Marcar números 8847-8848 como "inutilizada" na sequência
   - NÃO marcar números 8847-8848 como "faltante"
   - Calcular `totalInutilizadas` corretamente (2 no exemplo)
   - Retornar sequência completa com tipos: "emitida", "inutilizada", "faltante"

2. ✅ Na interface `/analise-sequencia`:
   - Deve mostrar números 8847-8848 como "INUTILIZADAS"
   - Deve mostrar cor laranja para inutilizadas
   - Deve mostrar resumo com total de inutilizadas

### **Como Testar:**

**Opção 1: Via Interface Web**
1. Fazer login no sistema
2. Ir para `/analise-sequencia`
3. Selecionar empresa
4. Selecionar modelo: 55 (NFe)
5. Selecionar período
6. Selecionar série: 1
7. Clicar em "Analisar Sequência"
8. Verificar se números inutilizados aparecem como "INUTILIZADAS"
9. Verificar se resumo mostra `totalInutilizadas`

**Opção 2: Via API**
```bash
curl -X GET "http://localhost:5000/api/xmls/sequence-analysis?companyId=ID&modelo=55&periodStart=2025-01-01&periodEnd=2025-12-31&serie=1" \
  -H "Authorization: Bearer TOKEN"
```

### **Resultado Esperado na API:**

```json
{
  "sequence": [
    {
      "tipo": "emitida",
      "numero": 8846,
      "data": "2025-08-29",
      "chave": "...",
      "id": "..."
    },
    {
      "tipo": "inutilizada",
      "numeroInicio": 8847,
      "numeroFim": 8848,
      "data": "2025-08-29",
      "justificativa": "Numeração Não Utilizada"
    },
    {
      "tipo": "emitida",
      "numero": 8849,
      "data": "2025-08-29",
      "chave": "...",
      "id": "..."
    }
  ],
  "summary": {
    "totalEmitidas": 9,
    "totalInutilizadas": 2,
    "totalFaltantes": 0,
    "primeiroNumero": 8840,
    "ultimoNumero": 8850
  }
}
```

### **Evidência de Teste:**

- ✅ **Cenário testado:** Análise de sequência com inutilização
- ✅ **Resultado esperado:** Números inutilizados identificados corretamente
- ⏸️ **Resultado obtido:** [Aguardando execução do teste]
- ⏸️ **Status:** [Aguardando execução]

**Observação:** O código já está implementado nas linhas 1391-1500 de `server/routes.ts`. O teste verifica se está funcionando corretamente.

---

## ✅ ITEM 6: TESTE DE ROTINA TROCAR SENHA

### **Cenário de Teste:**

1. **Pré-requisitos:**
   - Usuário logado
   - Senha atual conhecida

### **Comportamento Esperado:**

1. ✅ Usuário deve conseguir acessar `/perfil`
2. ✅ Deve conseguir preencher:
   - Senha atual
   - Nova senha (mínimo 6 caracteres)
   - Confirmar nova senha
3. ✅ Validações devem funcionar:
   - Senha atual obrigatória se nova senha for preenchida
   - Nova senha deve ter mínimo 6 caracteres
   - Nova senha e confirmação devem ser iguais
4. ✅ Ao salvar:
   - Senha deve ser atualizada no banco
   - Mensagem de sucesso deve aparecer
   - Campos de senha devem ser limpos
5. ✅ Após logout:
   - Login com nova senha deve funcionar
   - Login com senha antiga deve falhar

### **Como Testar:**

**Fluxo Completo:**
1. Fazer login com senha atual
2. Ir para `/perfil`
3. Preencher "Senha Atual": [senha atual]
4. Preencher "Nova Senha": [nova senha]
5. Preencher "Confirmar Nova Senha": [nova senha]
6. Clicar em "Salvar Alterações"
7. Verificar mensagem de sucesso
8. Fazer logout
9. Tentar fazer login com senha antiga → deve falhar
10. Fazer login com nova senha → deve funcionar

**Teste de Validações:**
1. Tentar salvar sem senha atual → deve mostrar erro
2. Tentar salvar com nova senha < 6 caracteres → deve mostrar erro
3. Tentar salvar com senhas diferentes → deve mostrar erro

### **Verificações no Banco:**

```sql
-- Verificar se senha foi atualizada (hash mudou)
SELECT id, email, password_hash, updated_at 
FROM users 
WHERE email = 'usuario@email.com';
```

### **Evidência de Teste:**

- ✅ **Cenário testado:** Troca de senha no perfil
- ✅ **Resultado esperado:** Senha alterada com sucesso
- ⏸️ **Resultado obtido:** [Aguardando execução do teste]
- ⏸️ **Status:** [Aguardando execução]

---

## ✅ ITEM 7: TESTE DE ROTINA ESQUECI MINHA SENHA

### **Cenário de Teste:**

1. **Pré-requisitos:**
   - Usuário cadastrado com email válido

### **Comportamento Esperado:**

**Etapa 1: Solicitar Reset**
1. ✅ Acessar `/forgot-password`
2. ✅ Digitar email
3. ✅ Clicar em "Enviar Link de Redefinição"
4. ✅ Email deve ser recebido com:
   - Link de redefinição (`/reset-password/:token`)
   - Instruções
   - Validade de 1 hora
5. ✅ Token deve ser salvo no banco

**Etapa 2: Redefinir Senha**
1. ✅ Clicar no link do email
2. ✅ Deve abrir `/reset-password/:token`
3. ✅ Preencher nova senha
4. ✅ Preencher confirmar senha
5. ✅ Clicar em "Redefinir Senha"
6. ✅ Senha deve ser atualizada
7. ✅ Mensagem de sucesso deve aparecer
8. ✅ Redirecionamento para login após 3 segundos

**Etapa 3: Fazer Login**
1. ✅ Fazer login com nova senha → deve funcionar
2. ✅ Fazer login com senha antiga → deve falhar

### **Como Testar:**

**Fluxo Completo:**
1. Ir para `/forgot-password`
2. Digitar email: `usuario@email.com`
3. Clicar em "Enviar Link de Redefinição"
4. Verificar email recebido
5. Clicar no link do email (ou copiar e colar no navegador)
6. Preencher nova senha
7. Preencher confirmar senha
8. Clicar em "Redefinir Senha"
9. Verificar mensagem de sucesso
10. Aguardar redirecionamento ou clicar em "Ir para Login Agora"
11. Fazer login com nova senha
12. Verificar se login funcionou

**Teste de Validações:**
1. Tentar resetar sem email → deve mostrar erro
2. Tentar resetar com email inexistente → deve mostrar mensagem genérica (por segurança)
3. Tentar redefinir com senha < 6 caracteres → deve mostrar erro
4. Tentar redefinir com senhas diferentes → deve mostrar erro
5. Tentar usar token expirado → deve mostrar erro
6. Tentar usar token inválido → deve mostrar erro

### **Verificações no Banco:**

```sql
-- Verificar token de reset
SELECT id, email, reset_token, reset_expires_at 
FROM users 
WHERE email = 'usuario@email.com';

-- Verificar se token foi limpo após reset
SELECT id, email, reset_token 
FROM users 
WHERE email = 'usuario@email.com';
-- reset_token deve ser NULL após reset bem-sucedido
```

### **Evidência de Teste:**

- ✅ **Cenário testado:** Recuperação de senha (esqueci minha senha)
- ✅ **Resultado esperado:** Email enviado, link funciona, senha redefinida
- ⏸️ **Resultado obtido:** [Aguardando execução do teste]
- ⏸️ **Status:** [Aguardando execução]

---

## 📊 RESUMO DOS TESTES

| Item | Descrição | Status | Observações |
|------|-----------|--------|-------------|
| 3 | Importação XML Inutilização | ⏸️ Aguardando | Código implementado, precisa testar |
| 4 | Importação XML Carta Correção | ⏸️ Aguardando | Código implementado, precisa testar |
| 5 | Verificação Numeração | ⏸️ Aguardando | Código já implementado (linhas 1391-1500) |
| 6 | Trocar Senha | ⏸️ Aguardando | Código implementado, precisa testar |
| 7 | Esqueci Minha Senha | ⏸️ Aguardando | Código implementado, precisa testar |

---

## ⚠️ OBSERVAÇÕES

1. **Items 3 e 4:** Requerem arquivos XML reais para teste completo
2. **Item 5:** Código já está implementado, teste verifica funcionamento
3. **Items 6 e 7:** Requerem usuário logado/teste manual no sistema

---

**Status:** ⏸️ **AGUARDANDO EXECUÇÃO DOS TESTES MANUAIS**
