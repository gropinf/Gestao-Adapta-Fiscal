/**
 * Serviço para escanear o Contabo Storage e reimportar XMLs que estão lá mas não no banco
 */

import { listFiles, getFile, extractChaveAcessoFromXml } from './contaboStorage';
import { parseXmlContent } from './xmlParser';
import { storage } from './storage';
import { db } from './db';
import { xmls } from '@shared/schema';
import { getOrCreateCompanyByCnpj } from './utils/companyAutoCreate';

export interface ScanResult {
  totalFiles: number;
  filesInStorage: number;
  filesInDatabase: number;
  missingInDatabase: number;
  processed: number;
  success: number;
  errors: number;
  results: Array<{
    key: string;
    chave?: string;
    status: 'success' | 'error' | 'skipped';
    error?: string;
  }>;
}

/**
 * Escaneia todas as pastas de CNPJ no Contabo e encontra XMLs faltantes no banco
 * @param userId ID do usuário para vincular empresas criadas automaticamente
 */
export async function scanContaboForMissingXmls(userId: string): Promise<ScanResult> {
  const result: ScanResult = {
    totalFiles: 0,
    filesInStorage: 0,
    filesInDatabase: 0,
    missingInDatabase: 0,
    processed: 0,
    success: 0,
    errors: 0,
    results: [],
  };

  try {
    // 1. Lista todos os arquivos no bucket (prefixo vazio = tudo)
    console.log('📡 Escaneando Contabo Storage...');
    const allFiles = await listFiles('');
    
    // Filtra apenas XMLs na pasta xml/
    const xmlFiles = allFiles.filter(file => 
      file.key.includes('/xml/') && file.key.endsWith('.xml')
    );

    result.totalFiles = allFiles.length;
    result.filesInStorage = xmlFiles.length;

    console.log(`📦 Encontrados ${xmlFiles.length} XMLs no Contabo Storage`);

    // 2. Busca todas as chaves no banco de dados
    const allXmlsInDb = await db.select({ chave: xmls.chave }).from(xmls);
    const chavesInDb = new Set(allXmlsInDb.map(x => x.chave));
    result.filesInDatabase = chavesInDb.size;

    console.log(`💾 Encontradas ${chavesInDb.size} chaves no banco de dados`);

    // 3. Identifica XMLs faltantes
    const missingXmls: typeof xmlFiles = [];
    
    for (const file of xmlFiles) {
      // Extrai chave do nome do arquivo (última parte antes de .xml)
      const fileName = file.key.split('/').pop()?.replace('.xml', '') || '';
      
      // Valida se é uma chave válida (44 dígitos)
      const cleanChave = fileName.replace(/[^\d]/g, '');
      if (cleanChave.length === 44 && !chavesInDb.has(cleanChave)) {
        missingXmls.push(file);
      }
    }

    result.missingInDatabase = missingXmls.length;
    console.log(`🔍 Encontrados ${missingXmls.length} XMLs no Contabo que não estão no banco`);

    // 4. Processa cada XML faltante
    for (const file of missingXmls) {
      result.processed++;
      
      try {
        // Baixa o XML do Contabo
        const xmlBuffer = await getFile(file.key);
        if (!xmlBuffer) {
          result.errors++;
          result.results.push({
            key: file.key,
            status: 'error',
            error: 'Erro ao baixar arquivo do Contabo',
          });
          continue;
        }

        const xmlContent = xmlBuffer.toString('utf-8');
        
        // Extrai chave do XML
        const chave = extractChaveAcessoFromXml(xmlContent);
        if (!chave) {
          result.errors++;
          result.results.push({
            key: file.key,
            status: 'error',
            error: 'Não foi possível extrair chave de acesso do XML',
          });
          continue;
        }

        // Verifica se já foi importado (pode ter sido importado enquanto processávamos)
        const existing = await storage.getXmlByChave(chave);
        if (existing) {
          result.results.push({
            key: file.key,
            chave,
            status: 'skipped',
            error: 'Já existe no banco (importado durante o processo)',
          });
          continue;
        }

        // Parse do XML
        const parsedXml = await parseXmlContent(xmlContent);

        // Busca empresas do usuário
        const userCompanies = await storage.getCompaniesByUser(userId);
        const userCnpjs = new Set(userCompanies.map(c => c.cnpj));

        // Categorização
        let categoria: "emitida" | "recebida";
        const userHasEmitter = userCnpjs.has(parsedXml.cnpjEmitente);
        const userHasReceiver = parsedXml.cnpjDestinatario && userCnpjs.has(parsedXml.cnpjDestinatario);
        
        if (userHasEmitter) {
          categoria = "emitida";
        } else if (userHasReceiver) {
          categoria = "recebida";
        } else {
          categoria = "emitida";
        }

        // Busca ou cria empresa
        const { company } = await getOrCreateCompanyByCnpj(
          parsedXml.cnpjEmitente,
          parsedXml,
          userId
        );

        // Salva no banco
        await storage.createXml({
          companyId: null,
          chave: parsedXml.chave,
          numeroNota: parsedXml.numeroNota || null,
          tipoDoc: parsedXml.tipoDoc,
          dataEmissao: parsedXml.dataEmissao,
          hora: parsedXml.hora || "00:00:00",
          cnpjEmitente: parsedXml.cnpjEmitente,
          cnpjDestinatario: parsedXml.cnpjDestinatario || null,
          razaoSocialDestinatario: parsedXml.razaoSocialDestinatario || null,
          totalNota: parsedXml.totalNota.toString(),
          totalImpostos: parsedXml.totalImpostos.toString(),
          categoria,
          statusValidacao: "valido",
          filepath: file.url,
        });

        result.success++;
        result.results.push({
          key: file.key,
          chave,
          status: 'success',
        });

        console.log(`✅ Importado: ${chave}`);

      } catch (error) {
        result.errors++;
        result.results.push({
          key: file.key,
          status: 'error',
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        });
        console.error(`❌ Erro ao processar ${file.key}:`, error);
      }
    }

    return result;

  } catch (error) {
    console.error('Erro ao escanear Contabo:', error);
    throw error;
  }
}
