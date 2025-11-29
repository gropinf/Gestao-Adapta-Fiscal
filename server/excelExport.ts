import * as XLSX from "xlsx";
import type { Xml } from "@shared/schema";

/**
 * Interface para opções de exportação
 */
export interface ExportOptions {
  companyName?: string;
  period?: string;
  includeDetails?: boolean;
}

/**
 * Formata um valor em moeda brasileira para a planilha
 */
function formatCurrency(value: string | number): string {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numValue);
}

/**
 * Formata CNPJ
 */
function formatCNPJ(cnpj: string): string {
  if (!cnpj || cnpj.length !== 14) return cnpj;
  return cnpj.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

/**
 * Gera planilha Excel com lista de XMLs
 */
export function generateXmlsExcel(xmls: Xml[], options: ExportOptions = {}): Buffer {
  // Prepara dados para a planilha
  const data = xmls.map((xml, index) => ({
    "#": index + 1,
    "Tipo": xml.tipoDoc,
    "Categoria": xml.categoria.toUpperCase(),
    "Chave de Acesso": xml.chave,
    "Data Emissão": xml.dataEmissao,
    "Hora": xml.hora || "—",
    "CNPJ Emitente": formatCNPJ(xml.cnpjEmitente),
    "CNPJ Destinatário": xml.cnpjDestinatario ? formatCNPJ(xml.cnpjDestinatario) : "—",
    "Destinatário": xml.razaoSocialDestinatario || "—",
    "Total da Nota": formatCurrency(xml.totalNota),
    "Total Impostos": xml.totalImpostos ? formatCurrency(xml.totalImpostos) : "—",
    "Status": xml.statusValidacao === "valido" ? "Válido" : "Inválido",
    "Data Cadastro": xml.createdAt ? new Date(xml.createdAt).toLocaleDateString("pt-BR") : "—",
  }));

  // Cria workbook
  const workbook = XLSX.utils.book_new();

  // Adiciona informações do cabeçalho
  const headerData: any[][] = [];
  
  if (options.companyName) {
    headerData.push(["Empresa:", options.companyName]);
  }
  if (options.period) {
    headerData.push(["Período:", options.period]);
  }
  headerData.push(["Data de Geração:", new Date().toLocaleString("pt-BR")]);
  headerData.push(["Total de Registros:", xmls.length]);
  headerData.push([]); // Linha em branco

  // Calcula totalizadores
  const totalNotas = xmls.reduce((sum, xml) => sum + parseFloat(xml.totalNota || "0"), 0);
  const totalImpostos = xmls.reduce((sum, xml) => sum + parseFloat(xml.totalImpostos || "0"), 0);
  const emitidas = xmls.filter(x => x.categoria === "emitida").length;
  const recebidas = xmls.filter(x => x.categoria === "recebida").length;

  headerData.push(["TOTALIZADORES"]);
  headerData.push(["Total de Notas Emitidas:", emitidas]);
  headerData.push(["Total de Notas Recebidas:", recebidas]);
  headerData.push(["Valor Total das Notas:", formatCurrency(totalNotas)]);
  headerData.push(["Valor Total de Impostos:", formatCurrency(totalImpostos)]);
  headerData.push([]); // Linha em branco
  headerData.push([]); // Linha em branco

  // Cria worksheet com cabeçalho
  const worksheet = XLSX.utils.aoa_to_sheet(headerData);

  // Adiciona dados principais
  XLSX.utils.sheet_add_json(worksheet, data, {
    origin: -1, // Adiciona após última linha
    skipHeader: false,
  });

  // Configurações de largura das colunas
  const columnWidths = [
    { wch: 5 },  // #
    { wch: 8 },  // Tipo
    { wch: 12 }, // Categoria
    { wch: 48 }, // Chave
    { wch: 12 }, // Data Emissão
    { wch: 10 }, // Hora
    { wch: 20 }, // CNPJ Emitente
    { wch: 20 }, // CNPJ Destinatário
    { wch: 35 }, // Destinatário
    { wch: 18 }, // Total Nota
    { wch: 18 }, // Total Impostos
    { wch: 10 }, // Status
    { wch: 14 }, // Data Cadastro
  ];
  worksheet["!cols"] = columnWidths;

  // Adiciona worksheet ao workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "XMLs");

  // Se solicitado, adiciona aba de detalhes
  if (options.includeDetails) {
    const detailsData = xmls.map((xml, index) => ({
      "#": index + 1,
      "Chave": xml.chave,
      "Tipo Doc": xml.tipoDoc,
      "Categoria": xml.categoria,
      "Data Emissão": xml.dataEmissao,
      "Hora": xml.hora || "",
      "CNPJ Emitente": xml.cnpjEmitente,
      "CNPJ Destinatário": xml.cnpjDestinatario || "",
      "Razão Social Destinatário": xml.razaoSocialDestinatario || "",
      "Total Nota (Numérico)": parseFloat(xml.totalNota),
      "Total Impostos (Numérico)": xml.totalImpostos ? parseFloat(xml.totalImpostos) : 0,
      "Status Validação": xml.statusValidacao,
      "Arquivo": xml.filepath,
      "ID Empresa": xml.companyId,
      "ID Registro": xml.id,
    }));

    const detailsWorksheet = XLSX.utils.json_to_sheet(detailsData);
    detailsWorksheet["!cols"] = [
      { wch: 5 },
      { wch: 48 },
      { wch: 8 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 20 },
      { wch: 20 },
      { wch: 35 },
      { wch: 15 },
      { wch: 15 },
      { wch: 12 },
      { wch: 50 },
      { wch: 38 },
      { wch: 38 },
    ];
    
    XLSX.utils.book_append_sheet(workbook, detailsWorksheet, "Detalhes");
  }

  // Gera buffer do arquivo Excel
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  
  return buffer;
}

/**
 * Gera nome de arquivo para o Excel
 */
export function generateExcelFilename(companyName?: string, dateRange?: string): string {
  const date = new Date().toISOString().split('T')[0];
  const companyPart = companyName ? `_${companyName.replace(/[^a-zA-Z0-9]/g, "_")}` : "";
  const periodPart = dateRange ? `_${dateRange.replace(/[^a-zA-Z0-9]/g, "_")}` : "";
  
  return `Relatorio_XMLs${companyPart}${periodPart}_${date}.xlsx`;
}

/**
 * Gera planilha resumida (apenas totalizadores por período)
 */
export function generateSummaryExcel(xmls: Xml[], options: ExportOptions = {}): Buffer {
  // Agrupa por data
  const groupedByDate = xmls.reduce((acc, xml) => {
    const date = xml.dataEmissao;
    if (!acc[date]) {
      acc[date] = {
        date,
        count: 0,
        emitidas: 0,
        recebidas: 0,
        totalNotas: 0,
        totalImpostos: 0,
      };
    }
    acc[date].count++;
    acc[date][xml.categoria === "emitida" ? "emitidas" : "recebidas"]++;
    acc[date].totalNotas += parseFloat(xml.totalNota || "0");
    acc[date].totalImpostos += parseFloat(xml.totalImpostos || "0");
    return acc;
  }, {} as Record<string, any>);

  const summaryData = Object.values(groupedByDate)
    .sort((a: any, b: any) => b.date.localeCompare(a.date))
    .map((item: any) => ({
      "Data": item.date,
      "Total XMLs": item.count,
      "Emitidas": item.emitidas,
      "Recebidas": item.recebidas,
      "Total Notas": formatCurrency(item.totalNotas),
      "Total Impostos": formatCurrency(item.totalImpostos),
    }));

  // Cria workbook
  const workbook = XLSX.utils.book_new();

  // Adiciona cabeçalho
  const headerData: any[][] = [];
  if (options.companyName) {
    headerData.push(["Empresa:", options.companyName]);
  }
  if (options.period) {
    headerData.push(["Período:", options.period]);
  }
  headerData.push(["Relatório:", "Resumo por Data"]);
  headerData.push(["Gerado em:", new Date().toLocaleString("pt-BR")]);
  headerData.push([]);

  const worksheet = XLSX.utils.aoa_to_sheet(headerData);
  XLSX.utils.sheet_add_json(worksheet, summaryData, { origin: -1 });

  worksheet["!cols"] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Resumo por Data");

  // Gera buffer
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  
  return buffer;
}














