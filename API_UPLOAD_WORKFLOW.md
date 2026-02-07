# API Upload - Workflow e exemplos (cURL)

Este documento descreve como gerar uma API key e enviar XMLs por API.

## 1) Pré-requisitos

- Empresa criada no portal (CNPJ correto).
- Usuário ativo com acesso à empresa.
- Migração aplicada: `server/migrations/018_create_api_keys.sql`.

## 2) Login (JWT)

Use o login para obter o token JWT.

```bash
curl -X POST "https://SEU_DOMINIO/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "usuario@exemplo.com",
    "password": "SENHA"
  }'
```

Resposta (exemplo):

```json
{
  "user": { "id": "...", "email": "...", "name": "...", "role": "cliente", "active": true },
  "token": "JWT_AQUI",
  "accessLogId": "..."
}
```

## 3) Criar API Key (com JWT)

Você pode criar a API key **via portal** (tela já existente) ou via API.

### 3.1 Pelo portal

- Menu: `Configurações > API Keys`
- Selecione a empresa no topo.
- Gere a chave e copie o valor completo (exibido uma única vez).

### 3.2 Via API

Gera uma API key específica para uma empresa.

```bash
curl -X POST "https://SEU_DOMINIO/api/api-keys" \
  -H "Authorization: Bearer JWT_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "companyId": "UUID_DA_EMPRESA",
    "name": "AppMonitorXML"
  }'
```

Resposta (exemplo):

```json
{
  "id": "UUID_DA_CHAVE",
  "name": "AppMonitorXML",
  "keyPrefix": "ak_12345678",
  "createdAt": "2026-02-06T12:00:00.000Z",
  "apiKey": "ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**Atenção:** a chave completa (`apiKey`) é retornada **uma única vez**. Salve no app.

### 3.3 Criação automática (sem operador)

Endpoint público para bootstrap da API key:

`POST /api/public/api-key`

Body:

```json
{
  "cnpj": "12345678000190",
  "token": "TOKEN_DIARIO",
  "name": "AppMonitorXML"
}
```

#### Como gerar o token diário

**Regra:** `HMAC_SHA256(secret, cnpj + ":" + yyyymmdd)`

O servidor usa a variável `API_KEY_BOOTSTRAP_SECRET`.  
Aceita token de **hoje** e **ontem** (para tolerar fuso).

Exemplo em Node.js:

```javascript
import crypto from "crypto";

function tokenDiario(cnpj, secret, date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const yyyymmdd = `${y}${m}${d}`;
  return crypto
    .createHmac("sha256", secret)
    .update(`${cnpj}:${yyyymmdd}`)
    .digest("hex");
}
```

Exemplo cURL:

```bash
curl -X POST "https://SEU_DOMINIO/api/public/api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "cnpj": "12345678000190",
    "token": "TOKEN_DIARIO",
    "name": "AppMonitorXML"
  }'
```

Resposta (exemplo):

```json
{
  "id": "UUID_DA_CHAVE",
  "name": "AppMonitorXML",
  "keyPrefix": "ak_12345678",
  "createdAt": "2026-02-06T12:00:00.000Z",
  "apiKey": "ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

## 4) Enviar XMLs de NFe/NFCe (notas)

Endpoint: `POST /api/api-upload`  
Header obrigatório: `x-api-key`

```bash
curl -X POST "https://SEU_DOMINIO/api/api-upload" \
  -H "x-api-key: SUA_API_KEY" \
  -F "files=@/caminho/nota1.xml" \
  -F "files=@/caminho/nota2.xml"
```

Também aceita arquivos compactados:

```bash
curl -X POST "https://SEU_DOMINIO/api/api-upload" \
  -H "x-api-key: SUA_API_KEY" \
  -F "files=@/caminho/lote-notas.zip"
```

Restrições principais:
- XML precisa ser autorizado na SEFAZ (`cStat=100`).
- Chave deve ter 44 dígitos.
- O CNPJ do XML precisa ser o mesmo da empresa vinculada à API key.

## 5) Enviar XMLs de eventos (cancelamento, inutilização, etc)

Endpoint: `POST /api/api-xml-events/upload`  
Header obrigatório: `x-api-key`

```bash
curl -X POST "https://SEU_DOMINIO/api/api-xml-events/upload" \
  -H "x-api-key: SUA_API_KEY" \
  -F "files=@/caminho/evento1.xml" \
  -F "files=@/caminho/evento2.xml"
```

Também aceita arquivos compactados:

```bash
curl -X POST "https://SEU_DOMINIO/api/api-xml-events/upload" \
  -H "x-api-key: SUA_API_KEY" \
  -F "files=@/caminho/eventos.zip"
```

Regras:
- XML deve ser `procEventoNFe` válido.
- O CNPJ do evento precisa ser o mesmo da empresa da API key.
- Duplicidades são rejeitadas.

## 6) Listar e revogar API Keys (JWT)

Listar:

```bash
curl -X GET "https://SEU_DOMINIO/api/api-keys?companyId=UUID_DA_EMPRESA" \
  -H "Authorization: Bearer JWT_AQUI"
```

Revogar:

```bash
curl -X DELETE "https://SEU_DOMINIO/api/api-keys/UUID_DA_CHAVE" \
  -H "Authorization: Bearer JWT_AQUI"
```

## 7) Workflow sugerido para o app

1. Login (JWT) → salvar token.
2. Criar API key para a empresa (uma vez).
3. Armazenar API key no app (config local segura).
4. Enviar XMLs:
   - Notas → `/api/api-upload`
   - Eventos → `/api/api-xml-events/upload`
5. Tratar erros e repetir apenas o que falhou.
6. Se a API key for revogada, gerar outra e atualizar no app.

## 8) Erros comuns

- `401 Invalid API key`: chave inválida ou revogada.
- `403 Usuário não possui empresas vinculadas`: empresa errada ou sem acesso.
- `XML não autorizado`: SEFAZ não autorizou a nota.
- `CNPJ do XML não pertence`: XML de outra empresa.
- `Nenhum XML encontrado no arquivo ZIP`: arquivo compactado sem XMLs válidos.

## 9) Limites de upload

- Tamanho máximo por arquivo: `UPLOAD_MAX_FILE_MB` (default 200MB).
- Máximo de XMLs extraídos por ZIP/RAR: `UPLOAD_MAX_EXTRACTED_FILES` (default 20000).
- Tamanho total extraído por ZIP/RAR: `UPLOAD_MAX_EXTRACTED_MB` (default 200MB).

## 10) Observações de segurança

- Use HTTPS.
- Proteja a API key no app (não logar).
- Revogue e regenere se houver vazamento.

Se quiser, posso acrescentar um helper em C# para ler/gravar `.env` automaticamente.
