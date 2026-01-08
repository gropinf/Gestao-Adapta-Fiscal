/**
 * Serviço unificado para salvar XMLs no Contabo Storage
 * Substitui o uso de fileStorage.saveToValidated
 */

import { uploadFile, sanitizeCnpj } from './contaboStorage';
import type { ParsedXmlData } from './xmlParser';
import type { ParsedEventoData, ParsedInutilizacaoData } from './xmlEventParser';

/**
 * Salva um XML de NFe no Contabo Storage
 * Organiza por CNPJ (emitente ou destinatário) na estrutura: {CNPJ}/xml/{chave}.xml
 * 
 * @param xmlContent - Conteúdo do XML (string ou Buffer)
 * @param parsedXml - Dados parseados do XML (para obter CNPJ e chave)
 * @returns URL do arquivo no Contabo Storage
 */
export async function saveXmlToContabo(
  xmlContent: string | Buffer,
  parsedXml: ParsedXmlData
): Promise<{ success: boolean; filepath?: string; error?: string }> {
  try {
    // Determina qual CNPJ usar (prioriza emitente, usa destinatário como fallback)
    // IMPORTANTE: Usa o CNPJ do XML, NÃO o CNPJ da empresa logada
    const cnpj = parsedXml.cnpjEmitente || parsedXml.cnpjDestinatario;
    
    if (!cnpj) {
      return {
        success: false,
        error: 'XML não possui CNPJ emitente nem destinatário',
      };
    }

    // Valida chave de acesso
    if (!parsedXml.chave || parsedXml.chave.replace(/\D/g, '').length !== 44) {
      return {
        success: false,
        error: 'Chave de acesso inválida',
      };
    }

    // Faz upload para Contabo Storage
    // Usa estrutura: {CNPJ}/xml/{chave}.xml (singular, conforme guia)
    // O CNPJ usado é sempre o do XML (emitente ou destinatário)
    
    const cleanCnpj = sanitizeCnpj(cnpj);
    const cleanChave = parsedXml.chave.replace(/\D/g, '');
    
    // Log para debug: mostra qual CNPJ está sendo usado
    const cnpjSource = parsedXml.cnpjEmitente ? 'emitente' : 'destinatário';
    console.log(`[Contabo Storage] Salvando XML ${cleanChave.substring(0, 12)}... usando CNPJ ${cnpjSource}: ${cleanCnpj}`);
    
    const buffer = typeof xmlContent === 'string' 
      ? Buffer.from(xmlContent, 'utf-8') 
      : xmlContent;
    
    // Estrutura: {CNPJ}/xml/{chave}.xml (singular, conforme guia)
    const key = `${cleanCnpj}/xml/${cleanChave}.xml`;
    
    const result = await uploadFile(buffer, key, 'application/xml');
    
    if (!result.success || !result.url) {
      return {
        success: false,
        error: result.error || 'Erro ao fazer upload para Contabo Storage',
      };
    }

    console.log(`[Contabo Storage] ✅ XML salvo com sucesso: ${key} -> ${result.url}`);
    
    return {
      success: true,
      filepath: result.url,
    };
  } catch (error) {
    console.error('Erro ao salvar XML no Contabo Storage:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao salvar XML',
    };
  }
}

/**
 * Salva um XML de evento (cancelamento, carta de correção, inutilização) no Contabo Storage
 * Organiza por CNPJ na estrutura: {CNPJ}/xml/eventos/{tipo}-{identificador}.xml
 * 
 * @param xmlContent - Conteúdo do XML (string ou Buffer)
 * @param parsedEvent - Dados parseados do evento
 * @returns URL do arquivo no Contabo Storage
 */
export async function saveEventXmlToContabo(
  xmlContent: string | Buffer,
  parsedEvent: ParsedEventoData | ParsedInutilizacaoData
): Promise<{ success: boolean; filepath?: string; error?: string }> {
  try {
    // IMPORTANTE: Usa o CNPJ do evento, NÃO o CNPJ da empresa logada
    const cnpj = parsedEvent.cnpj;
    
    if (!cnpj) {
      return {
        success: false,
        error: 'Evento não possui CNPJ',
      };
    }

    const cleanCnpj = sanitizeCnpj(cnpj);
    const buffer = typeof xmlContent === 'string' 
      ? Buffer.from(xmlContent, 'utf-8') 
      : xmlContent;
    
    // Gera identificador único para o arquivo
    let fileName: string;
    
    if (parsedEvent.tipo === 'evento') {
      const evento = parsedEvent as ParsedEventoData;
      // Para eventos: {tipo}-{chaveNFe}-{sequencia}.xml
      const sequencia = evento.numeroSequencia || '0';
      fileName = `${evento.tipoEvento}-${evento.chaveNFe}-${sequencia}.xml`;
    } else {
      // Para inutilizações: inutilizacao-{cnpj}-{ano}-{serie}-{numeroInicial}-{numeroFinal}.xml
      const inut = parsedEvent as ParsedInutilizacaoData;
      fileName = `inutilizacao-${cleanCnpj}-${inut.ano}-${inut.serie}-${inut.numeroInicial}-${inut.numeroFinal}.xml`;
    }
    
    // Estrutura: {CNPJ}/xml/eventos/{fileName}
    // O CNPJ usado é sempre o do evento
    const key = `${cleanCnpj}/xml/eventos/${fileName}`;
    
    console.log(`[Contabo Storage] Salvando evento XML usando CNPJ do evento: ${cleanCnpj} -> ${key}`);
    
    const result = await uploadFile(buffer, key, 'application/xml');
    
    if (!result.success || !result.url) {
      return {
        success: false,
        error: result.error || 'Erro ao fazer upload para Contabo Storage',
      };
    }

    console.log(`[Contabo Storage] ✅ Evento XML salvo com sucesso: ${key} -> ${result.url}`);
    
    return {
      success: true,
      filepath: result.url,
    };
  } catch (error) {
    console.error('Erro ao salvar evento XML no Contabo Storage:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao salvar evento XML',
    };
  }
}
