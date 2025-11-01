import xml2js from "xml2js";
import * as fs from "fs/promises";

export interface ParsedXml {
  chave: string;
  tipoDoc: string; // NFe or NFCe
  dataEmissao: string;
  hora: string;
  cnpjEmitente: string;
  cnpjDestinatario: string | null;
  razaoSocialDestinatario: string | null;
  totalNota: string;
  totalImpostos: string;
}

export async function parseXmlFile(filepath: string): Promise<ParsedXml | null> {
  try {
    const xmlContent = await fs.readFile(filepath, "utf-8");
    return parseXmlContent(xmlContent);
  } catch (error) {
    console.error("Error reading XML file:", error);
    return null;
  }
}

export async function parseXmlContent(xmlContent: string): Promise<ParsedXml | null> {
  try {
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xmlContent);

    // Detect if it's NFe or NFCe
    const isNFe = result.nfeProc !== undefined;
    const isNFCe = result.nfceProc !== undefined;

    if (!isNFe && !isNFCe) {
      console.error("Invalid XML: Not a valid NFe or NFCe");
      return null;
    }

    const tipoDoc = isNFe ? "NFe" : "NFCe";
    const proc = isNFe ? result.nfeProc : result.nfceProc;
    const nfe = proc.NFe || proc.NFCe;
    const infNFe = nfe.infNFe;
    const infNFce = nfe.infNFce;
    const inf = infNFe || infNFce;

    // Extract chave (access key)
    const chave = inf.$ && inf.$.Id ? inf.$.Id.replace("NFe", "").replace("NFCe", "") : "";

    // Extract emission date and time
    const ide = inf.ide;
    const dhEmi = ide.dhEmi || ide.dEmi;
    let dataEmissao = "";
    let hora = "";

    if (dhEmi) {
      const dateTime = new Date(dhEmi);
      dataEmissao = dateTime.toISOString().split("T")[0]; // YYYY-MM-DD
      hora = dateTime.toTimeString().split(" ")[0]; // HH:MM:SS
    }

    // Extract emitter CNPJ
    const emit = inf.emit;
    const cnpjEmitente = emit.CNPJ || "";

    // Extract receiver CNPJ and name
    const dest = inf.dest;
    let cnpjDestinatario = null;
    let razaoSocialDestinatario = null;

    if (dest) {
      cnpjDestinatario = dest.CNPJ || dest.CPF || null;
      razaoSocialDestinatario = dest.xNome || null;
    }

    // Extract totals
    const total = inf.total;
    const icmsTot = total.ICMSTot;
    const totalNota = icmsTot.vNF || "0.00";
    const totalImpostos = icmsTot.vTotTrib || icmsTot.vICMS || "0.00";

    return {
      chave,
      tipoDoc,
      dataEmissao,
      hora,
      cnpjEmitente,
      cnpjDestinatario,
      razaoSocialDestinatario,
      totalNota,
      totalImpostos,
    };
  } catch (error) {
    console.error("Error parsing XML:", error);
    return null;
  }
}

// Validate chave format (44 digits)
export function validateChave(chave: string): boolean {
  return /^\d{44}$/.test(chave);
}

// Extract CNPJ from filename if present
export function extractCnpjFromFilename(filename: string): string | null {
  const cnpjMatch = filename.match(/\d{14}/);
  return cnpjMatch ? cnpjMatch[0] : null;
}
