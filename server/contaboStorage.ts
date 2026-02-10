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

const getR2Client = () => {
  const endpoint = process.env.R2_ENDPOINT;
  const region = process.env.R2_REGION || 'auto';
  const accessKeyId = process.env.R2_ACCESS_KEY;
  const secretAccessKey = process.env.R2_SECRET_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error('Configuração do R2 incompleta. Verifique as variáveis de ambiente.');
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

const getR2Bucket = () => {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) {
    throw new Error('R2_BUCKET não configurado');
  }
  return bucket;
};

const shouldFallbackToContabo = () => {
  return process.env.R2_FALLBACK_DISABLED !== 'true';
};

export function getR2PublicUrl(key: string): string {
  const bucket = getR2Bucket();
  const endpoint = process.env.R2_PUBLIC_ENDPOINT || process.env.R2_ENDPOINT;
  return `${endpoint}/${bucket}/${key}`;
}

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

export function getYearMonthFromChave(chave: string): { year: string | null; month: string | null; yearMonth: string | null } {
  const cleanChave = chave.replace(/[^\d]/g, '');
  if (cleanChave.length < 6) {
    return { year: null, month: null, yearMonth: null };
  }

  const year2 = cleanChave.substring(2, 4);
  const month = cleanChave.substring(4, 6);
  const monthNumber = Number(month);
  if (!year2 || Number.isNaN(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    return { year: null, month: null, yearMonth: null };
  }

  const year = `20${year2}`;
  return { year, month, yearMonth: `${year}${month}` };
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
    const client = getR2Client();
    const bucket = getR2Bucket();

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
      ACL: 'public-read',
    });

    await client.send(command);

    const endpoint = process.env.R2_PUBLIC_ENDPOINT || process.env.R2_ENDPOINT;
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
  
  const { yearMonth } = getYearMonthFromChave(cleanChave);
  const fallbackYearMonth = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const key = `${cleanCnpj}/xml/${yearMonth || fallbackYearMonth}/${cleanChave}.xml`;
  
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

export async function uploadCompanyCertificate(
  file: Buffer,
  cnpj: string,
  originalFilename: string
): Promise<UploadResult> {
  const cleanCnpj = sanitizeCnpj(cnpj);
  const extension = originalFilename.toLowerCase().endsWith(".p12") ? "p12" : "pfx";
  const key = `${cleanCnpj}/certificado/certificado_${cleanCnpj}.${extension}`;

  return uploadFile(file, key, "application/x-pkcs12");
}

export async function deleteFile(key: string): Promise<boolean> {
  let deleted = false;
  try {
    const client = getR2Client();
    const bucket = getR2Bucket();
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    deleted = true;
  } catch (error) {
    console.error('Erro ao deletar arquivo no R2:', error);
  }

  if (shouldFallbackToContabo()) {
    try {
      const client = getStorageClient();
      const bucket = getBucket();
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );
      deleted = true;
    } catch (error) {
      console.error('Erro ao deletar arquivo no Contabo:', error);
    }
  }

  return deleted;
}

export async function deleteFileFromR2(key: string): Promise<boolean> {
  try {
    const client = getR2Client();
    const bucket = getR2Bucket();
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return true;
  } catch (error) {
    console.error('Erro ao deletar arquivo no R2:', error);
    return false;
  }
}

export async function deleteFileFromContabo(key: string): Promise<boolean> {
  try {
    const client = getStorageClient();
    const bucket = getBucket();
    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return true;
  } catch (error) {
    console.error('Erro ao deletar arquivo no Contabo:', error);
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
    const cleanCnpj = sanitizeCnpj(cnpj);

    const r2Objects = await listFilesFromR2(`${cleanCnpj}/`);
    const contaboObjects = shouldFallbackToContabo()
      ? await listFilesFromContabo(`${cleanCnpj}/`)
      : [];

    const deleteFrom = async (client: S3Client, bucket: string, objects: StorageFile[]) => {
      const objectsToDelete = objects.map((obj) => ({ Key: obj.key }));
      if (objectsToDelete.length === 0) return 0;
      const deleteCommand = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: objectsToDelete,
          Quiet: true,
        },
      });
      await client.send(deleteCommand);
      return objectsToDelete.length;
    };

    const r2Client = getR2Client();
    const r2Bucket = getR2Bucket();
    const deletedR2 = await deleteFrom(r2Client, r2Bucket, r2Objects);

    let deletedContabo = 0;
    if (contaboObjects.length > 0) {
      const contaboClient = getStorageClient();
      const contaboBucket = getBucket();
      deletedContabo = await deleteFrom(contaboClient, contaboBucket, contaboObjects);
    }

    return { success: true, deleted: deletedR2 + deletedContabo };
  } catch (error) {
    console.error('Erro ao deletar arquivos da empresa:', error);
    return {
      success: false,
      deleted: 0,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

export async function getFileFromR2(key: string): Promise<Buffer | null> {
  try {
    const client = getR2Client();
    const bucket = getR2Bucket();
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
    console.warn('Erro ao buscar arquivo no R2:', error);
    return null;
  }
}

export async function getFileFromContabo(key: string): Promise<Buffer | null> {
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
    console.warn('Erro ao buscar arquivo no Contabo:', error);
    return null;
  }
}

export async function getFile(key: string): Promise<Buffer | null> {
  const r2Buffer = await getFileFromR2(key);
  if (r2Buffer) return r2Buffer;
  if (!shouldFallbackToContabo()) return null;
  return getFileFromContabo(key);
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
    const client = getR2Client();
    const bucket = getR2Bucket();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    const url = await getSignedUrl(client, command, { expiresIn });
    return url;
  } catch (error) {
    console.warn('Erro ao gerar URL assinada no R2:', error);
    if (!shouldFallbackToContabo()) return null;
    try {
      const client = getStorageClient();
      const bucket = getBucket();
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      return await getSignedUrl(client, command, { expiresIn });
    } catch (fallbackError) {
      console.error('Erro ao gerar URL assinada no Contabo:', fallbackError);
      return null;
    }
  }
}

export async function getXmlUrl(cnpj: string, chaveAcesso: string): Promise<string> {
  const bucket = getR2Bucket();
  const endpoint = process.env.R2_PUBLIC_ENDPOINT || process.env.R2_ENDPOINT;

  const key = getXmlKey(cnpj, chaveAcesso);
  return `${endpoint}/${bucket}/${key}`;
}

export function getKeyFromPublicUrl(url: string): string | null {
  try {
    const contaboEndpoint = process.env.CONTABO_STORAGE_ENDPOINT;
    const r2Endpoint = process.env.R2_PUBLIC_ENDPOINT || process.env.R2_ENDPOINT;
    const contaboBucket = process.env.CONTABO_STORAGE_BUCKET;
    const r2Bucket = process.env.R2_BUCKET;

    // Parse URL primeiro
    const urlObj = new URL(url);
    let pathParts = urlObj.pathname.split('/').filter((p) => p);
    
    if (pathParts.length === 0) return null;

    // Tenta remover endpoint conhecido
    let normalized = url;
    if (r2Endpoint && normalized.startsWith(r2Endpoint)) {
      normalized = normalized.slice(r2Endpoint.length);
      pathParts = normalized.split('/').filter((p) => p);
    } else if (contaboEndpoint && normalized.startsWith(contaboEndpoint)) {
      normalized = normalized.slice(contaboEndpoint.length);
      pathParts = normalized.split('/').filter((p) => p);
    }

    // Remove bucket se for o primeiro segmento
    if (pathParts.length >= 2) {
      const firstPart = pathParts[0];
      if ((r2Bucket && firstPart === r2Bucket) || (contaboBucket && firstPart === contaboBucket)) {
        return pathParts.slice(1).join('/');
      }
      // Se não encontrou bucket no início, retorna tudo menos o primeiro (assumindo que é bucket)
      return pathParts.slice(1).join('/');
    }
    
    // Fallback: retorna tudo menos o primeiro segmento
    if (pathParts.length >= 2) {
      return pathParts.slice(1).join('/');
    }
    
    return null;
  } catch (error) {
    console.error("Erro ao extrair key do URL:", error);
    return null;
  }
}

export async function testStorageConnection(): Promise<{ success: boolean; error?: string; details?: any }> {
  try {
    const r2Client = getR2Client();
    const r2Bucket = getR2Bucket();
    await r2Client.send(
      new HeadBucketCommand({
        Bucket: r2Bucket,
      })
    );

    let contaboOk = false;
    try {
      const contaboClient = getStorageClient();
      const contaboBucket = getBucket();
      await contaboClient.send(
        new HeadBucketCommand({
          Bucket: contaboBucket,
        })
      );
      contaboOk = true;
    } catch {
      contaboOk = false;
    }

    return {
      success: true,
      details: {
        r2Bucket,
        r2Endpoint: process.env.R2_ENDPOINT,
        r2Region: process.env.R2_REGION,
        contaboAvailable: contaboOk,
        contaboBucket: process.env.CONTABO_STORAGE_BUCKET,
        contaboEndpoint: process.env.CONTABO_STORAGE_ENDPOINT,
      },
    };
  } catch (error) {
    console.error('Erro ao testar conexão com storage:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

async function listFilesFromClient(
  client: S3Client,
  bucket: string,
  endpoint: string,
  prefix: string
): Promise<StorageFile[]> {
  const files: StorageFile[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const response = await client.send(command);
    (response.Contents || [])
      .filter((obj) => obj.Key && obj.Size !== undefined)
      .forEach((obj) => {
        files.push({
          key: obj.Key!,
          size: obj.Size!,
          lastModified: obj.LastModified || new Date(),
          url: `${endpoint}/${bucket}/${obj.Key}`,
        });
      });
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return files;
}

export async function listFilesFromR2(prefix: string): Promise<StorageFile[]> {
  try {
    const client = getR2Client();
    const bucket = getR2Bucket();
    const endpoint = process.env.R2_PUBLIC_ENDPOINT || process.env.R2_ENDPOINT || "";
    return await listFilesFromClient(client, bucket, endpoint, prefix);
  } catch (error) {
    console.error('Erro ao listar arquivos no R2:', error);
    return [];
  }
}

export async function listFilesFromContabo(prefix: string): Promise<StorageFile[]> {
  try {
    const client = getStorageClient();
    const bucket = getBucket();
    const endpoint = process.env.CONTABO_STORAGE_ENDPOINT || "";
    return await listFilesFromClient(client, bucket, endpoint, prefix);
  } catch (error) {
    console.error('Erro ao listar arquivos no Contabo:', error);
    return [];
  }
}

export async function listFiles(prefix: string): Promise<StorageFile[]> {
  return listFilesFromR2(prefix);
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
    const existsR2 = await fileExistsInR2(key);
    if (existsR2) return true;
    if (!shouldFallbackToContabo()) return false;
    return await fileExistsInContabo(key);
  } catch {
    return false;
  }
}

export async function fileExistsInR2(key: string): Promise<boolean> {
  try {
    const r2Client = getR2Client();
    const r2Bucket = getR2Bucket();
    await r2Client.send(
      new HeadObjectCommand({
        Bucket: r2Bucket,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function fileExistsInContabo(key: string): Promise<boolean> {
  try {
    const client = getStorageClient();
    const bucket = getBucket();
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

export async function xmlExists(cnpj: string, chaveAcesso: string): Promise<boolean> {
  const key = getXmlKey(cnpj, chaveAcesso);
  return fileExists(key);
}

export function getXmlKey(cnpj: string, chaveAcesso: string): string {
  const cleanCnpj = sanitizeCnpj(cnpj);
  const cleanChave = chaveAcesso.replace(/[^\d]/g, '');
  const { yearMonth } = getYearMonthFromChave(cleanChave);
  const fallbackYearMonth = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  return `${cleanCnpj}/xml/${yearMonth || fallbackYearMonth}/${cleanChave}.xml`;
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
  const bucket = getR2Bucket();
  const endpoint = process.env.R2_PUBLIC_ENDPOINT || process.env.R2_ENDPOINT;
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
  getFileFromR2,
  getFileFromContabo,
  getXml,
  getSignedDownloadUrl,
  getXmlUrl,
  getKeyFromPublicUrl,
  testStorageConnection,
  listFiles,
  listFilesFromR2,
  listFilesFromContabo,
  listXmlsByCompany,
  listAllByCompany,
  fileExists,
  fileExistsInR2,
  fileExistsInContabo,
  xmlExists,
  getXmlKey,
  getR2PublicUrl,
  uploadImage,
  deleteImage,
  getImageUrl,
  sanitizeCnpj,
  extractChaveAcessoFromXml,
  extractCnpjEmitenteFromXml,
  deleteFileFromR2,
  deleteFileFromContabo,
};
