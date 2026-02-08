/**
 * Serviço para ler XMLs do sistema de arquivos local ou do Contabo Storage
 * Detecta automaticamente a origem do arquivo baseado no filepath
 */

import * as fs from 'fs/promises';
import { getFile } from './contaboStorage';

/**
 * Verifica se um filepath é uma URL do Contabo Storage
 */
export function isStorageUrl(filepath: string): boolean {
  if (!filepath) return false;
  return filepath.startsWith('http://') || filepath.startsWith('https://');
}

/**
 * Extrai a chave (key) de uma URL do Contabo Storage
 * Exemplo: https://usc1.contabostorage.com/bucket/12345678000190/xml/12345678901234567890123456789012345678901234.xml
 * Retorna: 12345678000190/xml/12345678901234567890123456789012345678901234.xml
 */
export function extractKeyFromStorageUrl(url: string): string | null {
  try {
    // Remove protocolo e domínio
    const urlObj = new URL(url);
    // A chave é tudo após o bucket name
    // Formato: /bucket/key
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    if (pathParts.length < 2) return null;
    
    // Remove o bucket (primeiro elemento) e junta o resto
    const key = pathParts.slice(1).join('/');
    return key;
  } catch {
    return null;
  }
}

/**
 * Lê o conteúdo de um XML, seja do sistema de arquivos local ou do Contabo Storage
 * 
 * @param filepath - Caminho local ou URL do Contabo
 * @returns Conteúdo do XML como string ou null se não encontrado
 */
export async function readXmlContent(filepath: string): Promise<string | null> {
  try {
    if (isStorageUrl(filepath)) {
      // É URL do storage - baixa do storage
      // A key contém o CNPJ na estrutura: {CNPJ}/xml/{chave}.xml
      const key = extractKeyFromStorageUrl(filepath);
      if (!key) {
        console.error(`Não foi possível extrair a chave da URL do Storage: ${filepath}`);
        return null;
      }
      
      // Log para debug: mostra qual CNPJ está sendo lido
      const keyParts = key.split('/');
      if (keyParts.length >= 2) {
        const cnpjFromKey = keyParts[0];
        console.log(`[Contabo Storage] Lendo XML do CNPJ: ${cnpjFromKey} (key: ${key})`);
      }
      
      const buffer = await getFile(key);
      if (!buffer) {
        console.error(`Arquivo não encontrado no Storage: ${key}`);
        return null;
      }
      
      return buffer.toString('utf-8');
    } else {
      // É caminho local - lê do sistema de arquivos
      const content = await fs.readFile(filepath, 'utf-8');
      return content;
    }
  } catch (error) {
    console.error(`Erro ao ler XML de ${filepath}:`, error);
    return null;
  }
}

/**
 * Lê o conteúdo de um XML como Buffer
 * 
 * @param filepath - Caminho local ou URL do Contabo
 * @returns Conteúdo do XML como Buffer ou null se não encontrado
 */
export async function readXmlBuffer(filepath: string): Promise<Buffer | null> {
  try {
    if (isStorageUrl(filepath)) {
      // É URL do storage - baixa do storage
      const key = extractKeyFromStorageUrl(filepath);
      if (!key) {
        console.error(`Não foi possível extrair a chave da URL do Storage: ${filepath}`);
        return null;
      }
      
      const buffer = await getFile(key);
      return buffer;
    } else {
      // É caminho local - lê do sistema de arquivos
      const buffer = await fs.readFile(filepath);
      return buffer;
    }
  } catch (error) {
    console.error(`Erro ao ler XML de ${filepath}:`, error);
    return null;
  }
}
