# 🧪 Teste de Conexão IMAP - Sistema Adapta Fiscal

## 📋 O Que é Testado

Quando você clica no botão **🧪 Testar Conexão**, o sistema verifica:

### ✅ **Conectividade Básica**
1. **Resolução de DNS**: O hostname pode ser resolvido?
2. **Alcançabilidade**: O servidor está acessível na rede?
3. **Porta aberta**: A porta especificada está aceitando conexões?
4. **SSL/TLS**: A conexão segura pode ser estabelecida?
5. **Resposta IMAP**: O servidor responde com saudação IMAP válida?

---

## 🔍 Como Funciona

### **Fluxo do Teste:**

```
1️⃣ CONEXÃO
   ├─ Se SSL = SIM: Cria conexão TLS
   └─ Se SSL = NÃO: Cria conexão TCP simples

2️⃣ HANDSHAKE
   ├─ Aguarda resposta do servidor
   └─ Timeout: 10 segundos

3️⃣ VALIDAÇÃO
   ├─ Servidor IMAP responde com: "* OK ..."
   ├─ Exemplo: "* OK IMAP4rev1 Server Ready"
   └─ Isso confirma que é um servidor IMAP válido

4️⃣ RESULTADO
   ├─ ✅ SUCESSO: Mostra mensagem + detalhes
   └─ ❌ FALHA: Mostra erro específico + detalhes
```

---

## 📊 Mensagens de Resultado

### ✅ **Sucesso**
```
"Conexão IMAP estabelecida com sucesso!"
```

**Detalhes mostrados:**
- Host testado
- Porta usada
- SSL ativado/desativado
- Tempo de resposta (ms)
- Saudação do servidor

### ❌ **Falhas Comuns**

**1. Servidor não encontrado**
```
"Servidor não encontrado: imap.exemplo.com"
```
**Causa:** Hostname incorreto ou DNS não resolve  
**Solução:** Verifique o host IMAP (ex: `imap.gmail.com`)

---

**2. Conexão recusada**
```
"Conexão recusada pelo servidor (porta 993)"
```
**Causa:** Porta incorreta ou firewall bloqueando  
**Solução:** 
- Gmail: use porta 993 com SSL
- Verifique se SSL está ativado
- Verifique firewall/antivírus

---

**3. Timeout**
```
"Timeout: Servidor não respondeu"
```
**Causa:** Servidor lento ou inatingível  
**Solução:**
- Verifique sua conexão de internet
- Servidor pode estar fora do ar
- Firewall pode estar bloqueando

---

**4. Conexão fechada**
```
"Conexão fechada antes de receber resposta do servidor"
```
**Causa:** Servidor recusou a conexão SSL/TLS  
**Solução:**
- Verifique se SSL deve estar ativado ou desativado
- Alguns servidores usam STARTTLS em vez de SSL direto

---

## ⚙️ Configurações Testadas

### **Gmail**
```
Host: imap.gmail.com
Porta: 993
SSL: ✅ SIM
Resultado esperado: ✅ "* OK Gimap ready..."
```

### **Outlook/Hotmail**
```
Host: outlook.office365.com
Porta: 993
SSL: ✅ SIM
Resultado esperado: ✅ "* OK The Microsoft Exchange IMAP4 service is ready"
```

### **Yahoo Mail**
```
Host: imap.mail.yahoo.com
Porta: 993
SSL: ✅ SIM
Resultado esperado: ✅ "* OK IMAP4 ready"
```

---

## 🔐 Limitações Atuais

### **O Que o Teste FAZ:**
- ✅ Verifica se consegue conectar ao servidor
- ✅ Valida se é um servidor IMAP
- ✅ Testa SSL/TLS
- ✅ Mede tempo de resposta

### **O Que o Teste NÃO FAZ (ainda):**
- ❌ Não valida email/senha (credenciais)
- ❌ Não tenta fazer login
- ❌ Não verifica permissões da conta

**Por quê?**
- Para validar credenciais, precisamos de uma biblioteca IMAP completa
- Isso será implementado na próxima fase (Item 3.3 - Implementação IMAP)
- Por enquanto, o teste garante que a configuração básica está correta

---

## 💡 Dicas de Uso

### **Antes de Cadastrar:**
1. Configure o monitor com host, porta e SSL
2. **Clique em "Salvar"** primeiro
3. **Depois clique em 🧪 Testar**
4. Se passar, suas configurações estão corretas!

### **Se o Teste Falhar:**
1. Verifique se o host está correto
2. Confirme a porta (993 é o padrão para IMAP SSL)
3. Tente alternar SSL (alguns servidores usam porta 143 sem SSL)
4. Verifique se não há firewall bloqueando

### **Senhas de App (Gmail):**
- Gmail requer "Senha de App" se tiver autenticação em 2 fatores
- Vá em: Google Account → Security → App Passwords
- Gere uma senha específica para "Mail"
- Use essa senha no campo "Senha" do monitor

---

## 🎯 Exemplo de Teste Bem-Sucedido

**Configuração:**
```
Email: fiscal@empresa.com
Host: imap.gmail.com
Porta: 993
SSL: ✅ Ativo
```

**Clica em 🧪 Testar**

**Resultado:**
```json
{
  "success": true,
  "message": "Conexão IMAP estabelecida com sucesso!",
  "details": {
    "host": "imap.gmail.com",
    "port": 993,
    "ssl": true,
    "responseTime": 342,
    "serverGreeting": "* OK Gimap ready for requests from 203.0.113.42"
  }
}
```

**Interface mostra:**
```
✅ Conexão IMAP estabelecida com sucesso!
```

---

## 🚀 Próximos Passos

Após o teste passar:
1. ✅ Configuração de conexão está correta
2. ✅ Servidor está acessível
3. ✅ Pode prosseguir com o monitoramento

Quando o serviço de monitoramento for implementado:
- ✅ Fará login com as credenciais
- ✅ Listará emails da caixa
- ✅ Baixará XMLs automaticamente
- ✅ Processará e salvará no sistema

---

## 📝 Logs

O teste gera logs no servidor:
```
[IMAP Test] Testando conexão com imap.gmail.com:993 (SSL: true)
[IMAP Test] Conexão SSL estabelecida com imap.gmail.com:993
[IMAP Test] ✅ Sucesso: Conexão IMAP estabelecida com sucesso!
```

Ou em caso de erro:
```
[IMAP Test] Testando conexão com imap.exemplo.com:993 (SSL: true)
[IMAP Test] ❌ Falha: Servidor não encontrado: imap.exemplo.com
```

---

## ✨ Resumo

O teste de conexão é uma ferramenta de **diagnóstico rápido** que:
- ✅ Valida configurações básicas em segundos
- ✅ Identifica problemas comuns imediatamente
- ✅ Economiza tempo de troubleshooting
- ✅ Garante que está tudo pronto para o monitoramento

**Use sempre antes de ativar um monitor!** 🎯








