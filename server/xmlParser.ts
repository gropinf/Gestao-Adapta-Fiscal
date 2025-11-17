import { parseString } from "xml2js";
import { promisify } from "util";

const parseXml = promisify(parseString);

// Interfaces para o retorno do parser
export interface ParsedXmlData {
  chave: string;
  tipoDoc: "NFe" | "NFCe";
  numeroNota: string; // Número da nota (nNF)
  dataEmissao: string; // YYYY-MM-DD
  hora: string; // HH:MM:SS
  cnpjEmitente: string;
  cnpjDestinatario: string | null;
  razaoSocialEmitente: string;
  razaoSocialDestinatario: string | null;
  inscricaoEstadualEmitente: string | null; // IE do emitente
  crtEmitente: string | null; // CRT do emitente (1=Simples Nacional, 2=Simples Nacional excesso, 3=Regime Normal, 4=MEI)
  telefoneEmitente: string | null; // Telefone do emitente
  emailEmitente: string | null; // Email do emitente
  enderecoEmitente: EnderecoData;
  enderecoDestinatario: EnderecoData | null;
  produtos: ProdutoData[];
  impostos: ImpostosData;
  totalNota: number;
  totalImpostos: number;
}

export interface EnderecoData {
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  complemento?: string;
}

export interface ProdutoData {
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  valorDesconto?: number;
}

export interface ImpostosData {
  icms: number;
  ipi: number;
  pis: number;
  cofins: number;
  total: number;
}

/**
 * Função auxiliar para navegar no objeto XML parseado
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    if (current && typeof current === 'object') {
      // Se é um array, pega o primeiro elemento
      if (Array.isArray(current)) {
        current = current[0];
      }
      return current[key];
    }
    return undefined;
  }, obj);
}

/**
 * Extrai valor de forma segura, retornando o primeiro elemento se for array
 */
function extractValue(obj: any, ...paths: string[]): string | null {
  for (const path of paths) {
    const value = getNestedValue(obj, path);
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        return value[0]?.toString() || null;
      }
      return value.toString();
    }
  }
  return null;
}

/**
 * Extrai número de forma segura
 */
function extractNumber(obj: any, ...paths: string[]): number {
  const value = extractValue(obj, ...paths);
  if (!value) return 0;
  return parseFloat(value.replace(',', '.')) || 0;
}

/**
 * Valida formato da chave de acesso NFe (44 dígitos numéricos)
 */
export function validateChave(chave: string): boolean {
  if (!chave) return false;
  
  // Remove espaços e caracteres especiais
  const cleanChave = chave.replace(/\s/g, '');
  
  // Verifica se tem 44 dígitos numéricos
  const chaveRegex = /^\d{44}$/;
  return chaveRegex.test(cleanChave);
}

/**
 * Extrai a UF da chave de acesso (2 primeiros dígitos)
 */
export function extractUfFromChave(chave: string): string | null {
  if (!validateChave(chave)) return null;
  
  const ufCodes: { [key: string]: string } = {
    '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA',
    '16': 'AP', '17': 'TO', '21': 'MA', '22': 'PI', '23': 'CE',
    '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE',
    '29': 'BA', '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
    '41': 'PR', '42': 'SC', '43': 'RS', '50': 'MS', '51': 'MT',
    '52': 'GO', '53': 'DF'
  };
  
  const ufCode = chave.substring(0, 2);
  return ufCodes[ufCode] || null;
}

/**
 * Extrai endereço completo de um nó XML
 */
function extractEndereco(node: any, prefix: string = ''): EnderecoData | null {
  if (!node) return null;
  
  const enderNode = prefix ? getNestedValue(node, prefix) : node;
  if (!enderNode) return null;
  
  return {
    rua: extractValue(enderNode, 'xLgr') || '',
    numero: extractValue(enderNode, 'nro') || 'S/N',
    bairro: extractValue(enderNode, 'xBairro') || '',
    cidade: extractValue(enderNode, 'xMun') || '',
    uf: extractValue(enderNode, 'UF') || '',
    cep: extractValue(enderNode, 'CEP')?.replace(/\D/g, '') || '',
    complemento: extractValue(enderNode, 'xCpl') || undefined,
  };
}

/**
 * Extrai dados de produtos/itens da nota
 */
function extractProdutos(detNodes: any[]): ProdutoData[] {
  if (!Array.isArray(detNodes)) {
    detNodes = [detNodes];
  }
  
  return detNodes.filter(Boolean).map((det) => {
    const prod = getNestedValue(det, 'prod');
    if (!prod) return null;
    
    return {
      codigo: extractValue(prod, 'cProd') || '',
      descricao: extractValue(prod, 'xProd') || '',
      ncm: extractValue(prod, 'NCM') || '',
      cfop: extractValue(prod, 'CFOP') || '',
      unidade: extractValue(prod, 'uCom') || '',
      quantidade: extractNumber(prod, 'qCom'),
      valorUnitario: extractNumber(prod, 'vUnCom'),
      valorTotal: extractNumber(prod, 'vProd'),
      valorDesconto: extractNumber(prod, 'vDesc') || undefined,
    };
  }).filter(Boolean) as ProdutoData[];
}

/**
 * Extrai totais de impostos da nota
 */
function extractImpostos(detNodes: any[], totalNode: any): ImpostosData {
  let icms = 0;
  let ipi = 0;
  let pis = 0;
  let cofins = 0;
  
  // Tenta extrair dos totais primeiro (mais confiável)
  if (totalNode) {
    icms = extractNumber(totalNode, 'ICMSTot.vICMS');
    ipi = extractNumber(totalNode, 'ICMSTot.vIPI');
    pis = extractNumber(totalNode, 'ICMSTot.vPIS');
    cofins = extractNumber(totalNode, 'ICMSTot.vCOFINS');
  }
  
  // Se não encontrou nos totais, soma item por item
  if (icms === 0 && Array.isArray(detNodes)) {
    detNodes.forEach((det) => {
      const imposto = getNestedValue(det, 'imposto');
      if (imposto) {
        icms += extractNumber(imposto, 'ICMS.ICMS00.vICMS', 'ICMS.ICMS10.vICMS', 
                              'ICMS.ICMS20.vICMS', 'ICMS.ICMS30.vICMS',
                              'ICMS.ICMS40.vICMS', 'ICMS.ICMS51.vICMS',
                              'ICMS.ICMS60.vICMS', 'ICMS.ICMS70.vICMS',
                              'ICMS.ICMS90.vICMS');
        ipi += extractNumber(imposto, 'IPI.IPITrib.vIPI');
        pis += extractNumber(imposto, 'PIS.PISAliq.vPIS', 'PIS.PISNT.vPIS', 
                            'PIS.PISOutr.vPIS');
        cofins += extractNumber(imposto, 'COFINS.COFINSAliq.vCOFINS', 
                                'COFINS.COFINSNT.vCOFINS', 'COFINS.COFINSOutr.vCOFINS');
      }
    });
  }
  
  const total = icms + ipi + pis + cofins;
  
  return { icms, ipi, pis, cofins, total };
}

/**
 * Parser principal - extrai todos os dados de um XML NFe/NFCe
 */
export async function parseXmlContent(xmlContent: string): Promise<ParsedXmlData> {
  try {
    // Parse do XML para objeto JavaScript
    const result = await parseXml(xmlContent, {
      explicitArray: true,
      mergeAttrs: true,
      explicitRoot: true,
    });
    
    // Detecta se é NFe ou NFCe pela estrutura
    let nfeNode = getNestedValue(result, 'nfeProc.NFe.infNFe');
    let tipoDoc: "NFe" | "NFCe" = "NFe";
    
    if (!nfeNode) {
      // Tenta NFCe
      nfeNode = getNestedValue(result, 'nfeProc.NFe.infNFe');
      if (!nfeNode) {
        throw new Error('Estrutura de NFe/NFCe não encontrada no XML');
      }
      
      // Verifica se é NFCe pelo modelo
      const modelo = extractValue(nfeNode, 'ide.mod');
      if (modelo === '65') {
        tipoDoc = "NFCe";
      }
    } else {
      const modelo = extractValue(nfeNode, 'ide.mod');
      if (modelo === '65') {
        tipoDoc = "NFCe";
      }
    }
    
    // Extrai chave de acesso
    const chave = extractValue(nfeNode, 'Id')?.replace('NFe', '') || 
                  extractValue(result, 'nfeProc.protNFe.infProt.chNFe') || '';
    
    if (!validateChave(chave)) {
      throw new Error('Chave de acesso inválida ou não encontrada');
    }
    
    // Extrai dados da IDE (identificação)
    const ide = getNestedValue(nfeNode, 'ide');
    const dataEmissao = extractValue(ide, 'dhEmi', 'dEmi') || '';
    const numeroNota = extractValue(ide, 'nNF') || '0'; // Número da nota
    
    // Separa data e hora
    let dataFormatada = '';
    let horaFormatada = '';
    
    if (dataEmissao.includes('T')) {
      // Formato ISO: 2024-11-02T10:30:00-03:00
      const [data, horaComTz] = dataEmissao.split('T');
      dataFormatada = data;
      horaFormatada = horaComTz.split('-')[0].split('+')[0]; // Remove timezone
    } else if (dataEmissao.length === 8) {
      // Formato: YYYYMMDD
      dataFormatada = `${dataEmissao.substring(0, 4)}-${dataEmissao.substring(4, 6)}-${dataEmissao.substring(6, 8)}`;
      horaFormatada = '00:00:00';
    }
    
    // Extrai dados do emitente
    const emit = getNestedValue(nfeNode, 'emit');
    const cnpjEmitente = extractValue(emit, 'CNPJ')?.replace(/\D/g, '') || '';
    const razaoSocialEmitente = extractValue(emit, 'xNome', 'xFant') || '';
    const inscricaoEstadualEmitente = extractValue(emit, 'IE') || null; // Inscrição Estadual
    const crtEmitente = extractValue(emit, 'CRT') || null; // CRT (Código de Regime Tributário)
    const telefoneEmitente = extractValue(emit, 'enderEmit.fone') || null; // Telefone do emitente
    const emailEmitente = extractValue(emit, 'email') || null; // Email do emitente
    const enderecoEmitente = extractEndereco(emit, 'enderEmit') || {
      rua: '', numero: '', bairro: '', cidade: '', uf: '', cep: ''
    };
    
    // Extrai dados do destinatário (pode não existir em NFCe)
    const dest = getNestedValue(nfeNode, 'dest');
    const cnpjDestinatario = dest ? (extractValue(dest, 'CNPJ') || extractValue(dest, 'CPF'))?.replace(/\D/g, '') || null : null;
    const razaoSocialDestinatario = dest ? extractValue(dest, 'xNome') : null;
    const enderecoDestinatario = dest ? extractEndereco(dest, 'enderDest') : null;
    
    // Extrai produtos
    const detNodes = getNestedValue(nfeNode, 'det') || [];
    const produtos = extractProdutos(detNodes);
    
    // Extrai impostos
    const totalNode = getNestedValue(nfeNode, 'total');
    const impostos = extractImpostos(detNodes, totalNode);
    
    // Extrai totais
    const totalNota = extractNumber(totalNode, 'ICMSTot.vNF');
    
    return {
      chave,
      tipoDoc,
      numeroNota,
      dataEmissao: dataFormatada,
      hora: horaFormatada,
      cnpjEmitente,
      cnpjDestinatario,
      razaoSocialEmitente,
      razaoSocialDestinatario,
      inscricaoEstadualEmitente,
      crtEmitente,
      telefoneEmitente,
      emailEmitente,
      enderecoEmitente,
      enderecoDestinatario,
      produtos,
      impostos,
      totalNota,
      totalImpostos: impostos.total,
    };
    
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Erro ao parsear XML: ${error.message}`);
    }
    throw new Error('Erro desconhecido ao parsear XML');
  }
}

/**
 * Valida se o conteúdo é um XML válido de NFe/NFCe
 */
export function isValidNFeXml(xmlContent: string): boolean {
  try {
    // Verifica se contém tags básicas de NFe
    const hasNFeTag = xmlContent.includes('<NFe') || xmlContent.includes('<nfeProc');
    const hasInfNFe = xmlContent.includes('<infNFe');
    
    return hasNFeTag && hasInfNFe;
  } catch {
    return false;
  }
}
