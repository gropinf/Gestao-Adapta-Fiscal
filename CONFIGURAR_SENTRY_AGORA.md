# 🚀 Configurar Sentry - Guia Rápido

## ✅ Status Atual
- ✅ `@sentry/node` instalado
- ✅ Código de integração pronto
- ✅ DSN obtido: `https://3cee72fb8d69b8ccc4a9677ab30d8ba0@o4510602129440768.ingest.us.sentry.io/4510602143596544`
- ✅ Endpoint de teste criado: `/api/test-sentry`

## 📋 Próximo Passo: Configurar Variável de Ambiente

### No Replit (Recomendado):

1. **Abra o painel lateral** (ícone de cadeado 🔒 ou "Secrets")
2. **Clique em "Secrets"** ou "Environment Variables"
3. **Adicione a variável:**
   - **Key:** `SENTRY_DSN`
   - **Value:** `https://3cee72fb8d69b8ccc4a9677ab30d8ba0@o4510602129440768.ingest.us.sentry.io/4510602143596544`
4. **Opcional (recomendado):**
   - **Key:** `SENTRY_ENVIRONMENT`
   - **Value:** `production` (ou `development` se estiver testando)

### Alternativa: Arquivo .env (se permitido)

Se o Replit permitir criar arquivo `.env`, adicione:

```bash
SENTRY_DSN=https://3cee72fb8d69b8ccc4a9677ab30d8ba0@o4510602129440768.ingest.us.sentry.io/4510602143596544
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
```

## 🔄 Reiniciar o Servidor

Após configurar a variável de ambiente:

1. **Pare o servidor** (Ctrl+C se estiver rodando)
2. **Inicie novamente:** `npm run dev`
3. **Procure por esta mensagem no console:**
   ```
   ✅ Sentry inicializado com sucesso
   ```

## 🧪 Testar a Integração

### Opção 1: Endpoint de Teste (Recomendado)

1. **Faça login** na aplicação
2. **Acesse:** `http://localhost:5000/api/test-sentry`
3. **Você deve ver:**
   ```json
   {
     "success": true,
     "message": "Erro enviado para Sentry - verifique o dashboard",
     "sentryConfigured": true,
     "note": "Este erro foi capturado e enviado para o Sentry..."
   }
   ```
4. **Verifique no dashboard do Sentry** se o erro apareceu

### Opção 2: Forçar um Erro Real

Acesse qualquer endpoint que não existe ou cause um erro. O Sentry capturará automaticamente.

## ✅ Verificar se Está Funcionando

1. **No console do servidor:** Deve aparecer `✅ Sentry inicializado com sucesso`
2. **No dashboard do Sentry:** Acesse [https://sentry.io](https://sentry.io) e verifique se aparecem erros
3. **Teste o endpoint:** `/api/test-sentry` deve retornar sucesso

## 🎯 O Que Acontece Agora?

- ✅ **Todos os erros** capturados pelo `logger.error()` serão enviados automaticamente para o Sentry
- ✅ **Contexto completo:** userId, companyId, endpoint, etc.
- ✅ **Stack traces completos** para facilitar debug
- ✅ **Agrupamento automático** de erros similares

## 📊 Monitoramento

Após configurar, você poderá:
- Ver todos os erros em tempo real no dashboard do Sentry
- Receber notificações quando novos erros ocorrerem
- Analisar tendências e frequência de erros
- Ver contexto completo de cada erro (usuário, requisição, etc.)

## 🔧 Variáveis de Ambiente Disponíveis

| Variável | Descrição | Valor Atual |
|----------|-----------|-------------|
| `SENTRY_DSN` | DSN do projeto Sentry | ✅ Configurado |
| `SENTRY_ENVIRONMENT` | Ambiente (production/development) | Opcional |
| `SENTRY_TRACES_SAMPLE_RATE` | Taxa de amostragem (0.0 a 1.0) | Padrão: 0.1 |
| `SENTRY_ENABLE_DEV` | Habilitar em desenvolvimento | Padrão: false |

## ⚠️ Importante

- Por padrão, o Sentry **não envia eventos em desenvolvimento** (NODE_ENV=development)
- Para habilitar em desenvolvimento, adicione: `SENTRY_ENABLE_DEV=true`
- Em produção, os erros são enviados automaticamente

---

**Pronto!** Após configurar o `SENTRY_DSN` nas Secrets do Replit e reiniciar, tudo estará funcionando! 🎉



