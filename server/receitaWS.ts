/**
 * Integração com ReceitaWS API para validação de CNPJ
 * Documentação: https://receitaws.com.br/api
 */

// Cache em memória para evitar rate limit (5 requisições por minuto)
const cnpjCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 horas
const RATE_LIMIT_DELAY = 12000; // 12 segundos entre requisições
let lastRequestTime = 0;

/**
 * Interface de retorno da ReceitaWS
 */
export interface ReceitaWSResponse {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  dataAbertura: string;
  situacao: string;
  tipo: string;
  uf: string;
  municipio: string;
  bairro: string;
  logradouro: string;
  numero: string;
  cep: string;
  complemento: string;
  email: string;
  telefone: string;
  atividadePrincipal: Array<{
    code: string;
    text: string;
  }>;
}

/**
 * Interface normalizada para uso no sistema
 */
export interface CNPJData {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  complemento?: string;
  situacao: string;
  dataAbertura: string;
  telefone?: string;
  email?: string;
}

/**
 * Valida formato do CNPJ (14 dígitos)
 */
export function isValidCnpjFormat(cnpj: string): boolean {
  const cleanCnpj = cnpj.replace(/\D/g, "");
  return cleanCnpj.length === 14 && /^\d{14}$/.test(cleanCnpj);
}

/**
 * Limpa CNPJ removendo caracteres especiais
 */
export function cleanCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

/**
 * Aguarda o delay necessário para respeitar rate limit
 */
async function waitForRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    const waitTime = RATE_LIMIT_DELAY - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
}

/**
 * Busca dados de CNPJ na ReceitaWS
 */
export async function fetchCNPJData(cnpj: string): Promise<{
  success: boolean;
  data?: CNPJData;
  error?: string;
  cached?: boolean;
}> {
  try {
    // Limpa CNPJ
    const cleanedCnpj = cleanCnpj(cnpj);

    // Valida formato
    if (!isValidCnpjFormat(cleanedCnpj)) {
      return {
        success: false,
        error: "CNPJ inválido. Deve conter 14 dígitos.",
      };
    }

    // Verifica cache
    const cached = cnpjCache.get(cleanedCnpj);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      console.log(`CNPJ ${cleanedCnpj} encontrado no cache`);
      return {
        success: true,
        data: cached.data,
        cached: true,
      };
    }

    // Aguarda rate limit
    await waitForRateLimit();

    // Faz requisição para ReceitaWS
    console.log(`Consultando CNPJ ${cleanedCnpj} na ReceitaWS...`);
    const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cleanedCnpj}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return {
          success: false,
          error: "Limite de requisições atingido. Tente novamente em alguns segundos.",
        };
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const responseData = await response.json();

    // Verifica se retornou erro da API
    if (responseData.status === "ERROR") {
      return {
        success: false,
        error: responseData.message || "CNPJ não encontrado ou inválido",
      };
    }

    // Normaliza dados
    const normalizedData: CNPJData = {
      cnpj: cleanedCnpj,
      razaoSocial: responseData.nome || "",
      nomeFantasia: responseData.fantasia || responseData.nome || "",
      rua: responseData.logradouro || "",
      numero: responseData.numero || "",
      bairro: responseData.bairro || "",
      cidade: responseData.municipio || "",
      uf: responseData.uf || "",
      cep: responseData.cep?.replace(/\D/g, "") || "",
      complemento: responseData.complemento || undefined,
      situacao: responseData.situacao || "",
      dataAbertura: responseData.abertura || "",
      telefone: responseData.telefone || undefined,
      email: responseData.email || undefined,
    };

    // Armazena no cache
    cnpjCache.set(cleanedCnpj, {
      data: normalizedData,
      timestamp: Date.now(),
    });

    console.log(`CNPJ ${cleanedCnpj} consultado com sucesso`);

    return {
      success: true,
      data: normalizedData,
      cached: false,
    };

  } catch (error) {
    console.error("Erro ao consultar CNPJ:", error);
    
    return {
      success: false,
      error: error instanceof Error 
        ? `Erro na consulta: ${error.message}` 
        : "Erro desconhecido ao consultar CNPJ",
    };
  }
}

/**
 * Limpa cache de CNPJs antigos (executar periodicamente)
 */
export function clearOldCache(): number {
  const now = Date.now();
  let cleared = 0;

  for (const [cnpj, cached] of cnpjCache.entries()) {
    if (now - cached.timestamp > CACHE_DURATION) {
      cnpjCache.delete(cnpj);
      cleared++;
    }
  }

  if (cleared > 0) {
    console.log(`Cache limpo: ${cleared} CNPJ(s) removido(s)`);
  }

  return cleared;
}

/**
 * Obtém estatísticas do cache
 */
export function getCacheStats(): {
  size: number;
  oldestEntry: number | null;
} {
  const entries = Array.from(cnpjCache.values());
  
  return {
    size: cnpjCache.size,
    oldestEntry: entries.length > 0 
      ? Math.min(...entries.map(e => e.timestamp))
      : null,
  };
}

/**
 * Formata CNPJ para exibição (00.000.000/0000-00)
 */
export function formatCnpjDisplay(cnpj: string): string {
  const cleaned = cleanCnpj(cnpj);
  if (cleaned.length !== 14) return cnpj;
  
  return cleaned.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}







