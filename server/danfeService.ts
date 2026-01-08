import { gerarPDF } from '@alexssmusica/node-pdf-nfe';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readXmlContent } from './xmlReaderService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DANFE_DIR = path.join(__dirname, '../storage/danfe');

// Criar pasta se não existir
if (!fs.existsSync(DANFE_DIR)) {
  fs.mkdirSync(DANFE_DIR, { recursive: true });
  console.log('📁 Pasta storage/danfe criada com sucesso');
}

/**
 * Gera o PDF DANFE a partir de um arquivo XML
 * @param xmlPath - Caminho completo do arquivo XML
 * @param logoPath - Caminho opcional para logo da empresa
 * @returns Caminho completo do arquivo PDF gerado
 */
export const gerarDanfe = async (xmlPath: string, logoPath?: string | null): Promise<string> => {
  try {
    // Ler conteúdo do XML (do sistema local ou Contabo)
    let xmlContent: string;
    
    if (xmlPath.startsWith('http://') || xmlPath.startsWith('https://')) {
      // É URL do Contabo - baixa do storage
      xmlContent = await readXmlContent(xmlPath) || '';
      if (!xmlContent) {
        throw new Error(`Arquivo XML não encontrado no Contabo: ${xmlPath}`);
      }
      // Extrair chave da URL (última parte antes de .xml)
      const urlParts = xmlPath.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const chave = fileName.replace('.xml', '').replace('NFe', '');
    } else {
      // É caminho local - verifica se existe
      if (!fs.existsSync(xmlPath)) {
        throw new Error(`Arquivo XML não encontrado: ${xmlPath}`);
      }
      xmlContent = fs.readFileSync(xmlPath, 'utf-8');
    }
    
    // Extrair a chave do XML (do conteúdo ou do caminho)
    let chave: string;
    if (xmlPath.startsWith('http://') || xmlPath.startsWith('https://')) {
      // Extrair da URL
      const urlParts = xmlPath.split('/');
      const fileName = urlParts[urlParts.length - 1];
      chave = fileName.replace('.xml', '').replace('NFe', '');
    } else {
      // Extrair do nome do arquivo
      chave = path.basename(xmlPath, '.xml').replace('NFe', '');
    }
    
    const pdfPath = path.join(DANFE_DIR, `${chave}-DANFE.pdf`);

    // Evitar regerar se já existe
    if (fs.existsSync(pdfPath)) {
      console.log(`✅ DANFE já existe: ${chave}-DANFE.pdf`);
      return pdfPath;
    }

    console.log(`🔄 Gerando DANFE para: ${chave}`);

    // Detectar se a nota foi cancelada
    const isCancelada = xmlContent.includes('<cStat>101') || 
                        xmlContent.includes('<cStat>135') ||
                        xmlContent.includes('CANCELAMENTO');

    // Opções para geração do DANFE
    const options: any = {
      pathLogo: logoPath || undefined,
      cancelada: isCancelada,
    };

    // Gerar o PDF
    const doc = await gerarPDF(xmlContent, options);
    
    // Criar stream de escrita
    const writeStream = fs.createWriteStream(pdfPath);
    
    // Aguardar finalização do documento e da escrita
    await new Promise<void>((resolve, reject) => {
      // Pipe do documento para o arquivo
      doc.pipe(writeStream);
      
      // Listener para quando o writeStream terminar
      writeStream.on('finish', () => {
        console.log(`✅ DANFE gerado com sucesso: ${chave}-DANFE.pdf`);
        resolve();
      });
      
      // Listener para erros no writeStream
      writeStream.on('error', (err) => {
        console.error(`❌ Erro ao escrever PDF: ${err.message}`);
        reject(err);
      });
      
      // Listener para erros no documento
      doc.on('error', (err: Error) => {
        console.error(`❌ Erro no documento PDF: ${err.message}`);
        reject(err);
      });
      
      // A biblioteca gerarPDF já finaliza o documento automaticamente
      // Não precisamos chamar doc.end() manualmente
    });

    return pdfPath;
  } catch (error: any) {
    console.error('❌ Erro ao gerar DANFE:', error.message);
    throw new Error(`Falha ao gerar o DANFE: ${error.message}`);
  }
};

/**
 * Verifica se o DANFE já foi gerado para uma chave
 * @param chave - Chave de acesso da NFe
 * @returns true se o PDF já existe
 */
export const danfeExists = (chave: string): boolean => {
  const pdfPath = path.join(DANFE_DIR, `${chave}-DANFE.pdf`);
  return fs.existsSync(pdfPath);
};

/**
 * Obtém o caminho do DANFE para uma chave
 * @param chave - Chave de acesso da NFe
 * @returns Caminho completo do PDF ou null se não existir
 */
export const getDanfePath = (chave: string): string | null => {
  const pdfPath = path.join(DANFE_DIR, `${chave}-DANFE.pdf`);
  return fs.existsSync(pdfPath) ? pdfPath : null;
};


