# 🧪 Como Testar o Sentry

## ✅ Status
- ✅ Sentry configurado e inicializado
- ✅ Dois endpoints de teste disponíveis

---

## 🚀 Opção 1: Teste Rápido (SEM Autenticação) - RECOMENDADO

### No Navegador:
Acesse diretamente:
```
http://localhost:5000/api/test-sentry
```

### Ou use curl:
```bash
curl http://localhost:5000/api/test-sentry
```

### Resposta esperada:
```json
{
  "success": true,
  "message": "Erro enviado para Sentry - verifique o dashboard",
  "sentryConfigured": true,
  "note": "Este erro foi capturado e enviado para o Sentry..."
}
```

**✅ Esta é a forma mais fácil!** Não precisa fazer login.

---

## 🔐 Opção 2: Teste com Autenticação (COM Contexto do Usuário)

### Passo 1: Fazer Login
1. Acesse a aplicação: `http://localhost:5000`
2. Faça login com suas credenciais
3. O token será salvo automaticamente

### Passo 2: Obter o Token

**No Console do Navegador (F12 → Console):**

```javascript
// Obter o token do localStorage
const authData = JSON.parse(localStorage.getItem('auth-storage') || '{}');
console.log('Token:', authData.state?.token);
```

### Passo 3: Fazer a Requisição

**Opção A: No Console do Navegador**
```javascript
const authData = JSON.parse(localStorage.getItem('auth-storage') || '{}');
const token = authData.state?.token;

fetch('/api/test-sentry-auth', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
})
.then(r => r.json())
.then(console.log);
```

**Opção B: Usando curl (substitua YOUR_TOKEN)**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:5000/api/test-sentry-auth
```

**Opção C: No Postman/Insomnia**
- URL: `http://localhost:5000/api/test-sentry-auth`
- Method: `GET`
- Headers:
  - Key: `Authorization`
  - Value: `Bearer YOUR_TOKEN`

### Resposta esperada:
```json
{
  "success": true,
  "message": "Erro enviado para Sentry - verifique o dashboard",
  "sentryConfigured": true,
  "userId": "uuid-do-usuario",
  "note": "Este erro foi capturado e enviado para o Sentry com informações do usuário..."
}
```

---

## 📊 Verificar no Dashboard do Sentry

Após executar qualquer um dos testes:

1. Acesse [https://sentry.io](https://sentry.io)
2. Vá para seu projeto
3. Clique em "Issues" no menu lateral
4. Você deve ver um erro com a mensagem:
   - "Teste de erro para Sentry - Este é um erro intencional..."
   - ou "Teste de erro para Sentry (autenticado)..."

5. Clique no erro para ver:
   - Stack trace completo
   - Contexto adicional (endpoint, timestamp, etc.)
   - Se foi autenticado: userId, userEmail

---

## 🎯 Diferença entre os Endpoints

| Endpoint | Autenticação | Informações do Usuário | Uso |
|----------|--------------|------------------------|-----|
| `/api/test-sentry` | ❌ Não | ❌ Não | Teste rápido |
| `/api/test-sentry-auth` | ✅ Sim | ✅ Sim (userId, email) | Teste completo |

---

## 💡 Dica

**Para testar rapidamente, use sempre `/api/test-sentry`** - é mais simples e não requer login!

O endpoint autenticado é útil quando você quer ver como o Sentry captura informações do usuário em erros reais.

---

## ✅ Checklist

- [ ] Sentry inicializado (visto no console: `✅ Sentry inicializado com sucesso`)
- [ ] Teste executado (`/api/test-sentry` ou `/api/test-sentry-auth`)
- [ ] Resposta de sucesso recebida
- [ ] Erro aparece no dashboard do Sentry
- [ ] Stack trace e contexto visíveis no Sentry

---

**Pronto!** Agora você pode testar o Sentry facilmente! 🎉



