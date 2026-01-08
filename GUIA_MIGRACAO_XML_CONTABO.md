# 📦 Guia de Migração de XMLs para Contabo Storage

Este guia explica como migrar os XMLs que estão no sistema de arquivos local para o Contabo Object Storage.

---

## 🎯 O que faz a migração?

A migração:
1. ✅ Lê os XMLs do sistema de arquivos local (`storage/validated/`)
2. ✅ Extrai o CNPJ do emitente de cada XML
3. ✅ Faz upload para o Contabo Storage na estrutura: `{CNPJ}/xml/{chaveAcesso}.xml`
4. ✅ Atualiza o `filepath` no banco de dados com a URL do Contabo
5. ✅ **DELETA** o arquivo local após migração bem-sucedida

---

## 🚀 Como executar

### 1. Verificar quantos XMLs precisam ser migrados

```bash
# Primeiro, verifique quantos XMLs precisam ser migrados
npx tsx -e "
import { countXmlsToMigrate } from './server/xmlMigrationService.ts';
countXmlsToMigrate().then(count => console.log('XMLs para migrar:', count));
"
```

### 2. Executar migração completa

```bash
# Migra TODOS os XMLs
npx tsx server/migrate-xmls-to-contabo.ts
```

### 3. Modo Dry-Run (simulação)

```bash
# Simula a migração sem fazer alterações (recomendado primeiro)
npx tsx server/migrate-xmls-to-contabo.ts --dry-run
```

### 4. Migração com limite

```bash
# Migra apenas os primeiros 100 XMLs (útil para testar)
npx tsx server/migrate-xmls-to-contabo.ts --limit=100
```

### 5. Processar em lotes menores

```bash
# Processa em lotes de 10 XMLs por vez (útil para muitos arquivos)
npx tsx server/migrate-xmls-to-contabo.ts --batch-size=10
```

### 6. Combinar opções

```bash
# Dry-run com limite de 50 XMLs
npx tsx server/migrate-xmls-to-contabo.ts --dry-run --limit=50

# Migração real com lotes pequenos
npx tsx server/migrate-xmls-to-contabo.ts --batch-size=20
```

---

## 📊 Estrutura de armazenamento

Após a migração, os XMLs estarão organizados no Contabo Storage assim:

```
Bucket: caixafacil (ou configurado em CONTABO_STORAGE_BUCKET)

Estrutura:
{CNPJ}/xml/{chaveAcesso}.xml

Exemplos:
48718004000136/xml/35250848718004000136550010000086061196093835.xml
12345678000190/xml/35240112345678000190550010000001234567890123.xml
```

---

## ⚠️ Importante

### Antes de executar

1. ✅ **Verifique as variáveis de ambiente** do Contabo:
   - `CONTABO_STORAGE_ENDPOINT`
   - `CONTABO_STORAGE_REGION`
   - `CONTABO_STORAGE_BUCKET`
   - `CONTABO_STORAGE_ACCESS_KEY`
   - `CONTABO_STORAGE_SECRET_KEY`

2. ✅ **Teste com dry-run primeiro**:
   ```bash
   npx tsx server/migrate-xmls-to-contabo.ts --dry-run --limit=10
   ```

3. ✅ **Faça backup** (opcional, mas recomendado):
   ```bash
   # Backup dos XMLs locais
   tar -czf backup-xmls-$(date +%Y%m%d).tar.gz storage/validated/
   ```

### Durante a migração

- O script processa em lotes (padrão: 50 XMLs por lote)
- Mostra progresso em tempo real
- Para cada XML, mostra: ✅ sucesso ou ❌ erro

### Após a migração

- Os arquivos locais são **DELETADOS** após upload bem-sucedido
- O `filepath` no banco é atualizado com a URL do Contabo
- XMLs que falharam permanecem no sistema local

---

## 🔍 Verificar migração

### Ver quantos XMLs ainda precisam migrar

```bash
npx tsx -e "
import { countXmlsToMigrate } from './server/xmlMigrationService.ts';
countXmlsToMigrate().then(count => {
  console.log('XMLs ainda para migrar:', count);
  process.exit(count > 0 ? 1 : 0);
});
"
```

### Verificar XMLs no Contabo

Após a migração, você pode verificar no painel do Contabo ou usar a API:

```bash
# Listar XMLs de uma empresa específica
curl -X GET "http://localhost:3000/api/storage/xmls/{companyId}" \
  -H "Authorization: Bearer {token}"
```

---

## 🐛 Resolução de problemas

### Erro: "Configuração do Contabo Storage incompleta"

**Solução:** Verifique se todas as variáveis de ambiente estão configuradas no `.env` ou `.env.local`

### Erro: "Arquivo não encontrado"

**Causa:** O XML está registrado no banco mas o arquivo físico não existe mais.

**Solução:** O script ignora esses XMLs e continua com os demais.

### Erro: "XML não possui CNPJ emitente nem destinatário"

**Causa:** O XML não tem CNPJ válido no banco de dados.

**Solução:** Verifique o XML no banco e corrija manualmente se necessário.

### Erro: "Chave de acesso inválida"

**Causa:** A chave de acesso não tem 44 dígitos.

**Solução:** Verifique o XML no banco de dados.

### Migração parcial

Se a migração parar no meio (erro de rede, etc.), você pode executar novamente:

```bash
# O script automaticamente pula XMLs já migrados
npx tsx server/migrate-xmls-to-contabo.ts
```

---

## 📝 Exemplo de saída

```
🚀 Iniciando migração de XMLs para Contabo Storage...

📊 Verificando XMLs para migração...
📦 Total de XMLs para migrar: 150

📦 Processando em 3 lote(s) de até 50 XMLs cada

📦 Lote 1/3 (50 XMLs)
────────────────────────────────────────────────────────────
✅ [1/50] 35250848718004000136550010000086061196093835 - OK
✅ [2/50] 35240112345678000190550010000001234567890123 - OK
❌ [3/50] 35240199999999999990550010000009999999999999 - Arquivo não encontrado
...

📊 Lote 1 concluído: 49 sucesso, 1 falhas

============================================================
📊 RESUMO DA MIGRAÇÃO
============================================================
Total processado: 150
✅ Sucesso: 148
❌ Falhas: 2
📈 Taxa de sucesso: 98.67%

✅ Todos os XMLs foram migrados com sucesso!
```

---

## 🔄 Reverter migração

**⚠️ ATENÇÃO:** Não há como reverter automaticamente. Os arquivos locais são deletados após upload bem-sucedido.

Se precisar reverter:
1. Baixe os XMLs do Contabo Storage manualmente
2. Coloque-os de volta em `storage/validated/`
3. Atualize os `filepath` no banco de dados

---

## 📚 Referências

- `server/xmlMigrationService.ts` - Serviço de migração
- `server/contaboStorage.ts` - Funções de upload para Contabo
- `GUIA_IMPLEMENTACAO_UPLOAD_XML_CONTABO.md` - Guia de implementação

---

**Última atualização:** 2025-01-11
