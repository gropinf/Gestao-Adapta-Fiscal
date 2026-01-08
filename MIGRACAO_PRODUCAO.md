# 🌐 Migração de XMLs de Produção para Contabo Storage

Este guia explica como migrar XMLs que estão em **produção** (armazenados em URLs) para o Contabo Storage.

---

## 🎯 Diferença entre Desenvolvimento e Produção

### Desenvolvimento (Replit)
- XMLs estão no sistema de arquivos local: `storage/validated/`
- Filepath no banco: `/home/runner/workspace/storage/validated/NFe...xml`

### Produção (Deploy)
- XMLs podem estar em URLs (ex: Vercel, Railway, etc.)
- Filepath no banco: `https://exemplo.com/storage/xml/NFe...xml` ou similar

---

## 🚀 Como Migrar XMLs de Produção

### 1. Verificar quantos XMLs de produção precisam ser migrados

```bash
# Contar XMLs locais E de produção (URLs)
npx tsx -e "
import { countXmlsToMigrate } from './server/xmlMigrationService.ts';
countXmlsToMigrate(true).then(count => console.log('XMLs para migrar (incluindo produção):', count));
"
```

### 2. Migrar XMLs de produção

```bash
# Migra XMLs locais E de produção (URLs)
npx tsx server/migrate-xmls-to-contabo.ts --include-urls
```

### 3. Migrar apenas XMLs de produção (URLs)

Se você já migrou todos os XMLs locais e quer migrar apenas os de produção:

```bash
# Primeiro, veja quantos são URLs
npx tsx -e "
import { getXmlsToMigrate } from './server/xmlMigrationService.ts';
getXmlsToMigrate(true).then(xmls => {
  const urls = xmls.filter(x => x.filepath?.startsWith('http'));
  console.log('XMLs de produção (URLs):', urls.length);
});
"
```

---

## 📋 O que acontece na migração de produção?

1. ✅ **Detecta URLs**: Identifica XMLs com filepath começando com `http://` ou `https://`
2. ✅ **Baixa XMLs**: Faz download dos XMLs das URLs
3. ✅ **Extrai CNPJ**: Extrai o CNPJ do emitente do XML baixado
4. ✅ **Faz Upload**: Envia para o Contabo Storage na estrutura: `{CNPJ}/xml/{chaveAcesso}.xml`
5. ✅ **Atualiza Banco**: Atualiza o `filepath` no banco de dados com a URL do Contabo
6. ✅ **Não Deleta**: URLs de produção não são deletadas (apenas migradas)

---

## ⚠️ Importante

### Antes de migrar produção

1. ✅ **Backup**: Certifique-se de ter backup do banco de dados
2. ✅ **Teste**: Teste primeiro com `--limit=10` e `--include-urls`
3. ✅ **Verifique URLs**: Confirme que as URLs estão acessíveis

### Durante a migração

- O script baixa cada XML da URL antes de fazer upload
- Se uma URL não estiver acessível, o XML será pulado (não falha toda a migração)
- O progresso é mostrado em tempo real

### Após a migração

- Os XMLs estarão no Contabo Storage
- Os `filepath` no banco serão atualizados
- As URLs originais continuarão funcionando (não são deletadas)

---

## 🔍 Exemplos de Uso

### Migrar tudo (local + produção)

```bash
npx tsx server/migrate-xmls-to-contabo.ts --include-urls
```

### Migrar apenas produção (teste com 10)

```bash
npx tsx server/migrate-xmls-to-contabo.ts --include-urls --limit=10
```

### Simular migração de produção

```bash
npx tsx server/migrate-xmls-to-contabo.ts --include-urls --dry-run --limit=10
```

### Migrar produção em lotes

```bash
# Lotes de 20 por vez
npx tsx server/migrate-xmls-to-contabo.ts --include-urls --batch-size=20
```

---

## 🐛 Resolução de Problemas

### Erro: "Erro ao baixar XML da URL"

**Causa**: URL não está acessível ou retornou erro HTTP

**Solução**: 
- Verifique se a URL está correta no banco de dados
- Verifique se o servidor de produção está online
- O XML será pulado e a migração continua

### Erro: "Timeout ao baixar"

**Causa**: URL demora muito para responder

**Solução**: 
- Verifique a conexão de rede
- Tente novamente mais tarde
- O XML será pulado e pode ser migrado depois

### XMLs de produção não aparecem

**Causa**: O script não está incluindo URLs

**Solução**: Use a flag `--include-urls`:
```bash
npx tsx server/migrate-xmls-to-contabo.ts --include-urls
```

---

## 📊 Estrutura Final

Após a migração, todos os XMLs (desenvolvimento e produção) estarão no Contabo:

```
Bucket: caixafacil

Estrutura:
{CNPJ}/xml/{chaveAcesso}.xml

Exemplos:
48718004000136/xml/35250848718004000136550010000086041480468622.xml
12345678000190/xml/35241112345678000190550010000000031234567891.xml
```

---

## ✅ Checklist de Migração de Produção

- [ ] Backup do banco de dados feito
- [ ] Variáveis de ambiente do Contabo configuradas
- [ ] Teste com `--limit=10 --include-urls` executado com sucesso
- [ ] URLs de produção verificadas e acessíveis
- [ ] Migração completa executada
- [ ] XMLs verificados no Contabo Storage
- [ ] Filepaths no banco atualizados corretamente

---

**Última atualização:** 2025-01-11
