# 🔧 Configuração do Sentry - Guia Completo

**Data:** 12/12/2025

---

## ✅ Status Atual

- ✅ `@sentry/node` instalado
- ✅ Código de integração implementado no `server/logger.ts`
- ⏳ Configuração de variáveis de ambiente necessária

---

## 📋 Passos para Configurar

### 1. Obter DSN do Sentry

1. Acesse [https://sentry.io](https://sentry.io)
2. Crie uma conta ou faça login
3. Crie um novo projeto (ou use um existente)
4. Selecione "Node.js" como plataforma
5. Copie o **DSN** fornecido

O DSN tem o formato:
```
https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
```

### 2. Configurar Variáveis de Ambiente

Adicione ao seu arquivo `.env` (ou variáveis de ambiente do servidor):

```bash
# Sentry Configuration
SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=production  # ou staging, development
SENTRY_TRACES_SAMPLE_RATE=0.1   # 10% em produção (0.0 a 1.0)

# Opcional: Habilitar Sentry em desenvolvimento
# SENTRY_ENABLE_DEV=true
```

### 3. Reiniciar o Servidor

Após configurar as variáveis de ambiente, reinicie o servidor:

```bash
npm run dev
# ou
npm start
```

### 4. Verificar Inicialização

Ao iniciar o servidor, você deve ver no console (em desenvolvimento):

```
✅ Sentry inicializado com sucesso
```

Se não aparecer, verifique:
- ✅ DSN está correto no `.env`
- ✅ `@sentry/node` está instalado (`npm list @sentry/node`)
- ✅ Variável `SENTRY_DSN` está sendo lida corretamente

---

## 🧪 Como Testar

### Teste 1: Verificar Inicialização

1. Inicie o servidor
2. Verifique os logs de inicialização
3. Deve aparecer: `✅ Sentry inicializado com sucesso`

### Teste 2: Testar Envio de Erro

Crie um endpoint de teste temporário ou force um erro:

```typescript
// Em routes.ts (temporário para teste)
app.get("/api/test-sentry", (req, res) => {
  try {
    throw new Error("Teste de erro para Sentry");
  } catch (error) {
    logger.error("Erro de teste do Sentry", error as Error, {
      test: true,
      endpoint: "/api/test-sentry",
    });
    res.json({ message: "Erro enviado para Sentry" });
  }
});
```

Acesse: `http://localhost:5000/api/test-sentry`

Verifique no dashboard do Sentry se o erro apareceu.

### Teste 3: Verificar Contexto

Os erros enviados para o Sentry incluem:
- ✅ Stack trace completo
- ✅ Contexto adicional (userId, companyId, etc.)
- ✅ Mensagem do erro
- ✅ Timestamp

---

## ⚙️ Configurações Avançadas

### Sampling Rate (Taxa de Amostragem)

Controla quantos eventos são enviados:

```bash
# Produção: 10% dos eventos (recomendado)
SENTRY_TRACES_SAMPLE_RATE=0.1

# Desenvolvimento: 100% dos eventos
SENTRY_TRACES_SAMPLE_RATE=1.0

# Staging: 50% dos eventos
SENTRY_TRACES_SAMPLE_RATE=0.5
```

### Ambiente

```bash
# Produção
SENTRY_ENVIRONMENT=production

# Staging
SENTRY_ENVIRONMENT=staging

# Desenvolvimento
SENTRY_ENVIRONMENT=development
```

### Habilitar em Desenvolvimento

Por padrão, Sentry **não envia** eventos em desenvolvimento. Para habilitar:

```bash
SENTRY_ENABLE_DEV=true
```

---

## 📊 O que é Enviado para o Sentry

### Automaticamente Enviado:
- ✅ Todos os erros capturados por `logger.error()`
- ✅ Stack trace completo
- ✅ Contexto adicional (userId, companyId, etc.)
- ✅ Mensagem do erro
- ✅ Timestamp
- ✅ Ambiente (production/staging/development)

### Exemplo de Erro no Sentry:

```json
{
  "level": "error",
  "message": "Erro ao processar XML",
  "error": {
    "name": "Error",
    "message": "XML inválido",
    "stack": "..."
  },
  "contexts": {
    "additional_data": {
      "userId": "123",
      "companyId": "456",
      "xmlId": "789"
    }
  },
  "tags": {
    "error_message": "Erro ao processar XML"
  }
}
```

---

## 🔍 Verificando se Está Funcionando

### 1. Logs do Servidor

Em desenvolvimento, ao iniciar:
```
✅ Sentry inicializado com sucesso
```

### 2. Dashboard do Sentry

1. Acesse [https://sentry.io](https://sentry.io)
2. Vá para seu projeto
3. Verifique a aba "Issues"
4. Erros devem aparecer lá

### 3. Teste Manual

Force um erro e verifique se aparece no Sentry:
- Erro em endpoint protegido
- Erro no processamento de XML
- Erro no upload de arquivos

---

## 🚨 Troubleshooting

### Sentry não inicializa

**Problema:** Não aparece mensagem de inicialização

**Soluções:**
1. Verifique se `SENTRY_DSN` está configurado no `.env`
2. Verifique se o DSN está correto (formato: `https://...@...ingest.sentry.io/...`)
3. Verifique se `@sentry/node` está instalado: `npm list @sentry/node`
4. Reinicie o servidor após configurar

### Erros não aparecem no Sentry

**Problema:** Erros ocorrem mas não aparecem no dashboard

**Soluções:**
1. Verifique se está em desenvolvimento (por padrão não envia)
   - Configure `SENTRY_ENABLE_DEV=true` para testar
2. Verifique o sampling rate (pode estar muito baixo)
3. Verifique se o erro está sendo capturado por `logger.error()`
4. Verifique os logs do servidor para erros de conexão

### Erro ao importar @sentry/node

**Problema:** Erro ao inicializar Sentry

**Soluções:**
1. Reinstale: `npm uninstall @sentry/node && npm install @sentry/node`
2. Verifique versão do Node.js (requer Node 14+)
3. Limpe cache: `rm -rf node_modules package-lock.json && npm install`

---

## 📝 Checklist de Configuração

- [ ] `@sentry/node` instalado (`npm list @sentry/node`)
- [ ] DSN configurado no `.env` (`SENTRY_DSN=...`)
- [ ] Ambiente configurado (`SENTRY_ENVIRONMENT=...`)
- [ ] Sampling rate configurado (`SENTRY_TRACES_SAMPLE_RATE=...`)
- [ ] Servidor reiniciado após configuração
- [ ] Mensagem de inicialização aparece nos logs
- [ ] Teste de erro enviado para Sentry
- [ ] Erro aparece no dashboard do Sentry

---

## 🎯 Próximos Passos (Opcional)

1. **Configurar Alertas no Sentry:**
   - Alertas por email/Slack quando erros críticos ocorrem
   - Alertas quando taxa de erro aumenta

2. **Configurar Releases:**
   - Associar erros a versões do código
   - Rastrear quais versões têm mais problemas

3. **Performance Monitoring:**
   - Monitorar performance de endpoints
   - Identificar endpoints lentos

---

**Status:** ✅ **Código pronto, aguardando configuração do DSN**

