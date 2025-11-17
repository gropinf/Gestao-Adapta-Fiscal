# 📧 Lógica de Monitoramento de Email - Sistema Adapta Fiscal

## 📋 Visão Geral

O sistema de monitoramento de email conecta-se automaticamente a caixas de entrada IMAP para baixar XMLs de notas fiscais anexados em emails.

---

## 🔧 Campos de Configuração

### 1. **Dados de Conexão**
- **Email**: Endereço da caixa de entrada
- **Senha**: Senha do email (ou senha de app)
- **Host IMAP**: Servidor IMAP (ex: `imap.gmail.com`)
- **Porta**: Porta IMAP (padrão: 993 com SSL)
- **SSL/TLS**: Usar conexão segura (recomendado: SIM)

### 2. **Controle de Monitoramento**
- **Ativo**: Liga/desliga o monitoramento (switch on/off)
- **Monitorar A Partir De**: Data inicial - ignora emails anteriores
- **Intervalo de Verificação**: Quantos minutos entre cada verificação (padrão: 15 min)

### 3. **Controle Interno (automático)**
- **last_checked_at**: Última vez que a caixa foi verificada
- **last_email_id**: UID do último email processado (evita duplicatas)

---

## 🔄 Fluxo de Monitoramento

### **Passo 1: Verificação de Monitores Ativos**
```
A cada X minutos (definido por um cron job ou scheduler):
1. Sistema busca todos os monitores com `active = true`
2. Verifica se já passou o intervalo (`check_interval_minutes`)
3. Se sim, inicia o processo de verificação
```

### **Passo 2: Conexão com o Email**
```
1. Conecta ao servidor IMAP usando as credenciais
2. Abre a pasta INBOX
3. Verifica se a conexão foi bem-sucedida
```

### **Passo 3: Busca de Emails**
```
CRITÉRIOS DE BUSCA:

1. Se `monitor_since` está definido:
   → Busca apenas emails APÓS esta data
   
2. Se `last_email_id` existe:
   → Busca apenas UIDs maiores que este (emails mais recentes)
   
3. Filtros adicionais:
   → Apenas emails com anexos
   → Anexos com extensão .xml
   → Status: não lidos OU todos (configurável)
```

### **Passo 4: Processamento de Cada Email**
```
Para cada email encontrado:

1. VERIFICAR ANEXOS
   - Verifica se tem arquivos anexados
   - Filtra apenas arquivos .xml
   
2. VALIDAR XML
   - Verifica se é um XML válido de NFe/NFCe
   - Valida a chave de acesso (44 dígitos)
   - Verifica estrutura básica do XML
   
3. VERIFICAR DUPLICATA
   - Busca no banco pela chave de acesso
   - Se já existe, PULA este XML
   - Se não existe, PROCESSA
   
4. PROCESSAR XML
   - Salva o arquivo no storage
   - Extrai dados do XML (parser)
   - Cria empresa automaticamente se não existir
   - Salva registro no banco de dados
   - Vincula usuário/empresa ao XML
   
5. REGISTRAR UID DO EMAIL
   - Salva o UID deste email em `last_email_id`
   - Garante que não será processado novamente
```

### **Passo 5: Finalização**
```
1. Atualiza `last_checked_at` para o horário atual
2. Atualiza `last_email_id` com o último UID processado
3. Desconecta do servidor IMAP
4. Registra logs do processo (sucesso/erros)
```

---

## ⚙️ Lógica Anti-Duplicata

### **Múltiplas Camadas de Proteção:**

1. **last_email_id (UID)**
   - Cada email tem um UID único no servidor IMAP
   - Sistema salva o último UID processado
   - Próxima verificação só busca UIDs maiores
   - **Garante**: Mesmo email nunca é lido duas vezes

2. **Chave de Acesso do XML**
   - Cada NFe tem chave única de 44 dígitos
   - Sistema verifica se chave já existe no banco
   - Se existe, XML é ignorado
   - **Garante**: Mesmo XML nunca é salvo duas vezes

3. **Filepath no Storage**
   - Arquivos são salvos com a chave no nome
   - Sistema verifica se arquivo já existe
   - Se existe, não sobrescreve
   - **Garante**: Arquivo não é sobrescrito

---

## ⏱️ Estratégia de Intervalo

### **Intervalos Recomendados:**
- **15 minutos**: Balanceado (padrão)
- **30 minutos**: Conservador (menos requisições)
- **5 minutos**: Agressivo (tempo real, mais recursos)
- **60+ minutos**: Lento (apenas verificações periódicas)

### **Por que NÃO tempo real?**
1. Servidores IMAP podem limitar conexões frequentes
2. Consumo desnecessário de recursos
3. Risco de bloqueio por "spam" de conexões
4. 15 minutos é suficiente para maioria dos casos

---

## 📊 Exemplo de Cenário Real

### **Situação:**
- Empresa tem 500 emails na caixa
- Configura monitor com data inicial: **01/11/2025**
- Intervalo: **15 minutos**

### **O que acontece:**

**1ª Verificação (08:00):**
```
- Sistema conecta ao email
- Busca emails de 01/11/2025 até agora
- Encontra 50 emails com XMLs
- Processa os 50 XMLs
- Salva last_email_id = UID do email mais recente
- Próxima verificação: 08:15
```

**2ª Verificação (08:15):**
```
- Sistema conecta novamente
- Busca APENAS emails com UID > last_email_id
- Encontra 2 novos emails
- Processa os 2 XMLs
- Atualiza last_email_id
- Próxima verificação: 08:30
```

**3ª Verificação (08:30):**
```
- Sistema conecta
- Busca emails com UID > last_email_id
- Não encontra novos emails
- Apenas atualiza last_checked_at
- Próxima verificação: 08:45
```

---

## 🛡️ Segurança

### **Senha do Email:**
- Armazenada CRIPTOGRAFADA no banco
- Nunca exposta em logs
- Recomenda-se usar "Senha de App" (Gmail, Outlook)

### **Proteção Anti-Duplicata:**
- Três camadas de verificação
- Impossível processar mesmo XML duas vezes

### **Controle de Acesso:**
- Apenas admin pode cadastrar monitores
- Monitor vinculado a empresa específica
- XMLs aparecem apenas para empresas relacionadas

---

## 🚀 Implementação Técnica

### **Serviço de Monitoramento** (a ser criado)
```typescript
// server/emailMonitorService.ts

class EmailMonitorService {
  async checkAllMonitors() {
    // Busca monitores ativos
    // Verifica intervalo
    // Processa cada monitor
  }
  
  async processMonitor(monitor: EmailMonitor) {
    // Conecta ao IMAP
    // Busca emails novos
    // Processa XMLs
    // Atualiza last_checked_at e last_email_id
  }
  
  async processEmail(email: Email, monitor: EmailMonitor) {
    // Extrai anexos .xml
    // Valida e processa cada XML
    // Salva no sistema
  }
}
```

### **Scheduler** (cron job)
```typescript
// Executa a cada 5 minutos
// Verifica quais monitores precisam ser executados
// Baseado no check_interval_minutes de cada um
```

---

## 📝 Logs e Auditoria

O sistema registra:
- ✅ Conexões bem-sucedidas
- ❌ Erros de conexão
- 📨 Quantidade de emails verificados
- 📄 XMLs processados
- ⚠️ XMLs duplicados ignorados
- 🔄 Horário da última verificação

---

## ⚡ Performance

### **Otimizações:**
1. Busca apenas emails novos (UID)
2. Filtra apenas anexos .xml no servidor
3. Processa em lote quando possível
4. Desconecta imediatamente após processar
5. Cache de empresas já criadas

### **Limites:**
- Máximo de conexões simultâneas: configurável
- Timeout de conexão: 30 segundos
- Timeout de processamento: 5 minutos por monitor

---

## 🎯 Resumo

**O sistema é:**
- ✅ Inteligente (evita duplicatas)
- ✅ Eficiente (processa apenas o novo)
- ✅ Configurável (intervalos personalizados)
- ✅ Seguro (senhas criptografadas)
- ✅ Confiável (múltiplas camadas de validação)

**Não precisa se preocupar com:**
- ❌ Processar mesmo email duas vezes
- ❌ Salvar XML duplicado
- ❌ Sobrecarregar o servidor de email
- ❌ Perder XMLs importantes








