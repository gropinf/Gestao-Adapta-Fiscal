import * as fs from "fs/promises";
import * as path from "path";
import { validateChave } from "./xmlParser";

// Diretórios de armazenamento
const STORAGE_BASE = process.env.STORAGE_PATH || "/home/runner/workspace/storage";
const UPLOADS_RAW_DIR = path.join(STORAGE_BASE, "uploads", "raw");
const STORAGE_VALIDATED_DIR = path.join(STORAGE_BASE, "validated");

/**
 * Interface para resultado de operações de arquivo
 */
export interface FileOperationResult {
  success: boolean;
  filepath?: string;
  error?: string;
}

/**
 * Inicializa os diretórios de armazenamento
 * Cria as pastas se não existirem
 */
export async function initializeStorageDirectories(): Promise<void> {
  try {
    // Cria diretório de uploads/raw
    await fs.mkdir(UPLOADS_RAW_DIR, { recursive: true });
    console.log(`✅ Diretório criado/verificado: ${UPLOADS_RAW_DIR}`);
    
    // Cria diretório de storage/validated
    await fs.mkdir(STORAGE_VALIDATED_DIR, { recursive: true });
    console.log(`✅ Diretório criado/verificado: ${STORAGE_VALIDATED_DIR}`);
    
  } catch (error) {
    console.error("❌ Erro ao criar diretórios de storage:", error);
    throw new Error("Falha ao inicializar sistema de storage");
  }
}

/**
 * Gera o filepath completo baseado na chave de acesso
 * @param chave - Chave de acesso da NFe (44 dígitos)
 * @param directory - Diretório (raw ou validated)
 */
function getFilepath(chave: string, directory: "raw" | "validated"): string {
  if (!validateChave(chave)) {
    throw new Error("Chave de acesso inválida");
  }
  
  const baseDir = directory === "raw" ? UPLOADS_RAW_DIR : STORAGE_VALIDATED_DIR;
  const filename = `NFe${chave}.xml`;
  
  return path.join(baseDir, filename);
}

/**
 * Verifica se um arquivo XML existe no storage
 * @param chave - Chave de acesso da NFe
 * @param directory - Diretório onde procurar (raw ou validated)
 */
export async function fileExists(chave: string, directory: "raw" | "validated" = "validated"): Promise<boolean> {
  try {
    const filepath = getFilepath(chave, directory);
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Salva um XML no diretório /uploads/raw (temporário)
 * @param xmlContent - Conteúdo do arquivo XML
 * @param chave - Chave de acesso da NFe
 */
export async function saveToRaw(xmlContent: string, chave: string): Promise<FileOperationResult> {
  try {
    if (!validateChave(chave)) {
      return {
        success: false,
        error: "Chave de acesso inválida",
      };
    }
    
    // Verifica se já existe no validated (duplicata)
    const existsInValidated = await fileExists(chave, "validated");
    if (existsInValidated) {
      return {
        success: false,
        error: "XML já existe no storage (duplicata)",
      };
    }
    
    const filepath = getFilepath(chave, "raw");
    await fs.writeFile(filepath, xmlContent, "utf-8");
    
    return {
      success: true,
      filepath,
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao salvar arquivo",
    };
  }
}

/**
 * Move um arquivo de /uploads/raw para /storage/validated
 * Usado após validação bem-sucedida do XML
 * @param chave - Chave de acesso da NFe
 */
export async function moveToValidated(chave: string): Promise<FileOperationResult> {
  try {
    if (!validateChave(chave)) {
      return {
        success: false,
        error: "Chave de acesso inválida",
      };
    }
    
    const rawFilepath = getFilepath(chave, "raw");
    const validatedFilepath = getFilepath(chave, "validated");
    
    // Verifica se arquivo existe em raw
    const existsInRaw = await fileExists(chave, "raw");
    if (!existsInRaw) {
      return {
        success: false,
        error: "Arquivo não encontrado em /uploads/raw",
      };
    }
    
    // Verifica se já existe em validated (duplicata)
    const existsInValidated = await fileExists(chave, "validated");
    if (existsInValidated) {
      // Se já existe em validated, apenas remove de raw
      await fs.unlink(rawFilepath);
      return {
        success: false,
        error: "XML já existe no storage (duplicata). Arquivo raw removido.",
      };
    }
    
    // Move o arquivo (copia + deleta original)
    await fs.copyFile(rawFilepath, validatedFilepath);
    await fs.unlink(rawFilepath);
    
    return {
      success: true,
      filepath: validatedFilepath,
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao mover arquivo",
    };
  }
}

/**
 * Salva diretamente no diretório /storage/validated
 * Útil para casos onde o XML já foi validado
 * @param xmlContent - Conteúdo do arquivo XML
 * @param chave - Chave de acesso da NFe
 */
export async function saveToValidated(xmlContent: string, chave: string): Promise<FileOperationResult> {
  try {
    if (!validateChave(chave)) {
      return {
        success: false,
        error: "Chave de acesso inválida",
      };
    }
    
    // Verifica se já existe (duplicata)
    const exists = await fileExists(chave, "validated");
    if (exists) {
      return {
        success: false,
        error: "XML já existe no storage (duplicata)",
      };
    }
    
    const filepath = getFilepath(chave, "validated");
    await fs.writeFile(filepath, xmlContent, "utf-8");
    
    return {
      success: true,
      filepath,
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao salvar arquivo",
    };
  }
}

/**
 * Lê o conteúdo de um XML armazenado
 * @param chave - Chave de acesso da NFe
 * @param directory - Diretório onde procurar (raw ou validated)
 */
export async function readXmlFile(chave: string, directory: "raw" | "validated" = "validated"): Promise<string | null> {
  try {
    const filepath = getFilepath(chave, directory);
    const content = await fs.readFile(filepath, "utf-8");
    return content;
  } catch (error) {
    console.error(`Erro ao ler arquivo XML (chave: ${chave}):`, error);
    return null;
  }
}

/**
 * Remove um arquivo XML do storage
 * @param chave - Chave de acesso da NFe
 * @param directory - Diretório onde está o arquivo (raw ou validated)
 */
export async function deleteXmlFile(chave: string, directory: "raw" | "validated"): Promise<FileOperationResult> {
  try {
    if (!validateChave(chave)) {
      return {
        success: false,
        error: "Chave de acesso inválida",
      };
    }
    
    const filepath = getFilepath(chave, directory);
    
    // Verifica se arquivo existe
    const exists = await fileExists(chave, directory);
    if (!exists) {
      return {
        success: false,
        error: "Arquivo não encontrado",
      };
    }
    
    await fs.unlink(filepath);
    
    return {
      success: true,
      filepath,
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao deletar arquivo",
    };
  }
}

/**
 * Remove TODOS os arquivos do diretório /uploads/raw
 * Útil para limpeza após processamento batch
 */
export async function clearRawDirectory(): Promise<number> {
  try {
    const files = await fs.readdir(UPLOADS_RAW_DIR);
    let deletedCount = 0;
    
    for (const file of files) {
      if (file.endsWith(".xml")) {
        await fs.unlink(path.join(UPLOADS_RAW_DIR, file));
        deletedCount++;
      }
    }
    
    return deletedCount;
    
  } catch (error) {
    console.error("Erro ao limpar diretório raw:", error);
    return 0;
  }
}

/**
 * Lista todos os arquivos XML em um diretório
 * @param directory - Diretório a listar (raw ou validated)
 */
export async function listXmlFiles(directory: "raw" | "validated" = "validated"): Promise<string[]> {
  try {
    const baseDir = directory === "raw" ? UPLOADS_RAW_DIR : STORAGE_VALIDATED_DIR;
    const files = await fs.readdir(baseDir);
    
    // Filtra apenas arquivos .xml e remove prefixo "NFe" e extensão
    const xmlFiles = files
      .filter(file => file.endsWith(".xml"))
      .map(file => file.replace("NFe", "").replace(".xml", "")); // Retorna apenas a chave
    
    return xmlFiles;
    
  } catch (error) {
    console.error(`Erro ao listar arquivos em ${directory}:`, error);
    return [];
  }
}

/**
 * Obtém estatísticas do storage
 */
export async function getStorageStats(): Promise<{
  rawCount: number;
  validatedCount: number;
  rawFiles: string[];
  validatedFiles: string[];
}> {
  const rawFiles = await listXmlFiles("raw");
  const validatedFiles = await listXmlFiles("validated");
  
  return {
    rawCount: rawFiles.length,
    validatedCount: validatedFiles.length,
    rawFiles,
    validatedFiles,
  };
}

/**
 * Obtém o caminho completo do arquivo validado (para download)
 * @param chave - Chave de acesso da NFe
 */
export function getValidatedFilePath(chave: string): string {
  return getFilepath(chave, "validated");
}

/**
 * Obtém o nome do arquivo baseado na chave
 * @param chave - Chave de acesso da NFe
 */
export function getFileName(chave: string): string {
  return `NFe${chave}.xml`;
}

// Exporta os diretórios para uso em outros módulos
export const STORAGE_PATHS = {
  RAW: UPLOADS_RAW_DIR,
  VALIDATED: STORAGE_VALIDATED_DIR,
  BASE: STORAGE_BASE,
};














