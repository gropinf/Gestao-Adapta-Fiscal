# 🔧 Configuração do Sentry - Passo a Passo

**Status:** ✅ `@sentry/node` instalado

---

## 📋 O QUE PRECISA SER FEITO

### 1. ✅ Instalação (JÁ FEITO)
```bash
npm install @sentry/node
```

### 2. ⏳ Configurar Variáveis de Ambiente

Adicione ao seu arquivo `.env`:

```bash
# Sentry Configuration
SENTRY_DSN=https://seu-dsn@sentry.io/projeto-id
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

**Onde obter o DSN:**
1. Acesse [https://sentry.io](https://sentry.io)
2. Crie uma conta ou faça login
3. Crie um novo projeto (escolha "Node.js")
4. Copie o DSN fornecido

### 3. ⏳ Reiniciar o Servidor

Após adicionar as variáveis de ambiente:

```bash
npm run dev
```

Você deve ver no console:
```
✅ Sentry inicializado com sucesso
```

---

## ✅ O QUE JÁ ESTÁ PRONTO

- ✅ Código de integração no `server/logger.ts`
- ✅ Envio automático de erros para Sentry
- ✅ Contexto adicional (userId, companyId, etc.)
- ✅ Configuração via variáveis de ambiente
- ✅ Desabilitado em desenvolvimento por padrão (pode habilitar)

---

## 🧪 Como Testar

### Teste Rápido:

1. Configure o `SENTRY_DSN` no `.env`
2. Reinicie o servidor
3. Force um erro (ex: acesse um endpoint que não existe)
4. Verifique no dashboard do Sentry se o erro apareceu

### Teste Manual:

Crie um endpoint temporário em `routes.ts`:

```typescript
app.get("/api/test-sentry", (req, res) => {
  try {
    throw new Error("Teste de erro para Sentry");
  } catch (error) {
    logger.error("Erro de teste", error as Error, {
      test: true,
      endpoint: "/api/test-sentry",
    });
    res.json({ message: "Erro enviado para Sentry - verifique o dashboard" });
  }
});
```

Acesse: `http://localhost:5000/api/test-sentry`

---

## 📝 Variáveis de Ambiente Disponíveis

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `SENTRY_DSN` | DSN do projeto Sentry | (obrigatório) |
| `SENTRY_ENVIRONMENT` | Ambiente (production/staging/development) | `NODE_ENV` |
| `SENTRY_TRACES_SAMPLE_RATE` | Taxa de amostragem (0.0 a 1.0) | `0.1` (prod) / `1.0` (dev) |
| `SENTRY_ENABLE_DEV` | Habilitar em desenvolvimento | `false` |

---

## 🎯 Próximo Passo

**Apenas configure o `SENTRY_DSN` no `.env` e reinicie o servidor!**

O código já está pronto e funcionando. ✅

---

**Documentação completa:** Veja `SENTRY_SETUP.md` para mais detalhes

