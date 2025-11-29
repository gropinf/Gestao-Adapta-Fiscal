# 📚 DOCUMENTAÇÃO COMPLETA - IMPLEMENTAÇÃO CONTABO OBJECT STORAGE

Este documento fornece todas as informações necessárias para implementar o Contabo Object Storage em um projeto Next.js, baseado na implementação já existente e testada.

---

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Pré-requisitos](#pré-requisitos)
3. [Configuração Inicial](#configuração-inicial)
4. [Instalação de Dependências](#instalação-de-dependências)
5. [Estrutura de Arquivos](#estrutura-de-arquivos)
6. [Implementação do Código](#implementação-do-código)
7. [APIs Necessárias](#apis-necessárias)
8. [Componente de Upload](#componente-de-upload)
9. [Testes e Validação](#testes-e-validação)
10. [Estrutura de Pastas no Storage](#estrutura-de-pastas-no-storage)

---

## 🎯 VISÃO GERAL

O Contabo Object Storage é compatível com a API S3 da AWS, permitindo armazenar arquivos (principalmente imagens) de forma escalável e econômica. Esta implementação organiza os arquivos por CNPJ da empresa, facilitando o gerenciamento e remoção quando necessário.

### Características:
- ✅ Compatível com S3 (usa AWS SDK)
- ✅ Organização por CNPJ da empresa
- ✅ Suporte a múltiplos tipos de entidades (clientes, produtos, empresas)
- ✅ Validação de tipos e tamanhos de arquivo
- ✅ URLs públicas ou assinadas
- ✅ Upload via arquivo ou câmera
- ✅ Remoção individual ou em lote

---

## 📦 PRÉ-REQUISITOS

1. **Conta na Contabo** com Object Storage ativado
2. **Bucket criado** no painel da Contabo
3. **Credenciais S3** (Access Key e Secret Key)
4. **Projeto Next.js** configurado
5. **Variáveis de ambiente** configuradas

---

## ⚙️ CONFIGURAÇÃO INICIAL

### 1. Obter Credenciais na Contabo

1. Acesse: https://my.contabo.com
2. Vá em **Object Storage**
3. Crie um bucket (ex: `meuprojeto`)
4. Vá em **S3 Object Storage Credentials**
5. Copie:
   - **Access Key** → `CONTABO_STORAGE_ACCESS_KEY`
   - **Secret Key** → `CONTABO_STORAGE_SECRET_KEY`

### 2. Configurar Variáveis de Ambiente

Adicione ao arquivo `.env.local`:

```env
# ===========================================
# CONTABO OBJECT STORAGE (Compatível com S3)
# ===========================================

# Endpoint - Depende da região:
# - EU (Europa): https://eu2.contabostorage.com
# - US (Estados Unidos): https://usc1.contabostorage.com  
# - SG (Singapura): https://sin1.contabostorage.com
CONTABO_STORAGE_ENDPOINT=https://usc1.contabostorage.com

# Região do bucket (deve corresponder ao endpoint)
CONTABO_STORAGE_REGION=usc1

# Nome do bucket criado na Contabo
CONTABO_STORAGE_BUCKET=meuprojeto

# Credenciais de acesso (obter no painel da Contabo)
CONTABO_STORAGE_ACCESS_KEY=sua-access-key-aqui
CONTABO_STORAGE_SECRET_KEY=sua-secret-key-aqui

# URL pública do storage (opcional - se o bucket for público)
# Se configurado, será usado para gerar URLs públicas
# Exemplo: https://meuprojeto.usc1.contabostorage.com
# CONTABO_STORAGE_PUBLIC_URL=https://meuprojeto.usc1.contabostorage.com
```

### 3. Configurar Permissões do Bucket

**Opção A: Bucket Público (Recomendado para imagens)**
- Configure o bucket como público no painel da Contabo
- As imagens serão acessíveis diretamente via URL

**Opção B: Bucket Privado**
- Mantenha o bucket privado
- O sistema gerará URLs assinadas (expirando em 1 hora)

---

## 📥 INSTALAÇÃO DE DEPENDÊNCIAS

Execute no terminal:

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

Ou com yarn:

```bash
yarn add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### Dependências necessárias:
- `@aws-sdk/client-s3`: Cliente S3 para interagir com o storage
- `@aws-sdk/s3-request-presigner`: Gerar URLs assinadas (opcional, se usar bucket privado)

---

## 📁 ESTRUTURA DE ARQUIVOS

Crie a seguinte estrutura no seu projeto:

```
projeto/
├── lib/
│   └── storage.ts                    # Biblioteca principal do storage
├── app/
│   └── api/
│       ├── upload/
│       │   └── route.ts              # API de upload/delete de imagens
│       └── storage/
│           ├── test/
│           │   └── route.ts          # API para testar conexão
│           └── empresa/
│               └── [cnpj]/
│                   └── route.ts      # API para gerenciar arquivos por empresa
└── components/
    └── ui/
        └── image-upload.tsx          # Componente React para upload
```

---

## 💻 IMPLEMENTAÇÃO DO CÓDIGO

### 1. Biblioteca Principal (`lib/storage.ts`)

Crie o arquivo `lib/storage.ts` com o seguinte conteúdo:

```typescript
// Contabo Object Storage - Compatível com S3
import { 
  S3Client, 
  PutObjectCommand, 
  DeleteObjectCommand, 
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Configuração do cliente S3 para Contabo
const getStorageClient = () => {
  const endpoint = process.env.CONTABO_STORAGE_ENDPOINT;
  const region = process.env.CONTABO_STORAGE_REGION || 'eu2';
  const accessKeyId = process.env.CONTABO_STORAGE_ACCESS_KEY;
  const secretAccessKey = process.env.CONTABO_STORAGE_SECRET_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('Configuração do Contabo Storage incompleta. Verifique as variáveis de ambiente.');
  }

  return new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true, // Necessário para Contabo
  });
};

const getBucket = () => {
  const bucket = process.env.CONTABO_STORAGE_BUCKET;
  if (!bucket) {
    throw new Error('CONTABO_STORAGE_BUCKET não configurado');
  }
  return bucket;
};

// Tipos de arquivos permitidos
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
];

// Tamanho máximo do arquivo (5MB)
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

export interface UploadResult {
  success: boolean;
  key?: string;
  url?: string;
  error?: string;
}

/**
 * Remove caracteres especiais do CNPJ para usar como nome de pasta
 * Exemplo: 12.345.678/0001-90 -> 12345678000190
 */
export function sanitizeCnpj(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, '');
}

/**
 * Faz upload de um arquivo para o storage
 */
export async function uploadFile(
  file: Buffer,
  key: string,
  contentType: string
): Promise<UploadResult> {
  try {
    const client = getStorageClient();
    const bucket = getBucket();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
      ACL: 'public-read', // Tornar público
    });

    await client.send(command);

    // Gerar URL pública
    const publicUrl = process.env.CONTABO_STORAGE_PUBLIC_URL;
    const url = publicUrl 
      ? `${publicUrl}/${key}`
      : `${process.env.CONTABO_STORAGE_ENDPOINT}/${bucket}/${key}`;

    return {
      success: true,
      key,
      url,
    };
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao fazer upload',
    };
  }
}

/**
 * Faz upload de uma imagem para um tipo específico (cliente, produto, etc)
 * Estrutura: {cnpj}/{type}/{entityId}.{extension}
 * Exemplo: 12345678000190/clientes/abc123.jpg
 */
export async function uploadImage(
  file: Buffer,
  type: 'clientes' | 'produtos' | 'empresas',
  cnpj: string,
  entityId: string,
  contentType: string
): Promise<UploadResult> {
  // Validar tipo de arquivo
  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
    return {
      success: false,
      error: `Tipo de arquivo não permitido. Tipos aceitos: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
    };
  }

  // Validar tamanho
  if (file.length > MAX_FILE_SIZE) {
    return {
      success: false,
      error: `Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  // Limpar CNPJ para usar como pasta
  const cleanCnpj = sanitizeCnpj(cnpj);

  // Determinar extensão
  const extension = contentType.split('/')[1] || 'jpg';

  // Criar chave do arquivo: {cnpj}/{type}/{entityId}.{extension}
  const key = `${cleanCnpj}/${type}/${entityId}.${extension}`;

  return uploadFile(file, key, contentType);
}

/**
 * Deleta um arquivo do storage
 */
export async function deleteFile(key: string): Promise<boolean> {
  try {
    const client = getStorageClient();
    const bucket = getBucket();

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error) {
    console.error('Erro ao deletar arquivo:', error);
    return false;
  }
}

/**
 * Deleta a imagem de uma entidade
 * Estrutura: {cnpj}/{type}/{entityId}.{extension}
 */
export async function deleteImage(
  type: 'clientes' | 'produtos' | 'empresas',
  cnpj: string,
  entityId: string
): Promise<boolean> {
  // Limpar CNPJ
  const cleanCnpj = sanitizeCnpj(cnpj);

  // Tentar deletar todas as extensões possíveis
  const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

  for (const ext of extensions) {
    const key = `${cleanCnpj}/${type}/${entityId}.${ext}`;
    await deleteFile(key);
  }

  return true;
}

/**
 * Deleta todos os arquivos de uma empresa (por CNPJ)
 * Útil quando o cliente cancela
 */
export async function deleteAllByCompany(cnpj: string): Promise<{ success: boolean; deleted: number; error?: string }> {
  try {
    const client = getStorageClient();
    const bucket = getBucket();
    const cleanCnpj = sanitizeCnpj(cnpj);

    // Listar todos os arquivos da empresa
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: `${cleanCnpj}/`,
    });

    const listResponse = await client.send(listCommand);
    const objects = listResponse.Contents || [];

    if (objects.length === 0) {
      return { success: true, deleted: 0 };
    }

    // Deletar em lotes (máximo 1000 por vez)
    const objectsToDelete = objects.map(obj => ({ Key: obj.Key }));

    const deleteCommand = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: objectsToDelete,
        Quiet: true,
      },
    });

    await client.send(deleteCommand);

    return { success: true, deleted: objects.length };
  } catch (error) {
    console.error('Erro ao deletar arquivos da empresa:', error);
    return {
      success: false,
      deleted: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Gera URL assinada para acesso temporário (se bucket for privado)
 */
export async function getSignedImageUrl(key: string, expiresIn: number = 3600): Promise<string | null> {
  try {
    const client = getStorageClient();
    const bucket = getBucket();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const url = await getSignedUrl(client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('Erro ao gerar URL assinada:', error);
    return null;
  }
}

/**
 * Verifica se o storage está configurado e acessível
 */
export async function testStorageConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const client = getStorageClient();
    const bucket = getBucket();

    const command = new HeadBucketCommand({
      Bucket: bucket,
    });

    await client.send(command);
    return { success: true };
  } catch (error) {
    console.error('Erro ao testar conexão com storage:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Lista arquivos em um diretório
 */
export async function listFiles(prefix: string): Promise<string[]> {
  try {
    const client = getStorageClient();
    const bucket = getBucket();

    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    });

    const response = await client.send(command);
    return response.Contents?.map(obj => obj.Key || '').filter(Boolean) || [];
  } catch (error) {
    console.error('Erro ao listar arquivos:', error);
    return [];
  }
}

/**
 * Lista arquivos de uma empresa por CNPJ
 */
export async function listFilesByCompany(cnpj: string): Promise<string[]> {
  const cleanCnpj = sanitizeCnpj(cnpj);
  return listFiles(`${cleanCnpj}/`);
}

/**
 * Gera a URL pública de uma imagem
 * Estrutura: {cnpj}/{type}/{entityId}.{extension}
 */
export function getImageUrl(
  type: 'clientes' | 'produtos' | 'empresas',
  cnpj: string,
  entityId: string,
  extension: string = 'jpg'
): string {
  const bucket = process.env.CONTABO_STORAGE_BUCKET || 'caixafacil';
  const endpoint = process.env.CONTABO_STORAGE_ENDPOINT || '';
  const publicUrl = process.env.CONTABO_STORAGE_PUBLIC_URL;

  const cleanCnpj = sanitizeCnpj(cnpj);
  const key = `${cleanCnpj}/${type}/${entityId}.${extension}`;

  if (publicUrl) {
    return `${publicUrl}/${key}`;
  }

  return `${endpoint}/${bucket}/${key}`;
}
```

---

## 🔌 APIS NECESSÁRIAS

### 1. API de Upload (`app/api/upload/route.ts`)

**IMPORTANTE:** Esta API assume que você tem:
- Middleware de autenticação (`withAuth`)
- Função para buscar CNPJ da empresa pelo ID
- Schema de empresas no banco de dados

```typescript
// API de Upload de Imagens
import { NextRequest } from 'next/server';
import { withAuth, successResponse, errorResponse, AuthenticatedRequest } from '@/lib/api-middleware';
import { uploadImage, deleteImage, ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from '@/lib/storage';
import { db } from '@/lib/db';
import { empresas } from '@shared/schema'; // Ajuste conforme seu schema
import { eq } from 'drizzle-orm';

/**
 * Busca o CNPJ da empresa pelo ID
 * AJUSTE ESTA FUNÇÃO CONFORME SEU SCHEMA DE BANCO DE DADOS
 */
async function getEmpresaCnpj(empresaId: string): Promise<string | null> {
  const result = await db
    .select({ cnpj: empresas.cnpj })
    .from(empresas)
    .where(eq(empresas.id, empresaId))
    .limit(1);

  return result.length > 0 ? result[0].cnpj : null;
}

/**
 * POST /api/upload
 * Upload de imagem para Clientes, Produtos ou Empresas
 * 
 * Body (multipart/form-data):
 * - file: arquivo de imagem
 * - type: 'clientes' | 'produtos' | 'empresas'
 * - entityId: ID da entidade (cliente, produto ou empresa)
 */
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const empresaId = request.empresaId;

    // Buscar CNPJ da empresa
    const cnpj = await getEmpresaCnpj(empresaId);
    if (!cnpj) {
      return errorResponse('Empresa não encontrada ou sem CNPJ cadastrado', 400);
    }

    // Verificar se é multipart/form-data
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return errorResponse('Content-Type deve ser multipart/form-data', 400);
    }

    const formData = await request.formData();

    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null;
    const entityId = formData.get('entityId') as string | null;

    // Validações
    if (!file) {
      return errorResponse('Arquivo não enviado', 400);
    }

    if (!type || !['clientes', 'produtos', 'empresas'].includes(type)) {
      return errorResponse('Tipo inválido. Use: clientes, produtos ou empresas', 400);
    }

    if (!entityId) {
      return errorResponse('entityId é obrigatório', 400);
    }

    // Validar tipo de arquivo
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return errorResponse(
        `Tipo de arquivo não permitido. Tipos aceitos: JPEG, PNG, GIF, WebP`,
        400
      );
    }

    // Validar tamanho
    if (file.size > MAX_FILE_SIZE) {
      return errorResponse(
        `Arquivo muito grande. Tamanho máximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        400
      );
    }

    // Converter File para Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Fazer upload usando CNPJ como pasta raiz
    const result = await uploadImage(
      buffer,
      type as 'clientes' | 'produtos' | 'empresas',
      cnpj,
      entityId,
      file.type
    );

    if (!result.success) {
      return errorResponse(result.error || 'Erro ao fazer upload', 500);
    }

    return successResponse({
      message: 'Upload realizado com sucesso',
      url: result.url,
      key: result.key,
    });
  } catch (error) {
    console.error('Erro no upload:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Erro ao processar upload',
      500
    );
  }
});

/**
 * DELETE /api/upload
 * Remove imagem de uma entidade
 * 
 * Query params:
 * - type: 'clientes' | 'produtos' | 'empresas'
 * - entityId: ID da entidade
 */
export const DELETE = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const empresaId = request.empresaId;

    // Buscar CNPJ da empresa
    const cnpj = await getEmpresaCnpj(empresaId);
    if (!cnpj) {
      return errorResponse('Empresa não encontrada ou sem CNPJ cadastrado', 400);
    }

    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type');
    const entityId = searchParams.get('entityId');

    if (!type || !['clientes', 'produtos', 'empresas'].includes(type)) {
      return errorResponse('Tipo inválido. Use: clientes, produtos ou empresas', 400);
    }

    if (!entityId) {
      return errorResponse('entityId é obrigatório', 400);
    }

    await deleteImage(
      type as 'clientes' | 'produtos' | 'empresas',
      cnpj,
      entityId
    );

    return successResponse({
      message: 'Imagem removida com sucesso',
    });
  } catch (error) {
    console.error('Erro ao deletar imagem:', error);
    return errorResponse(
      error instanceof Error ? error.message : 'Erro ao remover imagem',
      500
    );
  }
});
```

### 2. API de Teste (`app/api/storage/test/route.ts`)

```typescript
// API para testar conexão com o Storage
import { NextRequest, NextResponse } from 'next/server';
import { testStorageConnection } from '@/lib/storage';

/**
 * GET /api/storage/test
 * Testa a conexão com o Contabo Object Storage
 */
export async function GET(request: NextRequest) {
  try {
    const result = await testStorageConnection();

    if (result.success) {
      return NextResponse.json({
        status: 'ok',
        bucket: process.env.CONTABO_STORAGE_BUCKET,
        endpoint: process.env.CONTABO_STORAGE_ENDPOINT,
        message: 'Conexão com storage funcionando!'
      });
    } else {
      return NextResponse.json({
        status: 'error',
        error: result.error,
        message: 'Falha ao conectar com o storage'
      }, { status: 500 });
    }
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      message: 'Erro ao testar conexão'
    }, { status: 500 });
  }
}
```

### 3. API de Gerenciamento por Empresa (`app/api/storage/empresa/[cnpj]/route.ts`)

**OPCIONAL:** Esta API permite listar e deletar todos os arquivos de uma empresa. Requer autenticação de supervisor.

```typescript
// API para gerenciar arquivos de uma empresa por CNPJ
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth'; // Ajuste conforme sua autenticação
import { deleteAllByCompany, listFilesByCompany, sanitizeCnpj } from '@/lib/storage';
import { db } from '@/lib/db';
import { usuarios } from '@shared/schema'; // Ajuste conforme seu schema
import { eq } from 'drizzle-orm';

/**
 * Verifica se o usuário é supervisor
 * AJUSTE ESTA FUNÇÃO CONFORME SEU SISTEMA DE PERMISSÕES
 */
async function isSupervisor(userId: string): Promise<boolean> {
  const result = await db
    .select({ perfil: usuarios.perfil })
    .from(usuarios)
    .where(eq(usuarios.id, userId))
    .limit(1);

  return result.length > 0 && result[0].perfil === 'supervisor';
}

/**
 * GET /api/storage/empresa/[cnpj]
 * Lista todos os arquivos de uma empresa
 * Apenas supervisores podem acessar
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cnpj: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Apenas supervisores podem listar arquivos de outras empresas
    if (!await isSupervisor(session.userId)) {
      return NextResponse.json({ error: 'Forbidden: Apenas supervisores podem acessar esta funcionalidade' }, { status: 403 });
    }

    const { cnpj } = await params;
    const cleanCnpj = sanitizeCnpj(cnpj);

    const files = await listFilesByCompany(cleanCnpj);

    return NextResponse.json({
      cnpj: cleanCnpj,
      totalFiles: files.length,
      files,
    });
  } catch (error) {
    console.error('Erro ao listar arquivos:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao listar arquivos' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/storage/empresa/[cnpj]
 * Deleta todos os arquivos de uma empresa
 * Útil quando o cliente cancela
 * Apenas supervisores podem executar
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ cnpj: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Apenas supervisores podem deletar arquivos
    if (!await isSupervisor(session.userId)) {
      return NextResponse.json({ error: 'Forbidden: Apenas supervisores podem executar esta ação' }, { status: 403 });
    }

    const { cnpj } = await params;
    const cleanCnpj = sanitizeCnpj(cnpj);

    const result = await deleteAllByCompany(cleanCnpj);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      message: `Todos os arquivos da empresa ${cleanCnpj} foram removidos`,
      cnpj: cleanCnpj,
      deleted: result.deleted,
    });
  } catch (error) {
    console.error('Erro ao deletar arquivos:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao deletar arquivos' },
      { status: 500 }
    );
  }
}
```

---

## 🎨 COMPONENTE DE UPLOAD

### Componente React (`components/ui/image-upload.tsx`)

Este componente permite upload via arquivo ou câmera:

```typescript
"use client"

import { useState, useRef, useCallback } from "react"
import { Camera, Upload, X, Loader2, Image as ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
// Importe seu sistema de toast/notificação
// import { showToast } from "@/components/toast"

interface ImageUploadProps {
  type: 'clientes' | 'produtos' | 'empresas'
  entityId?: string
  currentImageUrl?: string | null
  onUploadSuccess?: (url: string) => void
  onRemoveImage?: () => void
  disabled?: boolean
  className?: string
}

export function ImageUpload({
  type,
  entityId,
  currentImageUrl,
  onUploadSuccess,
  onRemoveImage,
  disabled = false,
  className = ""
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(currentImageUrl || null)
  const [capturing, setCapturing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Processar arquivo selecionado ou capturado
  const processFile = useCallback(async (file: File) => {
    if (!entityId) {
      // showToast("Aviso", "Salve o registro antes de adicionar uma imagem", "info")
      alert("Salve o registro antes de adicionar uma imagem")
      return
    }

    // Validar tipo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      // showToast("Erro", "Tipo de arquivo não permitido. Use JPEG, PNG, GIF ou WebP", "destructive")
      alert("Tipo de arquivo não permitido. Use JPEG, PNG, GIF ou WebP")
      return
    }

    // Validar tamanho (5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      // showToast("Erro", "Arquivo muito grande. Tamanho máximo: 5MB", "destructive")
      alert("Arquivo muito grande. Tamanho máximo: 5MB")
      return
    }

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)
      formData.append('entityId', entityId)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao fazer upload')
      }

      const result = await response.json()

      // Atualizar preview
      setImagePreview(result.url)

      // Notificar sucesso
      onUploadSuccess?.(result.url)
      // showToast("Sucesso", "Imagem enviada com sucesso!", "success")
    } catch (error) {
      console.error('Erro no upload:', error)
      // showToast("Erro", error instanceof Error ? error.message : "Erro ao enviar imagem", "destructive")
      alert(error instanceof Error ? error.message : "Erro ao enviar imagem")
    } finally {
      setUploading(false)
    }
  }, [entityId, type, onUploadSuccess])

  // Selecionar arquivo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
    // Limpar input para permitir selecionar o mesmo arquivo novamente
    e.target.value = ''
  }

  // Abrir câmera
  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setCapturing(true)
    } catch (error) {
      console.error('Erro ao acessar câmera:', error)
      alert("Não foi possível acessar a câmera")
    }
  }

  // Capturar foto
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    // Definir tamanho do canvas igual ao vídeo
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Desenhar frame do vídeo no canvas
    context.drawImage(video, 0, 0)

    // Converter para blob
    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' })
        await processFile(file)
      }
      closeCamera()
    }, 'image/jpeg', 0.8)
  }

  // Fechar câmera
  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setCapturing(false)
  }

  // Remover imagem
  const handleRemoveImage = async () => {
    if (!entityId) return

    try {
      const response = await fetch(`/api/upload?type=${type}&entityId=${entityId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao remover imagem')
      }

      setImagePreview(null)
      onRemoveImage?.()
      // showToast("Sucesso", "Imagem removida com sucesso!", "success")
    } catch (error) {
      console.error('Erro ao remover imagem:', error)
      // showToast("Erro", error instanceof Error ? error.message : "Erro ao remover imagem", "destructive")
      alert(error instanceof Error ? error.message : "Erro ao remover imagem")
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Preview da imagem */}
      <div className="relative w-40 h-40 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden">
        {capturing ? (
          // Modo câmera
          <video 
            ref={videoRef} 
            className="w-full h-full object-cover"
            autoPlay 
            playsInline 
            muted
          />
        ) : imagePreview ? (
          // Imagem existente
          <>
            <img 
              src={imagePreview} 
              alt="Preview" 
              className="w-full h-full object-cover"
              onError={() => setImagePreview(null)}
            />
            {!disabled && (
              <button
                type="button"
                onClick={handleRemoveImage}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </>
        ) : (
          // Placeholder
          <div className="text-center text-gray-400">
            <ImageIcon className="w-12 h-12 mx-auto mb-2" />
            <span className="text-xs">Sem imagem</span>
          </div>
        )}

        {/* Loading overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Canvas oculto para captura */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Botões */}
      {!disabled && (
        <div className="flex gap-2">
          {capturing ? (
            // Botões do modo câmera
            <>
              <Button
                type="button"
                size="sm"
                onClick={capturePhoto}
                className="bg-green-600 hover:bg-green-700"
              >
                <Camera className="w-4 h-4 mr-1" />
                Capturar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={closeCamera}
              >
                <X className="w-4 h-4 mr-1" />
                Cancelar
              </Button>
            </>
          ) : (
            // Botões normais
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={openCamera}
                disabled={uploading || !entityId}
              >
                <Camera className="w-4 h-4 mr-1" />
                Câmera
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !entityId}
              >
                <Upload className="w-4 h-4 mr-1" />
                Arquivo
              </Button>
            </>
          )}
        </div>
      )}

      {/* Input de arquivo oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Aviso se não tem entityId */}
      {!entityId && !disabled && (
        <p className="text-xs text-amber-600">
          Salve o registro primeiro para adicionar uma imagem
        </p>
      )}
    </div>
  )
}
```

### Uso do Componente

```typescript
import { ImageUpload } from "@/components/ui/image-upload"

// Em um formulário de cliente/produto/empresa
<ImageUpload
  type="clientes" // ou "produtos" ou "empresas"
  entityId={cliente.id} // ID do registro salvo
  currentImageUrl={cliente.imagem}
  onUploadSuccess={(url) => {
    // Atualizar estado ou banco de dados com a URL
    setCliente({ ...cliente, imagem: url })
  }}
  onRemoveImage={() => {
    // Limpar URL da imagem
    setCliente({ ...cliente, imagem: null })
  }}
/>
```

---

## ✅ TESTES E VALIDAÇÃO

### 1. Testar Conexão

Após configurar as variáveis de ambiente, teste a conexão:

```bash
# Acesse no navegador ou via curl:
GET http://localhost:3000/api/storage/test
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "bucket": "meuprojeto",
  "endpoint": "https://usc1.contabostorage.com",
  "message": "Conexão com storage funcionando!"
}
```

### 2. Testar Upload

Use o componente `ImageUpload` ou faça uma requisição manual:

```bash
curl -X POST http://localhost:3000/api/upload \
  -H "Authorization: Bearer SEU_TOKEN" \
  -F "file=@imagem.jpg" \
  -F "type=clientes" \
  -F "entityId=123e4567-e89b-12d3-a456-426614174000"
```

---

## 📂 ESTRUTURA DE PASTAS NO STORAGE

O sistema organiza os arquivos por **CNPJ da empresa**, facilitando a gestão:

```
bucket/
├── 12345678000190/           ← CNPJ da empresa (apenas números)
│   ├── clientes/
│   │   ├── uuid-cliente-1.jpg
│   │   └── uuid-cliente-2.png
│   ├── produtos/
│   │   ├── uuid-produto-1.jpg
│   │   └── uuid-produto-2.webp
│   └── empresas/
│       └── logo.png
├── 98765432000101/           ← Outra empresa
│   ├── clientes/
│   │   └── ...
│   └── produtos/
│       └── ...
```

### Vantagens desta estrutura:
- ✅ **Isolamento por empresa**: Cada CNPJ tem sua pasta própria
- ✅ **Fácil remoção**: Ao cancelar um cliente, basta apagar a pasta do CNPJ
- ✅ **Organização clara**: Arquivos separados por tipo (clientes, produtos, empresas)

---

## 🔧 AJUSTES NECESSÁRIOS PARA SEU PROJETO

### 1. Autenticação
- Ajuste `withAuth` conforme seu sistema de autenticação
- Ajuste `getSession` conforme sua implementação

### 2. Banco de Dados
- Ajuste `getEmpresaCnpj` conforme seu schema de empresas
- Ajuste `isSupervisor` conforme seu sistema de permissões

### 3. Tipos de Entidades
- Se precisar de outros tipos além de `clientes`, `produtos`, `empresas`, adicione em:
  - `lib/storage.ts` (função `uploadImage`)
  - `app/api/upload/route.ts` (validação de tipos)

### 4. Componente de Toast
- Substitua `showToast` ou `alert` pelo seu sistema de notificações

### 5. Componentes UI
- Ajuste `Button` conforme sua biblioteca de componentes (Shadcn, Material-UI, etc.)

---

## 📝 CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Instalar dependências (`@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner`)
- [ ] Configurar variáveis de ambiente no `.env.local`
- [ ] Criar bucket na Contabo
- [ ] Obter credenciais (Access Key e Secret Key)
- [ ] Criar arquivo `lib/storage.ts`
- [ ] Criar API `app/api/upload/route.ts`
- [ ] Criar API `app/api/storage/test/route.ts`
- [ ] (Opcional) Criar API `app/api/storage/empresa/[cnpj]/route.ts`
- [ ] Criar componente `components/ui/image-upload.tsx`
- [ ] Ajustar funções de autenticação e banco de dados
- [ ] Testar conexão (`GET /api/storage/test`)
- [ ] Testar upload de imagem
- [ ] Testar remoção de imagem
- [ ] Integrar componente em formulários

---

## 🆘 TROUBLESHOOTING

### Erro: "Configuração do Contabo Storage incompleta"
- Verifique se todas as variáveis de ambiente estão configuradas
- Reinicie o servidor após adicionar variáveis de ambiente

### Erro: "Access Denied" ou "Forbidden"
- Verifique se as credenciais estão corretas
- Verifique se o bucket existe e está acessível
- Verifique se `forcePathStyle: true` está configurado

### Imagens não aparecem
- Verifique se o bucket está configurado como público
- Ou configure `CONTABO_STORAGE_PUBLIC_URL` corretamente
- Verifique se a URL gerada está correta

### Upload falha
- Verifique o tamanho do arquivo (máximo 5MB)
- Verifique o tipo do arquivo (JPEG, PNG, GIF, WebP)
- Verifique se o CNPJ da empresa está cadastrado

---

## 📚 REFERÊNCIAS

- [Contabo Object Storage](https://www.contabo.com/en/object-storage/)
- [AWS SDK for JavaScript v3](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

---

## ✅ CONCLUSÃO

Esta documentação fornece tudo o que é necessário para implementar o Contabo Object Storage em um projeto Next.js. Siga os passos na ordem apresentada e ajuste conforme as necessidades específicas do seu projeto.

**Dúvidas ou problemas?** Verifique a seção de Troubleshooting ou consulte a documentação oficial da Contabo e AWS SDK.

---

**Documento gerado em:** 2025-01-27  
**Versão:** 1.0  
**Baseado na implementação do projeto CaixaFacilOnLine**

