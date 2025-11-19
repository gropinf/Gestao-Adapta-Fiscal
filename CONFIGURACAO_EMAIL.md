# 📧 Configuração de Email - Adapta Fiscal

## Visão Geral

O sistema Adapta Fiscal utiliza **um único email** para enviar todas as mensagens, incluindo:

- ✉️ Emails de ativação de usuários
- 🔑 Emails de recuperação de senha
- 📦 Envio de XMLs compactados para contabilidade
- 🔔 Notificações do sistema
- ⚠️ Alertas automáticos

## Configuração do .env

As configurações de email são definidas no arquivo `.env` na raiz do projeto. Use o arquivo `.env.example` como referência.

### Variáveis Obrigatórias

```env
EMAIL_HOST=smtp.gmail.com        # Servidor SMTP
EMAIL_PORT=587                   # Porta SMTP
EMAIL_SECURE=false               # true para porta 465, false para 587
EMAIL_USER=seu-email@exemplo.com # Email de autenticação
EMAIL_PASSWORD=sua-senha          # Senha ou App Password
EMAIL_FROM=Adapta Fiscal <seu-email@exemplo.com> # Remetente
```

## Configurações por Provedor

### Gmail (Recomendado)

1. **Habilite a verificação em duas etapas:**
   - Acesse: https://myaccount.google.com/security
   - Ative a "Verificação em duas etapas"

2. **Crie uma Senha de App:**
   - Acesse: https://myaccount.google.com/apppasswords
   - Selecione "Email" e "Computador"
   - Copie a senha gerada (16 caracteres)

3. **Configure o .env:**
   ```env
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_SECURE=false
   EMAIL_USER=seu-email@gmail.com
   EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
   EMAIL_FROM=Adapta Fiscal <seu-email@gmail.com>
   ```

### Outlook / Office 365

```env
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=seu-email@outlook.com
EMAIL_PASSWORD=sua-senha
EMAIL_FROM=Adapta Fiscal <seu-email@outlook.com>
```

### Yahoo Mail

```env
EMAIL_HOST=smtp.mail.yahoo.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=seu-email@yahoo.com
EMAIL_PASSWORD=sua-senha-de-app
EMAIL_FROM=Adapta Fiscal <seu-email@yahoo.com>
```

**Nota:** Yahoo também requer senha de app. Acesse: https://login.yahoo.com/account/security

### SendGrid (Serviço profissional)

```env
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=apikey
EMAIL_PASSWORD=SG.xxxxxxxxxxxxxxxx
EMAIL_FROM=Adapta Fiscal <seu-email-verificado@exemplo.com>
```

## Funcionalidades de Email

### 1. Envio de XMLs para Contabilidade

**Endpoint:** `POST /api/xml-email/send`

**Características:**
- Compacta XMLs do período em arquivo ZIP
- Nome do arquivo: `xml_CNPJ_DTINICIO_DTFIM_RAZAOSOCIAL.zip`
- Email HTML formatado com dados da empresa
- Histórico completo de envios

**Exemplo de uso:**
```javascript
{
  "companyId": "123",
  "periodStart": "2025-01-01",
  "periodEnd": "2025-01-31",
  "destinationEmail": "contabilidade@exemplo.com"
}
```

### 2. Ativação de Usuários

Enviado automaticamente quando um novo usuário é criado:
- Link de ativação válido por 24 horas
- Email HTML com instruções

### 3. Recuperação de Senha

Enviado ao solicitar "Esqueci minha senha":
- Link válido por 1 hora
- Email HTML com instruções de segurança

## Teste de Configuração

### Via Interface (Recomendado)

1. Acesse a página de Monitoramento de Email
2. Clique em "Testar Conexão"
3. Verifique se o teste foi bem-sucedido

### Via Terminal

Execute o script de teste:

```bash
npm run test:email
```

## Troubleshooting

### ❌ Erro: "Invalid login credentials"

**Causas comuns:**
- Senha incorreta
- Gmail sem senha de app (use senha de app!)
- Verificação em duas etapas não ativada

**Solução:**
- Verifique as credenciais
- Para Gmail, use senha de app ao invés da senha normal

### ❌ Erro: "Connection timeout"

**Causas comuns:**
- Porta bloqueada pelo firewall
- Servidor SMTP incorreto
- Rede com restrições

**Solução:**
- Verifique se a porta 587 está liberada
- Confirme o servidor SMTP correto
- Teste com outro provedor

### ❌ Erro: "Self-signed certificate"

**Solução:**
```env
NODE_TLS_REJECT_UNAUTHORIZED=0  # Apenas para testes locais
```

**⚠️ ATENÇÃO:** Não use em produção!

### ❌ Emails não chegam

**Verifique:**
- Caixa de spam do destinatário
- Limites de envio do provedor (Gmail: 500/dia)
- Status do email remetente (não bloqueado)
- Logs do sistema (`console.log` no terminal)

## Segurança

### ✅ Boas Práticas

1. **Nunca commite credenciais:**
   ```bash
   echo ".env" >> .gitignore
   ```

2. **Use variáveis de ambiente em produção:**
   - Replit Secrets
   - Railway Environment Variables
   - Heroku Config Vars
   - Docker Secrets

3. **Rotação de senhas:**
   - Altere senhas periodicamente
   - Revogue senhas de app antigas

4. **Monitore os logs:**
   - Verifique tentativas de envio
   - Identifique falhas rapidamente

### 🔒 Armazenamento Seguro

Em produção, use serviços de gerenciamento de secrets:

- AWS Secrets Manager
- Google Cloud Secret Manager
- Azure Key Vault
- HashiCorp Vault

## Limites de Envio

### Gmail (Gratuito)
- **500 emails/dia** (conta pessoal)
- **2000 emails/dia** (Google Workspace)

### Outlook (Gratuito)
- **300 emails/dia**

### Yahoo (Gratuito)
- **500 emails/dia**

### SendGrid (Pago)
- A partir de 40.000 emails/mês
- Planos profissionais com IP dedicado

## Monitoramento

O sistema registra todos os envios na tabela `xml_email_history`:

```sql
SELECT * FROM xml_email_history
ORDER BY created_at DESC
LIMIT 10;
```

Campos registrados:
- `destination_email` - Email de destino
- `xml_count` - Quantidade de XMLs enviados
- `zip_filename` - Nome do arquivo gerado
- `status` - success ou failed
- `error_message` - Mensagem de erro (se houver)
- `created_at` - Data/hora do envio

## Suporte

Para problemas com configuração de email:

1. Consulte este guia
2. Verifique os logs do sistema
3. Teste a conexão SMTP
4. Entre em contato com o suporte técnico

---

**Última atualização:** 06/11/2025  
**Versão:** 1.0





