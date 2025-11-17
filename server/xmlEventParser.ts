import { parseString } from "xml2js";
import { promisify } from "util";

const parseXml = promisify(parseString);

// Tipos de eventos NFe
export const TIPO_EVENTO = {
  CANCELAMENTO: "110111",
  CARTA_CORRECAO: "110110",
  CONFIRMACAO: "210200",
  DESCONHECIMENTO: "210220",
  OPERACAO_NAO_REALIZADA: "210240",
} as const;

// Interfaces para eventos
export interface ParsedEventoData {
  tipo: "evento"; // cancelamento ou carta_correcao
  chaveNFe: string;
  tipoEvento: string; // cancelamento, carta_correcao, confirmacao, etc
  codigoEvento: string; // 110111, 110110, etc
  dataEvento: string; // YYYY-MM-DD
  horaEvento: string; // HH:MM:SS
  numeroSequencia: number;
  protocolo: string;
  justificativa?: string; // Para cancelamento
  correcao?: string; // Para carta de correção
  cnpj: string; // CNPJ do emitente
  modelo: string; // 55 ou 65
}

export interface ParsedInutilizacaoData {
  tipo: "inutilizacao";
  cnpj: string;
  ano: string; // 2 dígitos
  serie: string;
  numeroInicial: string;
  numeroFinal: string;
  modelo: string; // 55 ou 65
  justificativa: string;
  protocolo: string;
  dataEvento: string; // YYYY-MM-DD
  horaEvento: string; // HH:MM:SS
}

/**
 * Função auxiliar para navegar no objeto XML parseado
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => {
    if (current && typeof current === 'object') {
      if (Array.isArray(current)) {
        current = current[0];
      }
      return current[key];
    }
    return undefined;
  }, obj);
}

/**
 * Extrai valor de forma segura
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
 * Formata data/hora de evento
 */
function formatDateTime(dhEvento: string): { data: string; hora: string } {
  if (!dhEvento) {
    return { data: '', hora: '' };
  }

  if (dhEvento.includes('T')) {
    // Formato ISO: 2025-08-12T19:02:13-03:00
    const [data, horaComTz] = dhEvento.split('T');
    const hora = horaComTz.split('-')[0].split('+')[0];
    return { data, hora };
  }

  // Fallback
  return { data: dhEvento, hora: '00:00:00' };
}

/**
 * Identifica o tipo de evento pelo código
 */
function identificarTipoEvento(codigoEvento: string): string {
  switch (codigoEvento) {
    case TIPO_EVENTO.CANCELAMENTO:
      return "cancelamento";
    case TIPO_EVENTO.CARTA_CORRECAO:
      return "carta_correcao";
    case TIPO_EVENTO.CONFIRMACAO:
      return "confirmacao";
    case TIPO_EVENTO.DESCONHECIMENTO:
      return "desconhecimento";
    case TIPO_EVENTO.OPERACAO_NAO_REALIZADA:
      return "operacao_nao_realizada";
    default:
      return "outro";
  }
}

/**
 * Parser para XML de Evento (procEventoNFe)
 * Suporta: Cancelamento, Carta de Correção, etc
 */
export async function parseEventoXml(xmlContent: string): Promise<ParsedEventoData> {
  try {
    const result = await parseXml(xmlContent, {
      explicitArray: true,
      mergeAttrs: true,
      explicitRoot: true,
    });

    // Navega até o evento
    const eventoNode = getNestedValue(result, 'procEventoNFe.evento.infEvento');
    if (!eventoNode) {
      throw new Error('Estrutura de evento não encontrada no XML');
    }

    // Extrai dados básicos
    const chaveNFe = extractValue(eventoNode, 'chNFe') || '';
    const codigoEvento = extractValue(eventoNode, 'tpEvento') || '';
    const cnpj = extractValue(eventoNode, 'CNPJ', 'CPF') || '';
    const dhEvento = extractValue(eventoNode, 'dhEvento') || '';
    const nSeqEvento = extractValue(eventoNode, 'nSeqEvento') || '1';
    
    // Extrai protocolo (pode estar em infEvento ou retEvento)
    const protEvento = extractValue(eventoNode, 'detEvento.nProt') || '';
    const retEventoNode = getNestedValue(result, 'procEventoNFe.retEvento.infEvento');
    const protRetEvento = retEventoNode ? extractValue(retEventoNode, 'nProt') || '' : '';
    const protocolo = protEvento || protRetEvento;

    // Extrai chave da NFe para determinar o modelo
    const modelo = chaveNFe.substring(20, 22); // Posição 21-22 da chave é o modelo

    // Formata data e hora
    const { data, hora } = formatDateTime(dhEvento);

    // Identifica tipo de evento
    const tipoEvento = identificarTipoEvento(codigoEvento);

    // Extrai dados específicos do tipo de evento
    const detEvento = getNestedValue(eventoNode, 'detEvento');
    let justificativa: string | undefined;
    let correcao: string | undefined;

    if (tipoEvento === 'cancelamento') {
      justificativa = extractValue(detEvento, 'xJust') || undefined;
    } else if (tipoEvento === 'carta_correcao') {
      correcao = extractValue(detEvento, 'xCorrecao') || undefined;
    }

    if (!chaveNFe || chaveNFe.length !== 44) {
      throw new Error('Chave de acesso inválida ou não encontrada no evento');
    }

    return {
      tipo: "evento",
      chaveNFe,
      tipoEvento,
      codigoEvento,
      dataEvento: data,
      horaEvento: hora,
      numeroSequencia: parseInt(nSeqEvento) || 1,
      protocolo,
      justificativa,
      correcao,
      cnpj,
      modelo,
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Erro ao parsear XML de evento: ${error.message}`);
    }
    throw new Error('Erro desconhecido ao parsear XML de evento');
  }
}

/**
 * Parser para XML de Inutilização (procInutNFe)
 */
export async function parseInutilizacaoXml(xmlContent: string): Promise<ParsedInutilizacaoData> {
  try {
    const result = await parseXml(xmlContent, {
      explicitArray: true,
      mergeAttrs: true,
      explicitRoot: true,
    });

    // Navega até inutilização
    const inutNode = getNestedValue(result, 'ProcInutNFe.inutNFe.infInut');
    if (!inutNode) {
      throw new Error('Estrutura de inutilização não encontrada no XML');
    }

    // Extrai dados
    const cnpj = extractValue(inutNode, 'CNPJ') || '';
    const ano = extractValue(inutNode, 'ano') || '';
    const serie = extractValue(inutNode, 'serie') || '';
    const numeroInicial = extractValue(inutNode, 'nNFIni') || '';
    const numeroFinal = extractValue(inutNode, 'nNFFin') || '';
    const modelo = extractValue(inutNode, 'mod') || '';
    const justificativa = extractValue(inutNode, 'xJust') || '';

    // Extrai protocolo e data do retorno
    const retInutNode = getNestedValue(result, 'ProcInutNFe.retInutNFe.infInut');
    const protocolo = retInutNode ? extractValue(retInutNode, 'nProt') || '' : '';
    const dhRecbto = retInutNode ? extractValue(retInutNode, 'dhRecbto') || '' : '';

    // Formata data e hora
    const { data, hora } = formatDateTime(dhRecbto);

    if (!cnpj || !ano || !serie || !numeroInicial || !numeroFinal) {
      throw new Error('Dados obrigatórios de inutilização não encontrados');
    }

    return {
      tipo: "inutilizacao",
      cnpj,
      ano,
      serie,
      numeroInicial,
      numeroFinal,
      modelo,
      justificativa,
      protocolo,
      dataEvento: data,
      horaEvento: hora,
    };

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Erro ao parsear XML de inutilização: ${error.message}`);
    }
    throw new Error('Erro desconhecido ao parsear XML de inutilização');
  }
}

/**
 * Detecta o tipo de XML (evento ou inutilização)
 */
export function detectEventType(xmlContent: string): "evento" | "inutilizacao" | "unknown" {
  if (xmlContent.includes('<procEventoNFe') || xmlContent.includes('<evento')) {
    return "evento";
  }
  if (xmlContent.includes('<ProcInutNFe') || xmlContent.includes('<inutNFe')) {
    return "inutilizacao";
  }
  return "unknown";
}

/**
 * Valida se o XML é um evento ou inutilização válido
 */
export function isValidEventXml(xmlContent: string): boolean {
  return detectEventType(xmlContent) !== "unknown";
}

/**
 * Parser genérico que detecta e processa automaticamente
 */
export async function parseEventOrInutilizacao(
  xmlContent: string
): Promise<ParsedEventoData | ParsedInutilizacaoData> {
  const type = detectEventType(xmlContent);
  
  if (type === "evento") {
    return await parseEventoXml(xmlContent);
  } else if (type === "inutilizacao") {
    return await parseInutilizacaoXml(xmlContent);
  } else {
    throw new Error('XML não é um evento ou inutilização válido');
  }
}



