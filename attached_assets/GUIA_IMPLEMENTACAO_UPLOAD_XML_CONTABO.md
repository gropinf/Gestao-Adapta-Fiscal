# 📄 GUIA DE IMPLEMENTAÇÃO - UPLOAD DE XML PARA CONTABO STORAGE

Este documento apresenta um guia completo para implementar upload de arquivos XML para o Contabo Object Storage, organizados por CNPJ da empresa e subpasta `xml`.

---

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Estrutura de Armazenamento](#estrutura-de-armazenamento)
4. [Implementação Backend](#implementação-backend)
5. [Implementação Frontend](#implementação-frontend)
6. [Exemplo Completo de Uso](#exemplo-completo-de-uso)
7. [Variáveis de Ambiente](#variáveis-de-ambiente)
8. [Tratamento de Erros](#tratamento-de-erros)
9. [Checklist de Implementação](#checklist-de-implementação)

---

## 🎯 VISÃO GERAL

O sistema de upload de XML utiliza o **Contabo Object Storage**, que é compatível com a API S3 da AWS. Os arquivos XML são organizados por **CNPJ da empresa** e salvos na subpasta `xml` para facilitar o gerenciamento.

**Estrutura de armazenamento:**
```
{CNPJ}/xml/{nomeArquivo}.xml
Exemplo: 12345678000190/xml/NFe-123456-2024.xml
```

**Características:**
- ✅ Organização por CNPJ da empresa
- ✅ Subpasta `xml` para separar de outros tipos de arquivo
- ✅ Suporte a nomes personalizados ou gerados automaticamente
- ✅ URLs públicas ou assinadas (presigned)
- ✅ Validação de tipo e tamanho

---

## 🏗️ ARQUITETURA DO SISTEMA

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Componente de Upload)                             │
│  - Usuário seleciona arquivo XML                            │
│  - Validação inicial (tipo, tamanho)                       │
│  - Envia para API via FormData                              │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  API Route (app/api/storage/upload-xml/route.ts)             │
│  - Autenticação (withAuth)                                   │
│  - Valida arquivo (tipo XML, tamanho)                        │
│  - Busca CNPJ da empresa                                     │
│  - Chama função de upload                                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Storage Library (lib/storage.ts)                            │
│  - Configura cliente S3 (Contabo)                            │
│  - Faz upload para o bucket                                  │
│  - Retorna URL pública                                       │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Contabo Object Storage (S3-Compatible)                      │
│  - Armazena arquivo XML                                       │
│  - Fornece URL pública                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 ESTRUTURA DE ARMAZENAMENTO

### Organização por CNPJ

Os arquivos XML são organizados na seguinte estrutura:

```
Bucket: caixafacil (ou configurado em CONTABO_STORAGE_BUCKET)

Estrutura:
{CNPJ}/xml/{nomeArquivo}.xml

Exemplos:
12345678000190/xml/NFe-123456-2024.xml
12345678000190/xml/NF-e-35240112345678000190550010000001234567890123.xml
98765432000198/xml/entrada-mercadorias-2024-01-15.xml
```

### Vantagens dessa estrutura:

1. **Organização por empresa**: Fácil identificar arquivos de cada empresa
2. **Separação por tipo**: Subpasta `xml` separa de outros arquivos (imagens, PDFs, etc)
3. **Fácil remoção**: Pode deletar todos os XMLs de uma empresa deletando a pasta
4. **Nomes únicos**: Pode usar chave de acesso, número da nota, ou nome personalizado

---

## 💻 IMPLEMENTAÇÃO BACKEND

### 1. Biblioteca de Storage (já existe)

A função `uploadFile()` em `lib/storage.ts` já suporta upload de qualquer tipo de arquivo, incluindo XML:

```typescript
// lib/storage.ts

/**
 * Upload de arquivo para o storage
 * @param file Buffer ou string (base64) do arquivo
 * @param fileName Nome do arquivo (será gerado automaticamente se não fornecido)
 * @param folder Pasta onde o arquivo será salvo (ex: 'xml', 'produtos')
 * @param contentType Tipo MIME do arquivo
 * @param cnpj CNPJ da empresa (opcional - se fornecido, organiza por CNPJ)
 * @param entityId ID da entidade (opcional - se fornecido, usa como nome do arquivo)
 * @returns URL pública do arquivo
 */
export async function uploadFile(
  file: Buffer | string,
  fileName?: string,
  folder: string = 'uploads',
  contentType?: string,
  cnpj?: string,
  entityId?: string
): Promise<string>
```

**Para XML, use:**
- `folder: 'xml'` - Define a subpasta como `xml`
- `contentType: 'application/xml'` ou `'text/xml'` - Tipo MIME do XML
- `cnpj: string` - CNPJ da empresa (obrigatório para organização)
- `fileName: string` - Nome do arquivo (ex: `'NFe-123456-2024.xml'`)

### 2. API Route - Upload de XML

Crie uma nova rota em `app/api/storage/upload-xml/route.ts`:

```typescript
// app/api/storage/upload-xml/route.ts

import { withAuth, successResponse, errorResponse, AuthenticatedRequest } from '@/lib/api-middleware';
import { uploadFile } from '@/lib/storage';
import { getEmpresaCnpj } from '@/lib/storage-helpers';

/**
 * POST /api/storage/upload-xml
 * Upload de arquivo XML para o storage Contabo
 */
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const empresaId = request.empresaId;
    
    // Buscar CNPJ da empresa
    const cnpj = await getEmpresaCnpj(empresaId);
    if (!cnpj) {
      return errorResponse('Empresa não encontrada ou sem CNPJ cadastrado', 400);
    }
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const fileName = formData.get('fileName') as string; // Nome opcional (ex: 'NFe-123456-2024.xml')
    const chaveNfe = formData.get('chaveNfe') as string; // Chave de acesso da NFe (opcional, usado como nome se fileName não fornecido)

    if (!file) {
      return errorResponse('Arquivo não fornecido', 400);
    }

    // Validar tipo de arquivo
    const fileExtension = file.name.toLowerCase().split('.').pop();
    if (fileExtension !== 'xml') {
      return errorResponse('Apenas arquivos XML são permitidos', 400);
    }

    // Validar Content-Type (opcional, mas recomendado)
    const contentType = file.type;
    if (contentType && !contentType.includes('xml') && contentType !== 'application/xml' && contentType !== 'text/xml') {
      console.warn(`Content-Type inesperado: ${contentType}. Continuando mesmo assim...`);
    }

    // Validar tamanho (máximo 10MB para XML - pode ser maior que imagens)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return errorResponse('Arquivo muito grande. Máximo permitido: 10MB', 400);
    }

    // Converter File para Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Gerar nome do arquivo
    let finalFileName: string;
    if (fileName) {
      // Usar nome fornecido (garantir extensão .xml)
      finalFileName = fileName.endsWith('.xml') ? fileName : `${fileName}.xml`;
    } else if (chaveNfe) {
      // Usar chave de acesso da NFe como nome
      finalFileName = `NFe-${chaveNfe}.xml`;
    } else {
      // Gerar nome único baseado em timestamp
      const timestamp = Date.now();
      finalFileName = `xml-${timestamp}.xml`;
    }

    // Fazer upload para o storage usando estrutura por CNPJ
    // Estrutura: {cnpj}/xml/{fileName}
    const url = await uploadFile(
      buffer,
      finalFileName,
      'xml', // Subpasta xml
      'application/xml', // Content-Type
      cnpj, // CNPJ da empresa
      undefined // Não usar entityId para XML (usa fileName)
    );

    return successResponse({ 
      url, 
      fileName: finalFileName,
      cnpj: cnpj.replace(/[^\d]/g, ''), // CNPJ limpo
      path: `${cnpj.replace(/[^\d]/g, '')}/xml/${finalFileName}` // Caminho completo no storage
    });
  } catch (error) {
    console.error('Erro ao fazer upload de XML:', error);
    
    // Log detalhado para debug
    if (error instanceof Error) {
      console.error('Erro detalhado no upload de XML:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        empresaId: request.empresaId,
      });
    } else {
      console.error('Erro objeto no upload de XML:', JSON.stringify(error, null, 2));
    }
    
    return errorResponse(
      error instanceof Error ? error.message : 'Erro ao fazer upload de XML',
      500
    );
  }
});
```

**Pontos importantes:**
- ✅ Autenticação obrigatória via `withAuth`
- ✅ Busca CNPJ da empresa automaticamente
- ✅ Validações: arquivo presente, tipo XML, tamanho máximo (10MB)
- ✅ Suporta nome personalizado ou geração automática
- ✅ Suporta usar chave de acesso da NFe como nome
- ✅ Converte File para Buffer para upload
- ✅ Usa subpasta `xml` para organização

### 3. Helper - Buscar CNPJ da Empresa (já existe)

A função `getEmpresaCnpj()` em `lib/storage-helpers.ts` já existe e pode ser reutilizada:

```typescript
// lib/storage-helpers.ts

/**
 * Busca o CNPJ da empresa pelo ID
 * @param empresaId ID da empresa (UUID)
 * @returns CNPJ da empresa ou null se não encontrado
 */
export async function getEmpresaCnpj(empresaId: string): Promise<string | null>
```

---

## 🎨 IMPLEMENTAÇÃO FRONTEND

### 1. Componente de Upload de XML

Exemplo de componente React para upload de XML:

```typescript
// components/caixa-facil/xml-upload.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, FileXml, X } from 'lucide-react';
import { showToast } from '@/lib/toast';

interface XmlUploadProps {
  onUploadSuccess?: (url: string, fileName: string) => void;
  onUploadError?: (error: string) => void;
  fileName?: string; // Nome opcional do arquivo
  chaveNfe?: string; // Chave de acesso da NFe (opcional)
  maxSize?: number; // Tamanho máximo em bytes (padrão: 10MB)
}

export default function XmlUpload({
  onUploadSuccess,
  onUploadError,
  fileName,
  chaveNfe,
  maxSize = 10 * 1024 * 1024, // 10MB padrão
}: XmlUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar extensão
    if (!file.name.toLowerCase().endsWith('.xml')) {
      showToast('Aviso', 'Por favor, selecione um arquivo XML válido', 'info');
      return;
    }

    // Validar tamanho
    if (file.size > maxSize) {
      showToast('Aviso', `O arquivo deve ter no máximo ${(maxSize / 1024 / 1024).toFixed(0)}MB`, 'info');
      return;
    }

    setSelectedFile(file);
    setUploadedUrl(null);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      showToast('Aviso', 'Por favor, selecione um arquivo XML', 'info');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      
      // Adicionar nome do arquivo se fornecido
      if (fileName) {
        formData.append('fileName', fileName);
      }
      
      // Adicionar chave de acesso da NFe se fornecido
      if (chaveNfe) {
        formData.append('chaveNfe', chaveNfe);
      }

      const response = await fetch('/api/storage/upload-xml', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao fazer upload do XML');
      }

      const data = await response.json();
      const { url, fileName: uploadedFileName } = data;

      setUploadedUrl(url);
      
      if (onUploadSuccess) {
        onUploadSuccess(url, uploadedFileName);
      }

      showToast('Sucesso', 'XML enviado com sucesso!', 'success');
    } catch (error) {
      console.error('Erro ao fazer upload de XML:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer upload de XML';
      
      if (onUploadError) {
        onUploadError(errorMessage);
      }
      
      showToast('Erro', errorMessage, 'destructive');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setUploadedUrl(null);
    // Resetar input
    const input = document.getElementById('xml-upload-input') as HTMLInputElement;
    if (input) {
      input.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Input
            id="xml-upload-input"
            type="file"
            accept=".xml,application/xml,text/xml"
            onChange={handleFileSelect}
            disabled={uploading}
            className="cursor-pointer"
          />
        </div>
        {selectedFile && (
          <Button
            onClick={handleUpload}
            disabled={uploading}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
          >
            {uploading ? 'Enviando...' : 'Enviar XML'}
          </Button>
        )}
        {selectedFile && (
          <Button
            onClick={handleRemove}
            disabled={uploading}
            variant="outline"
            size="icon"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {selectedFile && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
          <FileXml className="w-5 h-5 text-blue-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
            <p className="text-xs text-gray-500">
              {(selectedFile.size / 1024).toFixed(2)} KB
            </p>
          </div>
        </div>
      )}

      {uploadedUrl && (
        <div className="p-3 bg-green-50 rounded-lg">
          <p className="text-sm text-green-800">
            ✅ XML enviado com sucesso!
          </p>
          <p className="text-xs text-green-600 mt-1 break-all">
            {uploadedUrl}
          </p>
        </div>
      )}
    </div>
  );
}
```

**Pontos importantes:**
- ✅ Validação de tipo: apenas XML
- ✅ Validação de tamanho: máximo 10MB (configurável)
- ✅ Suporte a nome personalizado ou chave de acesso
- ✅ Feedback visual durante upload
- ✅ Callbacks para sucesso e erro
- ✅ Exibe URL após upload bem-sucedido

### 2. Uso do Componente

Exemplo de uso em uma página ou modal:

```typescript
// app/estoque/entrada/page.tsx ou componente similar

import XmlUpload from '@/components/caixa-facil/xml-upload';

export default function EntradaMercadoriasPage() {
  const [xmlUrl, setXmlUrl] = useState<string | null>(null);

  const handleUploadSuccess = (url: string, fileName: string) => {
    setXmlUrl(url);
    console.log('XML enviado:', { url, fileName });
    // Aqui você pode processar o XML ou salvar a URL no banco de dados
  };

  const handleUploadError = (error: string) => {
    console.error('Erro no upload:', error);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Entrada de Mercadorias</h1>
      
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Upload de XML (NF-e)</h2>
        <XmlUpload
          onUploadSuccess={handleUploadSuccess}
          onUploadError={handleUploadError}
          fileName="NFe-entrada-mercadorias" // Opcional
          maxSize={10 * 1024 * 1024} // 10MB
        />
      </div>

      {xmlUrl && (
        <div className="card">
          <h3 className="text-md font-semibold mb-2">XML Enviado</h3>
          <a 
            href={xmlUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {xmlUrl}
          </a>
        </div>
      )}
    </div>
  );
}
```

---

## 📝 EXEMPLO COMPLETO DE USO

### Cenário: Upload de XML de NF-e para Entrada de Mercadorias

```
1. Usuário acessa página de Entrada de Mercadorias
   ↓
2. Usuário clica em "Selecionar XML"
   ↓
3. Componente valida:
   - É arquivo XML? Sim ✓
   - Tamanho < 10MB? Sim ✓
   ↓
4. Usuário clica em "Enviar XML"
   ↓
5. Frontend cria FormData:
   - file: File object (XML)
   - fileName: "NFe-entrada-mercadorias" (opcional)
   - chaveNfe: "35240112345678000190550010000001234567890123" (opcional)
   ↓
6. POST /api/storage/upload-xml
   ↓
7. API Route:
   - withAuth valida usuário ✓
   - Busca CNPJ: getEmpresaCnpj() → "12.345.678/0001-90"
   - Valida arquivo: tipo XML ✓, tamanho < 10MB ✓
   - Converte File para Buffer
   - Gera nome: "NFe-35240112345678000190550010000001234567890123.xml"
   ↓
8. uploadFile() em lib/storage.ts:
   - Sanitiza CNPJ: "12345678000190"
   - Gera key: "12345678000190/xml/NFe-35240112345678000190550010000001234567890123.xml"
   - Cria PutObjectCommand
   - Faz upload via S3Client.send()
   ↓
9. Retorna URL: "https://usc1.contabostorage.com/24f9183861e0407ea216a3a1e588a457:caixafacil/12345678000190/xml/NFe-35240112345678000190550010000001234567890123.xml"
   ↓
10. Frontend recebe URL
    ↓
11. Callback onUploadSuccess() é chamado
    ↓
12. URL pode ser salva no banco de dados ou processada
    ↓
13. XML disponível no storage Contabo ✅
```

---

## 🔧 VARIÁVEIS DE AMBIENTE

Configure as seguintes variáveis no arquivo `.env.local`:

```env
# CONTABO OBJECT STORAGE (Compatível com S3)
# Endpoints disponíveis:
# - EU (Europa): https://eu2.contabostorage.com
# - US (Estados Unidos): https://usc1.contabostorage.com  
# - SG (Singapura): https://sin1.contabostorage.com
CONTABO_STORAGE_ENDPOINT=https://usc1.contabostorage.com

# Região do storage
CONTABO_STORAGE_REGION=usc1

# Nome do bucket criado na Contabo
CONTABO_STORAGE_BUCKET=caixafacil

# Credenciais de acesso (obter no painel da Contabo)
CONTABO_STORAGE_ACCESS_KEY=sua-access-key-aqui
CONTABO_STORAGE_SECRET_KEY=sua-secret-key-aqui

# CONTABO OBJECT STORAGE - Configuração OBRIGATÓRIA para URLs públicas
# Tenant ID (Public Prefix) necessário para acesso público aos arquivos
# Formato: {tenantId} (ex: 24f9183861e0407ea216a3a1e588a457)
# Sem esta variável, as URLs retornarão 403 Forbidden
CONTABO_STORAGE_PUBLIC_PREFIX=24f9183861e0407ea216a3a1e588a457

# CONTABO OBJECT STORAGE - Configuração Opcional
# Se true, usa URLs assinadas (presigned) ao invés de URLs públicas
# URLs assinadas expiram após X dias (mais seguro, mas temporário)
# Se false ou não definido, usa URL pública com tenant ID (padrão)
CONTABO_USE_PRESIGNED_URLS=false

# Tempo de expiração das URLs assinadas em segundos (padrão: 604800 = 7 dias)
# Só usado se CONTABO_USE_PRESIGNED_URLS=true
CONTABO_PRESIGNED_URL_EXPIRY=604800
```

**Onde obter as credenciais:**
1. Acesse: https://my.contabo.com
2. Vá para **Object Storage**
3. Crie um bucket (se não existir)
4. Obtenha as credenciais:
   - **Access Key** → `CONTABO_STORAGE_ACCESS_KEY`
   - **Secret Key** → `CONTABO_STORAGE_SECRET_KEY`
   - **Tenant ID** ou **Public Prefix** → `CONTABO_STORAGE_PUBLIC_PREFIX`

**Importante:** O Tenant ID (`CONTABO_STORAGE_PUBLIC_PREFIX`) é necessário para gerar URLs públicas que funcionam. Sem ele, as URLs retornarão 403 Forbidden.

---

## 🚨 TRATAMENTO DE ERROS

### Erros Tratados na API:

```typescript
// Erro: Empresa sem CNPJ
if (!cnpj) {
  return errorResponse('Empresa não encontrada ou sem CNPJ cadastrado', 400);
}

// Erro: Arquivo não fornecido
if (!file) {
  return errorResponse('Arquivo não fornecido', 400);
}

// Erro: Tipo de arquivo inválido
if (fileExtension !== 'xml') {
  return errorResponse('Apenas arquivos XML são permitidos', 400);
}

// Erro: Arquivo muito grande
if (file.size > maxSize) {
  return errorResponse('Arquivo muito grande. Máximo permitido: 10MB', 400);
}
```

### Erros Tratados na Biblioteca de Storage:

A função `uploadFile()` em `lib/storage.ts` já trata os seguintes erros:

- **Erro de autenticação**: Credenciais inválidas
- **Erro de bucket**: Bucket não encontrado
- **Erro de conexão**: Problemas com endpoint
- **Erro de ACL**: Contabo pode não suportar ACL

### Erros Tratados no Frontend:

- **Tipo de arquivo inválido**: Mostra toast de aviso
- **Arquivo muito grande**: Mostra toast com tamanho máximo
- **Erro de upload**: Mostra toast de erro com mensagem
- **Sucesso**: Mostra toast de sucesso e exibe URL

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Backend:
- [ ] Criar rota `app/api/storage/upload-xml/route.ts`
- [ ] Implementar validações (tipo XML, tamanho máximo)
- [ ] Implementar busca de CNPJ da empresa
- [ ] Testar upload de XML de diferentes tamanhos
- [ ] Testar tratamento de erros
- [ ] Verificar logs de debug

### Frontend:
- [ ] Criar componente `components/caixa-facil/xml-upload.tsx`
- [ ] Implementar validações no frontend
- [ ] Implementar feedback visual (loading, sucesso, erro)
- [ ] Testar upload em diferentes cenários
- [ ] Integrar componente em páginas necessárias

### Configuração:
- [ ] Configurar variáveis de ambiente no `.env.local`
- [ ] Verificar credenciais do Contabo
- [ ] Verificar se bucket está público (se usar URLs públicas)
- [ ] Testar URL pública no navegador após upload

### Testes:
- [ ] Upload de XML válido (sucesso)
- [ ] Upload de arquivo não-XML (erro esperado)
- [ ] Upload de XML muito grande (erro esperado)
- [ ] Upload sem autenticação (erro esperado)
- [ ] Verificar URL gerada no storage
- [ ] Verificar acesso à URL pública
- [ ] Testar com diferentes nomes de arquivo
- [ ] Testar com chave de acesso da NFe

---

## 📚 REFERÊNCIAS

### Documentação Relacionada:
- `ANALISE_UPLOAD_IMAGENS_CONTABO.md` - Análise completa do upload de imagens (base para este guia)
- `CORRECAO_UPLOAD_CONTABO.md` - Correções e configurações do Contabo Storage
- `lib/storage.ts` - Biblioteca de storage (função `uploadFile()`)
- `lib/storage-helpers.ts` - Helpers de storage (função `getEmpresaCnpj()`)

### Documentação Externa:
- [Contabo Object Storage](https://www.contabo.com/en/object-storage/)
- [AWS SDK v3 - S3 Client](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/)
- [Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html)

---

## 🔍 DIFERENÇAS ENTRE UPLOAD DE IMAGENS E XML

| Aspecto | Imagens | XML |
|---------|---------|-----|
| **Subpasta** | `produtos`, `empresas`, etc | `xml` |
| **Content-Type** | `image/jpeg`, `image/png`, etc | `application/xml`, `text/xml` |
| **Tamanho máximo** | 5MB (padrão) | 10MB (recomendado) |
| **Nome do arquivo** | Geralmente usa `entityId` (UUID) | Geralmente usa nome descritivo ou chave de acesso |
| **Validação de tipo** | `file.type.startsWith('image/')` | `fileExtension === 'xml'` |
| **Uso de entityId** | Sim (para produtos, clientes, etc) | Não (usa fileName) |

---

## 📊 RESUMO

Este guia apresenta uma implementação completa de upload de XML para o Contabo Object Storage:

✅ **Organização por CNPJ**: Arquivos organizados por empresa  
✅ **Subpasta XML**: Separação clara de outros tipos de arquivo  
✅ **Validações robustas**: Tipo, tamanho, autenticação  
✅ **Flexibilidade**: Suporta nome personalizado ou geração automática  
✅ **URLs públicas ou assinadas**: Escolha entre segurança e simplicidade  
✅ **Tratamento de erros**: Mensagens claras e específicas  
✅ **Componente reutilizável**: Fácil de integrar em diferentes páginas  

**Próximos passos:**
1. Implementar a rota de upload de XML
2. Criar o componente de upload no frontend
3. Integrar em páginas que precisam de upload de XML
4. Testar em ambiente de desenvolvimento
5. Configurar variáveis de ambiente em produção

---

**Documento gerado em:** 2024  
**Versão:** 1.0.0  
**Baseado em:** Implementação existente de upload de imagens para Contabo Storage
