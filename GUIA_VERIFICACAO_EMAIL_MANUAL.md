# 📧 Guia de Verificação Manual de Emails

## ✅ Implementação Completa!

### 🎯 O Que Foi Implementado:

1. ✅ **Biblioteca IMAP instalada** (`imap-simple` + `mailparser`)
2. ✅ **Serviço de monitoramento** (`emailMonitorService.ts`)
3. ✅ **Endpoint de verificação manual** (`POST /api/email-monitors/:id/check`)
4. ✅ **Botão "Verificar Agora"** na interface (▶️ verde)

---

## 🚀 Como Usar:

### **Passo 1: Configurar Monitor**

1. Vá para `/configuracoes/email-monitor`
2. Selecione uma empresa
3. Clique em **"Adicionar Email"**
4. Preencha:
   ```
   Email: seu@gmail.com
   Senha: [Senha de App do Gmail]
   Host: imap.gmail.com
   Porta: 993
   SSL: ✅ Ativo
   Monitorar A Partir De: [escolha uma data ou deixe vazio]
   Intervalo: 15 minutos
   ```
5. Clique em **"Salvar"**

### **Passo 2: Testar Conexão**

1. Clique no botão **🧪** (tubo de teste)
2. Aguarde 1-3 segundos
3. Veja mensagem: **"Conexão IMAP estabelecida com sucesso!"**
4. Se der erro, corrija host/porta/SSL

### **Passo 3: Ativar Monitor**

1. Certifique-se que o **switch está verde** (Ativo)
2. Se estiver vermelho (Inativo), clique para ativar

### **Passo 4: Verificar Emails Agora! 🎯**

1. Clique no botão **▶️ verde** (PlayCircle - primeiro botão)
2. Aguarde o processamento (pode levar alguns segundos)
3. Veja o resultado:

**Sucesso:**
```
✅ Verificação concluída!
15 email(s) verificado(s), 3 XML(s) baixado(s), 2 duplicado(s)
```

**Sem novos emails:**
```
✅ Verificação concluída!
0 email(s) verificado(s), 0 XML(s) baixado(s)
```

---

## 🔄 O Que Acontece ao Clicar:

```
1️⃣ CONEXÃO
   └─ Conecta ao servidor IMAP com suas credenciais

2️⃣ BUSCA DE EMAILS
   ├─ Se configurou "Monitorar A Partir De": busca emails após essa data
   ├─ Se já verificou antes: busca apenas emails novos (UID > last_email_id)
   └─ Filtra apenas emails com anexos

3️⃣ PROCESSAMENTO DE ANEXOS
   ├─ Para cada anexo .xml encontrado:
   ├─ Valida se é NFe/NFCe
   ├─ Verifica se já existe no banco (anti-duplicata)
   ├─ Se novo: processa e salva
   └─ Se duplicado: ignora

4️⃣ SALVAMENTO
   ├─ Salva arquivo no storage
   ├─ Extrai dados do XML
   ├─ Cria empresa automaticamente se necessário
   ├─ Salva registro no banco
   └─ Atualiza last_email_id e last_checked_at

5️⃣ RESULTADO
   └─ Mostra toast com estatísticas
```

---

## 📊 Botões na Interface:

Na tabela de monitores, você tem **4 botões**:

| Ícone | Cor | Função | Estado |
|-------|-----|--------|--------|
| ▶️ | Verde | **Verificar Agora** | Desabilitado se inativo |
| 🧪 | Cinza | Testar Conexão | Sempre disponível |
| ✏️ | Cinza | Editar | Sempre disponível |
| 🗑️ | Vermelho | Deletar | Sempre disponível |

---

## 🧪 Teste Completo no Replit:

### **Preparação:**

1. **Configure o Gmail para permitir acesso:**
   - Ative autenticação em 2 fatores
   - Vá em: Google Account → Security → App Passwords
   - Gere uma "Senha de App" para Mail
   - Copie a senha gerada (16 caracteres)

2. **Prepare um email de teste:**
   - Envie um email para si mesmo
   - Anexe um arquivo XML de NFe
   - Ou peça para alguém enviar um XML

### **Execução:**

1. Configure o monitor com a senha de app
2. Teste a conexão (🧪) - deve passar
3. Ative o monitor (switch verde)
4. Clique em **▶️ Verificar Agora**
5. Aguarde 5-30 segundos (depende de quantos emails)
6. Veja o toast com o resultado!

### **Verificação:**

1. Vá para a página `/xmls`
2. Os XMLs baixados devem aparecer lá
3. Verifique a coluna "Última Verificação" do monitor (deve atualizar)

---

## 📝 Logs no Console do Servidor:

Ao clicar em "Verificar Agora", você verá logs detalhados:

```
[IMAP Check] 🚀 Verificação manual iniciada pelo usuário admin@adaptafiscal.com.br

[IMAP Monitor] 📧 Iniciando verificação do monitor: fiscal@empresa.com
[IMAP Monitor] 📅 Monitorar desde: 2025-11-04T00:00:00.000Z
[IMAP Monitor] 🔌 Conectando a imap.gmail.com:993...
[IMAP Monitor] ✅ Conectado com sucesso!
[IMAP Monitor] 📬 Caixa INBOX aberta
[IMAP Monitor] 🔍 Buscando emails...
[IMAP Monitor] 📨 Encontrados 5 email(s)
[IMAP Monitor] ✅ XML processado: 352508487180040... (8610)
[IMAP Monitor] 📋 XML já existe: 352508487180040... (duplicado)
[IMAP Monitor] ✅ Verificação concluída em 8.3s: 5 email(s) verificado(s), 2 XML(s) encontrado(s), 1 processado(s), 1 duplicado(s)
[IMAP Monitor] 🔌 Conexão IMAP fechada
```

---

## ⚠️ Problemas Comuns:

### **Botão desabilitado (cinza)**
- ❌ Monitor está **inativo**
- ✅ **Solução:** Ative o switch na coluna "Status"

### **Erro: "Credenciais inválidas"**
- ❌ Senha incorreta ou senha normal do Gmail
- ✅ **Solução:** Use "Senha de App" do Gmail

### **Erro: "No emails found"**
- ⚠️ Não há emails novos
- ✅ **Normal:** Se já verificou antes e não chegaram novos emails

### **Timeout / Não responde**
- ❌ Email tem muitos emails/anexos grandes
- ✅ **Normal:** Primeira verificação pode demorar mais
- ✅ Configure "Monitorar A Partir De" para limitar

---

## 🎯 Recursos do Sistema:

### **✅ Anti-Duplicata (3 Camadas)**
1. **last_email_id**: Não lê o mesmo email duas vezes
2. **Chave do XML**: Não salva XML duplicado
3. **Filepath**: Não sobrescreve arquivo

### **✅ Processamento Inteligente**
- Ignora emails sem anexos
- Ignora anexos que não são .xml
- Valida se é NFe/NFCe antes de processar
- Cria empresas automaticamente
- Vincula usuário às empresas criadas

### **✅ Estatísticas Detalhadas**
- Quantos emails foram verificados
- Quantos XMLs foram encontrados
- Quantos foram processados
- Quantos eram duplicados
- Lista de erros (se houver)

---

## 📊 Exemplo de Uso Real:

**Cenário:** Você tem 50 emails na caixa com 10 XMLs

**1ª Verificação:**
```
▶️ Clica em "Verificar Agora"
⏳ Processando... (15 segundos)
✅ Verificação concluída!
   50 email(s) verificado(s)
   10 XML(s) encontrado(s)
   10 processado(s)
   0 duplicado(s)
```

**2ª Verificação (5 minutos depois):**
```
▶️ Clica em "Verificar Agora"
⏳ Processando... (2 segundos)
✅ Verificação concluída!
   0 email(s) verificado(s)
   0 XML(s) encontrado(s)
   0 processado(s)
   0 duplicado(s)
```

**3ª Verificação (depois de receber 2 novos emails com XMLs):**
```
▶️ Clica em "Verificar Agora"
⏳ Processando... (5 segundos)
✅ Verificação concluída!
   2 email(s) verificado(s)
   3 XML(s) encontrado(s)
   2 processado(s)
   1 duplicado(s)
```

---

## 🎉 Pronto para Usar!

**Tudo está funcionando:**
- ✅ Configuração de monitores
- ✅ Teste de conexão
- ✅ **Verificação manual de emails**
- ✅ Download automático de XMLs
- ✅ Processamento e salvamento
- ✅ Anti-duplicata
- ✅ Criação automática de empresas
- ✅ Logs detalhados

**Configure seu email e teste agora!** 🚀

---

## 🔮 Próximos Passos (Futuro):

Depois você pode implementar:
- 🤖 Verificação automática (cron job)
- 📊 Dashboard com estatísticas de monitoramento
- 📧 Notificações quando novos XMLs são encontrados
- 🔍 Filtros avançados (remetente, assunto, etc)
- 📁 Organização de XMLs por pasta de email

**Mas por enquanto, a verificação manual já está 100% funcional!** ✨










