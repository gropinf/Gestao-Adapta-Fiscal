# 🧪 Guia de Teste Rápido - DANFE

## ✅ Como Testar a Implementação

### 1️⃣ TESTE VISUAL NO FRONTEND

#### Passo a Passo:
1. **Iniciar o servidor:**
   ```bash
   npm run dev
   ```

2. **Fazer login no sistema:**
   - Acesse: `http://localhost:5000`
   - Usuário: admin / senha configurada

3. **Acessar lista de XMLs:**
   - Menu: "XMLs" ou `/xmls`

4. **Clicar em qualquer NFe para ver detalhes**

5. **Verificar o botão "Baixar DANFE":**
   - ✅ Deve estar visível (verde, entre "Baixar XML" e "Enviar por Email")
   - ✅ Ícone de documento (FileText)
   - ✅ Texto: "Baixar DANFE"

6. **Clicar no botão:**
   - ✅ Toast "Gerando DANFE..." aparece
   - ✅ Aguardar 2-5 segundos (primeira vez)
   - ✅ Download automático do PDF
   - ✅ Toast "DANFE baixado com sucesso!"

7. **Abrir o PDF baixado:**
   - ✅ Arquivo nomeado como: `{chave}-DANFE.pdf`
   - ✅ PDF abre corretamente
   - ✅ Layout da SEFAZ está correto
   - ✅ Dados da NFe visíveis (emitente, destinatário, produtos)
   - ✅ Código de barras presente
   - ✅ QR Code presente (se aplicável)

8. **Clicar novamente no botão:**
   - ✅ Download deve ser instantâneo (< 1 segundo)
   - ✅ PDF baixado é o mesmo (cache funcionando)

---

### 2️⃣ TESTE VIA API (cURL)

#### Obter Token JWT:
```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@email.com","password":"sua_senha"}'

# Copiar o token retornado
```

#### Baixar DANFE:
```bash
curl -X GET "http://localhost:5000/api/danfe/{CHAVE_DE_44_CARACTERES}" \
  -H "Authorization: Bearer {SEU_TOKEN}" \
  --output danfe.pdf

# Exemplo com chave real:
curl -X GET "http://localhost:5000/api/danfe/43200178969170000158550010000000011000000018" \
  -H "Authorization: Bearer eyJhbGc..." \
  --output danfe.pdf
```

#### Resultado Esperado:
- ✅ Status HTTP 200
- ✅ Arquivo `danfe.pdf` baixado
- ✅ PDF válido e abre corretamente

---

### 3️⃣ TESTE UNITÁRIO (Jest)

```bash
# Executar todos os testes do DANFE
npm test -- danfe.test.ts

# Ou com watch mode
npm test -- danfe.test.ts --watch

# Com cobertura
npm test -- danfe.test.ts --coverage
```

#### Resultado Esperado:
```
PASS __tests__/danfe.test.ts
  DANFE Service
    ✓ deve gerar DANFE a partir de XML válido (4235ms)
    ✓ deve retornar o mesmo PDF se já existe (13ms)
    ✓ deve verificar se DANFE existe (5ms)
    ✓ deve obter o caminho do DANFE existente (3ms)
    ✓ deve retornar null para DANFE inexistente (2ms)
    ✓ deve lançar erro para XML inexistente (7ms)
    ✓ deve detectar nota cancelada corretamente (3829ms)

Test Suites: 1 passed, 1 total
Tests:       7 passed, 7 total
```

---

### 4️⃣ VERIFICAR BANCO DE DADOS

```bash
# Conectar ao PostgreSQL
psql $DATABASE_URL

# Verificar se coluna foi criada
\d xmls

# Deve mostrar:
# danfe_path | text |

# Ver registros com DANFE gerado
SELECT chave, danfe_path FROM xmls WHERE danfe_path IS NOT NULL LIMIT 5;

# Resultado esperado:
# chave                                        | danfe_path
# --------------------------------------------|----------------------------------
# 43200178969170000158550010000000011000000018 | 43200178969170000158550010000000011000000018-DANFE.pdf
```

---

### 5️⃣ VERIFICAR STORAGE

```bash
# Listar arquivos gerados
ls -lh storage/danfe/

# Resultado esperado:
# -rw-r--r-- 1 user user  87K Nov  3 10:30 43200178969170000158550010000000011000000018-DANFE.pdf
# -rw-r--r-- 1 user user 123K Nov  3 10:31 43200178969170000158550010000000021000000028-DANFE.pdf

# Verificar tamanho dos PDFs
du -sh storage/danfe/*

# PDFs devem ter entre 50KB - 500KB
```

---

### 6️⃣ TESTE DE PERMISSÕES

#### Como Admin:
1. Login como admin
2. Acessar qualquer NFe
3. ✅ Deve conseguir baixar DANFE

#### Como Cliente:
1. Login como cliente
2. Acessar NFe da **própria empresa**
3. ✅ Deve conseguir baixar DANFE
4. Tentar acessar NFe de **outra empresa** (via URL direta):
   ```
   http://localhost:5000/xmls/{id-de-outra-empresa}
   ```
5. ✅ Deve ser bloqueado (403 Forbidden)

---

### 7️⃣ TESTE DE ERROS

#### Chave Inválida:
```bash
curl -X GET "http://localhost:5000/api/danfe/123" \
  -H "Authorization: Bearer {token}"

# Resultado esperado:
# HTTP 400
# {"error":"Chave inválida","message":"A chave de acesso deve ter 44 caracteres"}
```

#### XML Não Encontrado:
```bash
curl -X GET "http://localhost:5000/api/danfe/00000000000000000000000000000000000000000000" \
  -H "Authorization: Bearer {token}"

# Resultado esperado:
# HTTP 404
# {"error":"XML não encontrado","message":"..."}
```

#### Sem Autenticação:
```bash
curl -X GET "http://localhost:5000/api/danfe/43200178969170000158550010000000011000000018"

# Resultado esperado:
# HTTP 401
# {"error":"Não autenticado"}
```

---

### 8️⃣ TESTE DE NOTA CANCELADA

1. **Criar XML de nota cancelada** (via seeds ou manualmente)
2. **Gerar DANFE dessa nota**
3. **Abrir o PDF**
4. ✅ Deve ter marcação visual de "CANCELADA"
5. ✅ Texto explicativo sobre o cancelamento

---

### 9️⃣ TESTE DE PERFORMANCE

#### Primeira Geração:
```bash
time curl -X GET "http://localhost:5000/api/danfe/{chave}" \
  -H "Authorization: Bearer {token}" \
  -o danfe.pdf

# Tempo esperado: 2-5 segundos
```

#### Segunda Geração (Cache):
```bash
time curl -X GET "http://localhost:5000/api/danfe/{chave}" \
  -H "Authorization: Bearer {token}" \
  -o danfe2.pdf

# Tempo esperado: < 500ms
```

---

### 🔟 CHECKLIST FINAL DE VALIDAÇÃO

#### Frontend:
- [ ] Botão "Baixar DANFE" visível e estilizado (verde)
- [ ] Toast "Gerando DANFE..." aparece ao clicar
- [ ] Download automático funciona
- [ ] Toast de sucesso aparece após download
- [ ] Toast de erro aparece em caso de falha
- [ ] Segunda vez é mais rápida (cache)

#### Backend:
- [ ] Endpoint `/api/danfe/:chave` responde corretamente
- [ ] Autenticação obrigatória funciona
- [ ] Permissões validadas (admin e cliente)
- [ ] PDF gerado corretamente
- [ ] Campo `danfe_path` atualizado no banco
- [ ] Pasta `/storage/danfe/` criada
- [ ] Logs informativos no console

#### Qualidade:
- [ ] Todos os testes unitários passando
- [ ] Zero erros de lint
- [ ] Build passa sem erros
- [ ] Código documentado

#### Documentação:
- [ ] Backlog atualizado
- [ ] `IMPLEMENTACAO_DANFE.md` criado
- [ ] `RESUMO_IMPLEMENTACAO_DANFE.md` criado
- [ ] Este guia de teste criado

---

## 🚨 PROBLEMAS COMUNS E SOLUÇÕES

### Problema: "Cannot find module '@alexssmusica/node-pdf-nfe'"
**Solução:**
```bash
npm install @alexssmusica/node-pdf-nfe
```

### Problema: "Column 'danfe_path' does not exist"
**Solução:**
```bash
psql $DATABASE_URL -f server/migrations/001_add_danfe_path.sql
```

### Problema: PDF gerado está vazio ou corrompido
**Solução:**
- Verificar se o XML está bem formado
- Verificar logs do servidor
- Testar com XML de exemplo (`__tests__/fixtures/nfe-valida.xml`)

### Problema: "ENOENT: no such file or directory"
**Solução:**
```bash
mkdir -p storage/danfe
chmod 755 storage/danfe
```

### Problema: Permissão negada (403)
**Solução:**
- Verificar se usuário está vinculado à empresa do XML
- Verificar se token JWT é válido
- Fazer login novamente

---

## 📊 LOGS ESPERADOS NO CONSOLE

```
[DANFE] 📄 Gerando DANFE para chave: 43200178969170000158550010000000011000000018
✅ DANFE já existe: 43200178969170000158550010000000011000000018-DANFE.pdf
[DANFE] ✅ Campo danfe_path atualizado no banco
[DANFE] ✅ Download concluído: 43200178969170000158550010000000011000000018-DANFE.pdf
```

---

## ✅ TESTE APROVADO!

Se todos os itens acima funcionarem corretamente, a implementação está **100% funcional** e pronta para uso! 🎉

---

**Tempo estimado de teste:** 15-20 minutos  
**Dificuldade:** Fácil  
**Pré-requisitos:** Servidor rodando, usuário criado, pelo menos 1 XML no sistema










