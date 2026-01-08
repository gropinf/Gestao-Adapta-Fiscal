import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const getStorageClient = () => {
  const endpoint = process.env.CONTABO_STORAGE_ENDPOINT;
  const region = process.env.CONTABO_STORAGE_REGION || 'us-east-1';
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
    forcePathStyle: true,
  });
};

const getBucket = () => {
  const bucket = process.env.CONTABO_STORAGE_BUCKET;
  if (!bucket) {
    throw new Error('CONTABO_STORAGE_BUCKET não configurado');
  }
  return bucket;
};

export const ALLOWED_XML_TYPES = [
  'application/xml',
  'text/xml',
  'application/octet-stream',
];

export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

export const MAX_XML_SIZE = 10 * 1024 * 1024;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export interface UploadResult {
  success: boolean;
  key?: string;
  url?: string;
  error?: string;
}

export interface StorageFile {
  key: string;
  size: number;
  lastModified: Date;
  url: string;
}

export function sanitizeCnpj(cnpj: string): string {
  return cnpj.replace(/[^\d]/g, '');
}

export function extractChaveAcessoFromXml(xmlContent: string): string | null {
  const infNFeMatch = xmlContent.match(/<infNFe[^>]*Id="NFe(\d{44})"/);
  if (infNFeMatch) {
    return infNFeMatch[1];
  }
  
  const chNFeMatch = xmlContent.match(/<chNFe>(\d{44})<\/chNFe>/);
  if (chNFeMatch) {
    return chNFeMatch[1];
  }
  
  return null;
}

export function extractCnpjEmitenteFromXml(xmlContent: string): string | null {
  // Tenta extrair CNPJ do emitente
  const emitCnpjMatch = xmlContent.match(/<emit>[\s\S]*?<CNPJ>(\d{14})<\/CNPJ>[\s\S]*?<\/emit>/);
  if (emitCnpjMatch) {
    return emitCnpjMatch[1];
  }
  
  // Fallback: procura qualquer CNPJ dentro de <emit>
  const emitMatch = xmlContent.match(/<emit>[\s\S]*?<\/emit>/);
  if (emitMatch) {
    const cnpjMatch = emitMatch[0].match(/<CNPJ>(\d{14})<\/CNPJ>/);
    if (cnpjMatch) {
      return cnpjMatch[1];
    }
  }
  
  return null;
}

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
      ACL: 'public-read',
    });

    await client.send(command);

    const endpoint = process.env.CONTABO_STORAGE_ENDPOINT;
    const url = `${endpoint}/${bucket}/${key}`;

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

export async function uploadXml(
  xmlContent: string | Buffer,
  cnpj: string,
  chaveAcesso: string
): Promise<UploadResult> {
  const cleanCnpj = sanitizeCnpj(cnpj);
  const cleanChave = chaveAcesso.replace(/[^\d]/g, '');
  
  if (cleanChave.length !== 44) {
    return {
      success: false,
      error: 'Chave de acesso deve ter 44 dígitos',
    };
  }
  
  const key = `${cleanCnpj}/xml/${cleanChave}.xml`;
  
  const buffer = typeof xmlContent === 'string' 
    ? Buffer.from(xmlContent, 'utf-8') 
    : xmlContent;
  
  if (buffer.length > MAX_XML_SIZE) {
    return {
      success: false,
      error: `Arquivo muito grande. Tamanho máximo: ${MAX_XML_SIZE / 1024 / 1024}MB`,
    };
  }
  
  return uploadFile(buffer, key, 'application/xml');
}

export async function uploadXmlFromFile(
  file: Buffer,
  cnpj: string,
  originalFilename?: string
): Promise<UploadResult> {
  const xmlContent = file.toString('utf-8');
  
  const chaveAcesso = extractChaveAcessoFromXml(xmlContent);
  
  if (!chaveAcesso) {
    const cleanFilename = originalFilename?.replace(/\.xml$/i, '').replace(/[^\d]/g, '');
    if (cleanFilename && cleanFilename.length === 44) {
      return uploadXml(file, cnpj, cleanFilename);
    }
    
    return {
      success: false,
      error: 'Não foi possível extrair a chave de acesso do XML',
    };
  }
  
  return uploadXml(file, cnpj, chaveAcesso);
}

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

export async function deleteXml(cnpj: string, chaveAcesso: string): Promise<boolean> {
  const cleanCnpj = sanitizeCnpj(cnpj);
  const cleanChave = chaveAcesso.replace(/[^\d]/g, '');
  const key = `${cleanCnpj}/xml/${cleanChave}.xml`;
  
  return deleteFile(key);
}

export async function deleteAllByCompany(cnpj: string): Promise<{ success: boolean; deleted: number; error?: string }> {
  try {
    const client = getStorageClient();
    const bucket = getBucket();
    const cleanCnpj = sanitizeCnpj(cnpj);

    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: `${cleanCnpj}/`,
    });

    const listResponse = await client.send(listCommand);
    const objects = listResponse.Contents || [];

    if (objects.length === 0) {
      return { success: true, deleted: 0 };
    }

    const objectsToDelete = objects
      .filter(obj => obj.Key)
      .map(obj => ({ Key: obj.Key! }));

    if (objectsToDelete.length === 0) {
      return { success: true, deleted: 0 };
    }

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

export async function getFile(key: string): Promise<Buffer | null> {
  try {
    const client = getStorageClient();
    const bucket = getBucket();

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    const response = await client.send(command);
    
    if (response.Body) {
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao buscar arquivo:', error);
    return null;
  }
}

export async function getXml(cnpj: string, chaveAcesso: string): Promise<string | null> {
  const cleanCnpj = sanitizeCnpj(cnpj);
  const cleanChave = chaveAcesso.replace(/[^\d]/g, '');
  const key = `${cleanCnpj}/xml/${cleanChave}.xml`;
  
  const buffer = await getFile(key);
  if (buffer) {
    return buffer.toString('utf-8');
  }
  return null;
}

export async function getSignedDownloadUrl(key: string, expiresIn: number = 3600): Promise<string | null> {
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

export async function getXmlUrl(cnpj: string, chaveAcesso: string): Promise<string> {
  const cleanCnpj = sanitizeCnpj(cnpj);
  const cleanChave = chaveAcesso.replace(/[^\d]/g, '');
  const key = `${cleanCnpj}/xml/${cleanChave}.xml`;
  
  const bucket = getBucket();
  const endpoint = process.env.CONTABO_STORAGE_ENDPOINT;
  
  return `${endpoint}/${bucket}/${key}`;
}

export async function testStorageConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    const client = getStorageClient();
    const bucket = getBucket();

    const command = new HeadBucketCommand({
      Bucket: bucket,
    });

    await client.send(command);
    
    return { 
      success: true,
      details: {
        bucket,
        endpoint: process.env.CONTABO_STORAGE_ENDPOINT,
        region: process.env.CONTABO_STORAGE_REGION,
      }
    };
  } catch (error) {
    console.error('Erro ao testar conexão com storage:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

export async function listFiles(prefix: string): Promise<StorageFile[]> {
  try {
    const client = getStorageClient();
    const bucket = getBucket();
    const endpoint = process.env.CONTABO_STORAGE_ENDPOINT;

    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    });

    const response = await client.send(command);
    
    return (response.Contents || [])
      .filter(obj => obj.Key && obj.Size !== undefined)
      .map(obj => ({
        key: obj.Key!,
        size: obj.Size!,
        lastModified: obj.LastModified || new Date(),
        url: `${endpoint}/${bucket}/${obj.Key}`,
      }));
  } catch (error) {
    console.error('Erro ao listar arquivos:', error);
    return [];
  }
}

export async function listXmlsByCompany(cnpj: string): Promise<StorageFile[]> {
  const cleanCnpj = sanitizeCnpj(cnpj);
  return listFiles(`${cleanCnpj}/xml/`);
}

export async function listAllByCompany(cnpj: string): Promise<StorageFile[]> {
  const cleanCnpj = sanitizeCnpj(cnpj);
  return listFiles(`${cleanCnpj}/`);
}

export async function fileExists(key: string): Promise<boolean> {
  try {
    const client = getStorageClient();
    const bucket = getBucket();

    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    });

    await client.send(command);
    return true;
  } catch (error) {
    return false;
  }
}

export async function xmlExists(cnpj: string, chaveAcesso: string): Promise<boolean> {
  const cleanCnpj = sanitizeCnpj(cnpj);
  const cleanChave = chaveAcesso.replace(/[^\d]/g, '');
  const key = `${cleanCnpj}/xml/${cleanChave}.xml`;
  
  return fileExists(key);
}

export function getXmlKey(cnpj: string, chaveAcesso: string): string {
  const cleanCnpj = sanitizeCnpj(cnpj);
  const cleanChave = chaveAcesso.replace(/[^\d]/g, '');
  return `${cleanCnpj}/xmls/${cleanChave}.xml`;
}

export async function uploadImage(
  file: Buffer,
  cnpj: string,
  type: 'empresas' | 'clientes' | 'produtos',
  entityId: string,
  contentType: string
): Promise<UploadResult> {
  if (!ALLOWED_IMAGE_TYPES.includes(contentType)) {
    return {
      success: false,
      error: `Tipo de arquivo não permitido. Tipos aceitos: ${ALLOWED_IMAGE_TYPES.join(', ')}`,
    };
  }

  if (file.length > MAX_IMAGE_SIZE) {
    return {
      success: false,
      error: `Arquivo muito grande. Tamanho máximo: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`,
    };
  }

  const cleanCnpj = sanitizeCnpj(cnpj);
  const extension = contentType.split('/')[1] || 'jpg';
  const key = `${cleanCnpj}/${type}/${entityId}.${extension}`;

  return uploadFile(file, key, contentType);
}

export async function deleteImage(
  cnpj: string,
  type: 'empresas' | 'clientes' | 'produtos',
  entityId: string
): Promise<boolean> {
  const cleanCnpj = sanitizeCnpj(cnpj);
  const extensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

  for (const ext of extensions) {
    const key = `${cleanCnpj}/${type}/${entityId}.${ext}`;
    await deleteFile(key);
  }

  return true;
}

export function getImageUrl(
  cnpj: string,
  type: 'empresas' | 'clientes' | 'produtos',
  entityId: string,
  extension: string = 'jpg'
): string {
  const cleanCnpj = sanitizeCnpj(cnpj);
  const bucket = getBucket();
  const endpoint = process.env.CONTABO_STORAGE_ENDPOINT;
  const key = `${cleanCnpj}/${type}/${entityId}.${extension}`;

  return `${endpoint}/${bucket}/${key}`;
}

export default {
  uploadFile,
  uploadXml,
  uploadXmlFromFile,
  deleteFile,
  deleteXml,
  deleteAllByCompany,
  getFile,
  getXml,
  getSignedDownloadUrl,
  getXmlUrl,
  testStorageConnection,
  listFiles,
  listXmlsByCompany,
  listAllByCompany,
  fileExists,
  xmlExists,
  getXmlKey,
  uploadImage,
  deleteImage,
  getImageUrl,
  sanitizeCnpj,
  extractChaveAcessoFromXml,
  extractCnpjEmitenteFromXml,
};
