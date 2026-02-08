import * as fs from 'fs/promises';
import * as path from 'path';
import { storage } from './storage';
import { uploadFile, sanitizeCnpj, getXmlKey, getXmlUrl } from './contaboStorage';
import { db } from './db';
import { xmls } from '@shared/schema';
import { like, or } from 'drizzle-orm';
import type { Xml } from '@shared/schema';

/**
 * Determina qual CNPJ usar para organização do arquivo
 * Prioriza emitente, usa destinatário como fallback
 */
export function getCnpjForStorage(xml: Xml): string | null {
  // Prioriza CNPJ emitente
  if (xml.cnpjEmitente) {
    return xml.cnpjEmitente;
  }
  
  // Fallback para destinatário
  if (xml.cnpjDestinatario) {
    return xml.cnpjDestinatario;
  }
  
  return null;
}

/**
 * Verifica se um filepath é do sistema de arquivos local
 */
export function isLocalFilepath(filepath: string): boolean {
  if (!filepath) return false;
  
  // Verifica se é URL do Contabo (já migrado)
  if (filepath.includes('contabostorage.com')) {
    return false;
  }
  
  // Verifica se é URL HTTP/HTTPS (não é local)
  if (filepath.startsWith('http://') || filepath.startsWith('https://')) {
    return false;
  }
  
  // Verifica se começa com / (caminho absoluto)
  if (filepath.startsWith('/')) {
    return true;
  }
  
  // Verifica se contém storage/validated (caminho relativo)
  if (filepath.includes('storage/validated') || filepath.includes('storage\\validated')) {
    return true;
  }
  
  // Se não é URL e não começa com /, assume que é caminho relativo local
  return true;
}

/**
 * Verifica se um arquivo existe no sistema de arquivos
 */
export async function fileExistsLocal(filepath: string): Promise<boolean> {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Lê o conteúdo de um XML do sistema de arquivos local
 */
export async function readXmlFromLocal(filepath: string): Promise<Buffer | null> {
  try {
    const content = await fs.readFile(filepath);
    return content;
  } catch (error) {
    console.error(`Erro ao ler arquivo local ${filepath}:`, error);
    return null;
  }
}

/**
 * Baixa um XML de uma URL (útil para migração de produção)
 */
export async function downloadXmlFromUrl(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Erro ao baixar XML de ${url}: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`Erro ao baixar XML de ${url}:`, error);
    return null;
  }
}

/**
 * Migra um único XML do sistema de arquivos local para o Contabo Storage
 */
export interface MigrationResult {
  success: boolean;
  xmlId: string;
  chave: string;
  oldFilepath?: string;
  newFilepath?: string;
  url?: string;
  error?: string;
}

/**
 * Função auxiliar que faz o upload do buffer para o Contabo
 */
async function migrateXmlBufferToContabo(
  xml: Xml,
  fileBuffer: Buffer,
  shouldDeleteLocal: boolean
): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    xmlId: xml.id,
    chave: xml.chave,
    oldFilepath: xml.filepath,
  };

  try {
    // 1. Determina CNPJ para organização
    const cnpj = getCnpjForStorage(xml);
    if (!cnpj) {
      return {
        ...result,
        error: 'XML não possui CNPJ emitente nem destinatário',
      };
    }

    // 2. Gera a chave (key) no formato: {CNPJ}/xml/YYYYMM/{chave}.xml
    const cleanCnpj = sanitizeCnpj(cnpj);
    const cleanChave = xml.chave.replace(/[^\d]/g, '');
    
    if (cleanChave.length !== 44) {
      return {
        ...result,
        error: `Chave de acesso inválida: ${xml.chave}`,
      };
    }

    const key = getXmlKey(cleanCnpj, cleanChave);

    // 3. Faz upload para Contabo
    const uploadResult = await uploadFile(fileBuffer, key, 'application/xml');
    
    if (!uploadResult.success || !uploadResult.url) {
      return {
        ...result,
        error: uploadResult.error || 'Erro ao fazer upload para Contabo Storage',
      };
    }

    // 4. Atualiza filepath no banco de dados
    await storage.updateXml(xml.id, {
      filepath: uploadResult.url,
    });

    // 5. Deleta arquivo local (apenas se for arquivo local, não URL)
    if (shouldDeleteLocal && isLocalFilepath(xml.filepath)) {
      try {
        await fs.unlink(xml.filepath);
        console.log(`✅ Arquivo local deletado: ${xml.filepath}`);
      } catch (deleteError) {
        console.error(`❌ ERRO ao deletar arquivo local ${xml.filepath}:`, deleteError);
        // A migração foi bem-sucedida, mas não conseguiu deletar o arquivo local
        // Isso é um problema que precisa ser resolvido manualmente
        // Retornamos sucesso mesmo assim, mas com aviso
      }
    }

    return {
      ...result,
      success: true,
      newFilepath: uploadResult.url,
      url: uploadResult.url,
    };

  } catch (error) {
    return {
      ...result,
      error: error instanceof Error ? error.message : 'Erro desconhecido na migração',
    };
  }
}

export async function migrateXmlToContabo(xml: Xml): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    xmlId: xml.id,
    chave: xml.chave,
    oldFilepath: xml.filepath,
  };

  try {
    // 1. Verifica se já está no Contabo (não precisa migrar)
    if (!isLocalFilepath(xml.filepath)) {
      // Se já está em URL do Contabo, não precisa migrar
      if (xml.filepath.includes('contabostorage.com')) {
        return {
          ...result,
          success: true,
          error: 'XML já está no Contabo Storage',
        };
      }
      
      // Se é uma URL (produção), precisa baixar e migrar
      if (xml.filepath.startsWith('http://') || xml.filepath.startsWith('https://')) {
        console.log(`📥 Baixando XML de produção: ${xml.filepath}`);
        const fileBuffer = await downloadXmlFromUrl(xml.filepath);
        
        if (!fileBuffer) {
          return {
            ...result,
            error: `Erro ao baixar XML da URL: ${xml.filepath}`,
          };
        }
        
        // Continua com o processo de migração usando o buffer baixado
        return await migrateXmlBufferToContabo(xml, fileBuffer, false); // false = não deletar (é URL)
      }
      
      // Outro tipo de URL não suportado
      return {
        ...result,
        success: true,
        error: 'XML já está em storage externo (não local)',
      };
    }

    // 2. Verifica se arquivo existe localmente
    const exists = await fileExistsLocal(xml.filepath);
    if (!exists) {
      return {
        ...result,
        error: `Arquivo não encontrado no caminho: ${xml.filepath}`,
      };
    }

    // 3. Lê o arquivo local
    const fileBuffer = await readXmlFromLocal(xml.filepath);
    if (!fileBuffer) {
      return {
        ...result,
        error: 'Erro ao ler arquivo do sistema de arquivos',
      };
    }
    
    // Continua com o processo de migração usando o buffer local
    return await migrateXmlBufferToContabo(xml, fileBuffer, true); // true = deletar arquivo local

  } catch (error) {
    return {
      ...result,
      error: error instanceof Error ? error.message : 'Erro desconhecido na migração',
    };
  }
}

/**
 * Lista todos os XMLs que precisam ser migrados
 * Busca XMLs que ainda estão no sistema de arquivos local OU em URLs (produção)
 */
export async function getXmlsToMigrate(includeUrls: boolean = false): Promise<Xml[]> {
  try {
    // Busca todos os XMLs do banco
    const allXmls = await db.select().from(xmls);
    
    // Filtra os que precisam ser migrados
    const xmlsToMigrate = allXmls.filter(xml => {
      // Já está no Contabo? Pula
      if (xml.filepath && xml.filepath.includes('contabostorage.com')) {
        return false;
      }
      
      // Se includeUrls=true, inclui URLs (produção)
      if (includeUrls) {
        const isUrl = xml.filepath?.startsWith('http://') || xml.filepath?.startsWith('https://');
        return isLocalFilepath(xml.filepath) || isUrl;
      }
      
      // Apenas arquivos locais
      return isLocalFilepath(xml.filepath);
    });
    
    return xmlsToMigrate;
  } catch (error) {
    console.error('Erro ao buscar XMLs para migração:', error);
    return [];
  }
}

/**
 * Conta quantos XMLs precisam ser migrados
 */
export async function countXmlsToMigrate(includeUrls: boolean = false): Promise<number> {
  const xmls = await getXmlsToMigrate(includeUrls);
  return xmls.length;
}

/**
 * Migra múltiplos XMLs em batch
 */
export interface BatchMigrationResult {
  total: number;
  success: number;
  failed: number;
  results: MigrationResult[];
}

export async function migrateXmlsBatch(
  xmls: Xml[],
  options?: {
    dryRun?: boolean;
    onProgress?: (current: number, total: number, result: MigrationResult) => void;
  }
): Promise<BatchMigrationResult> {
  const results: MigrationResult[] = [];
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < xmls.length; i++) {
    const xml = xmls[i];
    
    let result: MigrationResult;
    
    if (options?.dryRun) {
      // Modo dry-run: apenas simula sem fazer alterações
      const cnpj = getCnpjForStorage(xml);
      const isLocal = isLocalFilepath(xml.filepath);
      
      result = {
        success: isLocal && !!cnpj,
        xmlId: xml.id,
        chave: xml.chave,
        oldFilepath: xml.filepath,
        newFilepath: cnpj ? `${sanitizeCnpj(cnpj)}/xml/${xml.chave}.xml` : undefined,
        error: !isLocal ? 'Já está no Contabo' : !cnpj ? 'Sem CNPJ' : undefined,
      };
    } else {
      result = await migrateXmlToContabo(xml);
    }

    results.push(result);

    if (result.success) {
      successCount++;
    } else {
      failedCount++;
    }

    // Callback de progresso
    if (options?.onProgress) {
      options.onProgress(i + 1, xmls.length, result);
    }
  }

  return {
    total: xmls.length,
    success: successCount,
    failed: failedCount,
    results,
  };
}
