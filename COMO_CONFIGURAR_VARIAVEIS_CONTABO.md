# 🔧 Como Configurar Variáveis de Ambiente do Contabo

## No Replit

### Opção 1: Via Secrets (Recomendado)

1. No Replit, clique no ícone de **"Secrets"** (🔒) na barra lateral esquerda
2. Adicione as seguintes variáveis:

```
CONTABO_STORAGE_ENDPOINT = https://usc1.contabostorage.com
CONTABO_STORAGE_REGION = usc1
CONTABO_STORAGE_BUCKET = caixafacil
CONTABO_STORAGE_ACCESS_KEY = sua-access-key-aqui
CONTABO_STORAGE_SECRET_KEY = sua-secret-key-aqui
CONTABO_STORAGE_PUBLIC_PREFIX = seu-tenant-id-aqui
```

### Opção 2: Via arquivo .env

Crie um arquivo `.env` na raiz do projeto:

```env
CONTABO_STORAGE_ENDPOINT=https://usc1.contabostorage.com
CONTABO_STORAGE_REGION=usc1
CONTABO_STORAGE_BUCKET=caixafacil
CONTABO_STORAGE_ACCESS_KEY=sua-access-key-aqui
CONTABO_STORAGE_SECRET_KEY=sua-secret-key-aqui
CONTABO_STORAGE_PUBLIC_PREFIX=seu-tenant-id-aqui
```

⚠️ **IMPORTANTE**: Não commite o arquivo `.env` no Git! Adicione ao `.gitignore`.

## Onde obter as credenciais?

1. Acesse: https://my.contabo.com
2. Vá para **Object Storage**
3. Selecione seu bucket
4. Vá em **Access Keys** ou **Credentials**
5. Copie:
   - **Access Key** → `CONTABO_STORAGE_ACCESS_KEY`
   - **Secret Key** → `CONTABO_STORAGE_SECRET_KEY`
   - **Tenant ID** ou **Public Prefix** → `CONTABO_STORAGE_PUBLIC_PREFIX`

## Endpoints disponíveis

- **EU (Europa)**: `https://eu2.contabostorage.com`
- **US (Estados Unidos)**: `https://usc1.contabostorage.com` ← Recomendado
- **SG (Singapura)**: `https://sin1.contabostorage.com`

## Verificar se está configurado

Execute o script de teste:

```bash
npx tsx server/test-contabo-connection.ts
```

Se aparecer "✅ Conexão com Contabo Storage OK!", está tudo certo!

## Problemas comuns

### "Variáveis de ambiente não configuradas"

**Solução**: Configure as variáveis via Secrets no Replit ou crie arquivo `.env`

### "Erro ao testar conexão"

**Solução**: 
1. Verifique se as credenciais estão corretas
2. Verifique se o bucket existe
3. Verifique se o endpoint está correto

### "403 Forbidden" ao acessar URLs

**Solução**: Configure `CONTABO_STORAGE_PUBLIC_PREFIX` com o Tenant ID correto
