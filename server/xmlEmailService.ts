import * as fs from "fs/promises";
import * as path from "path";
import { sendEmailWithFallback } from "./emailService";
import { storage } from "./storage";
import { buildZipEntries, createZipFile } from "./xmlZipService";
import type { Company } from "../shared/schema";

/**
 * Interface para resultado do envio
 */
export interface XmlEmailResult {
  success: boolean;
  zipFilename: string;
  xmlCount: number;
  emailSubject: string;
  error?: string;
  errorDetails?: string;
  errorStack?: string;
}

/**
 * Formata CNPJ para exibição (XX.XXX.XXX/XXXX-XX)
 */
function formatCnpj(cnpj: string): string {
  if (!cnpj || cnpj.length !== 14) return cnpj;
  return `${cnpj.substring(0, 2)}.${cnpj.substring(2, 5)}.${cnpj.substring(5, 8)}/${cnpj.substring(8, 12)}-${cnpj.substring(12, 14)}`;
}

/**
 * Formata data para exibição (DD/MM/YYYY)
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Formata data para nome de arquivo (DDMMYYYY)
 */
function formatDateFilename(dateStr: string): string {
  if (!dateStr) return "";
  const [year, month, day] = dateStr.split("-");
  return `${day}${month}${year}`;
}

/**
 * Remove caracteres especiais de uma string para uso em nomes de arquivo
 */
function sanitizeFilename(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove acentos
    .replace(/[^a-zA-Z0-9\s]/g, "") // Remove caracteres especiais
    .replace(/\s+/g, "_") // Substitui espaços por underscore
    .toUpperCase();
}

/**
 * Gera o nome do arquivo ZIP
 * Formato: xml_CNPJ_DTINICIO_DTFIM_RAZAOSOCIAL.zip
 */
function generateZipFilename(company: Company, periodStart: string, periodEnd: string): string {
  const cnpj = company.cnpj;
  const dtInicio = formatDateFilename(periodStart);
  const dtFim = formatDateFilename(periodEnd);
  const razaoSocial = sanitizeFilename(company.razaoSocial);

  return `xml_${cnpj}_${dtInicio}_${dtFim}_${razaoSocial}.zip`;
}

function generateZipFilenameWithSuffix(
  company: Company,
  periodStart: string,
  periodEnd: string,
  suffix: string
): string {
  const base = generateZipFilename(company, periodStart, periodEnd).replace(".zip", "");
  return `${base}_${suffix}.zip`;
}

/**
 * Gera o template HTML do email
 */
function generateEmailTemplate(
  company: Company,
  periodStart: string,
  periodEnd: string,
  xmlCount: number,
  eventCount: number,
  inutCount: number,
  otherEventCount: number,
  xmlZipFilename: string,
  eventZipFilename?: string | null
): string {
  const cnpjFormatado = formatCnpj(company.cnpj);
  const dtInicio = formatDate(periodStart);
  const dtFim = formatDate(periodEnd);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #10B981 0%, #059669 100%);
      padding: 30px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .header h1 {
      color: white;
      margin: 0;
      font-size: 24px;
    }
    .content {
      background: #f9fafb;
      padding: 30px;
      border-radius: 0 0 8px 8px;
    }
    .info-box {
      background: white;
      border-left: 4px solid #10B981;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-box h3 {
      margin-top: 0;
      color: #10B981;
      font-size: 16px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .info-label {
      font-weight: bold;
      color: #6b7280;
    }
    .info-value {
      color: #1f2937;
    }
    .file-box {
      background: #f3f4f6;
      border: 2px dashed #d1d5db;
      padding: 20px;
      margin: 20px 0;
      border-radius: 8px;
      text-align: center;
    }
    .file-icon {
      font-size: 48px;
      margin-bottom: 10px;
    }
    .file-name {
      font-weight: bold;
      color: #1f2937;
      font-size: 14px;
      word-break: break-all;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 2px solid #e5e7eb;
      color: #6b7280;
      font-size: 12px;
    }
    .highlight {
      color: #10B981;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📧 Envio de XMLs - Adapta Fiscal</h1>
    </div>
    
    <div class="content">
      <p>Prezado(a),</p>
      
      <p>Segue em anexo o arquivo compactado contendo os XMLs de Notas Fiscais Eletrônicas do período solicitado.</p>
      
      <div class="info-box">
        <h3>📊 Dados da Empresa</h3>
        <div class="info-row">
          <span class="info-label">Razão Social:</span>
          <span class="info-value">${company.razaoSocial}</span>
        </div>
        ${company.nomeFantasia ? `
        <div class="info-row">
          <span class="info-label">Nome Fantasia:</span>
          <span class="info-value">${company.nomeFantasia}</span>
        </div>
        ` : ''}
        <div class="info-row">
          <span class="info-label">CNPJ:</span>
          <span class="info-value">${cnpjFormatado}</span>
        </div>
        ${company.inscricaoEstadual ? `
        <div class="info-row">
          <span class="info-label">Inscrição Estadual:</span>
          <span class="info-value">${company.inscricaoEstadual}</span>
        </div>
        ` : ''}
      </div>
      
      <div class="info-box">
        <h3>📅 Período dos XMLs</h3>
        <div class="info-row">
          <span class="info-label">Data Início:</span>
          <span class="info-value">${dtInicio}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Data Fim:</span>
          <span class="info-value">${dtFim}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Total de XMLs:</span>
          <span class="info-value highlight">${xmlCount} arquivo${xmlCount !== 1 ? 's' : ''}</span>
        </div>
        ${(inutCount > 0 || otherEventCount > 0) ? `
        <div class="info-row">
          <span class="info-label">Eventos (Cancelamentos/Correções):</span>
          <span class="info-value highlight">${otherEventCount} arquivo${otherEventCount !== 1 ? 's' : ''}</span>
        </div>
        ${inutCount > 0 ? `
        <div class="info-row">
          <span class="info-label">Inutilizações por intervalo:</span>
          <span class="info-value highlight">${inutCount} arquivo${inutCount !== 1 ? 's' : ''}</span>
        </div>
        ` : ''}
        ${otherEventCount > 0 ? `
        <div class="info-row">
          <span class="info-label">Outros eventos por data:</span>
          <span class="info-value highlight">${otherEventCount} arquivo${otherEventCount !== 1 ? 's' : ''}</span>
        </div>
        ` : ''}
        ` : ''}
      </div>
      
      <div class="file-box">
        <div class="file-icon">📦</div>
        <div class="file-name">${xmlZipFilename}</div>
        <p style="margin-top: 10px; color: #6b7280;">XMLs das notas fiscais (ZIP)</p>
      </div>
      ${eventZipFilename ? `
      <div class="file-box">
        <div class="file-icon">🗂️</div>
        <div class="file-name">${eventZipFilename}</div>
        <p style="margin-top: 10px; color: #6b7280;">Eventos fiscais (ZIP)</p>
      </div>
      ` : ''}
      
      <p style="margin-top: 20px;">
        <strong>Observações:</strong>
      </p>
      <ul style="color: #6b7280;">
        <li>Os XMLs foram compactados em formato ZIP para facilitar o download e transferência.</li>
        <li>Todos os arquivos foram validados pelo sistema Adapta Fiscal.</li>
        <li>Em caso de dúvidas, entre em contato conosco.</li>
      </ul>
      
      <div class="footer">
        <p><strong>Adapta Fiscal</strong> - Sistema de Gestão de Notas Fiscais</p>
        <p>Este é um email automático, por favor não responda.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Envia XMLs por email para contabilidade
 */
export async function sendXmlsByEmail(
  companyId: string,
  periodStart: string,
  periodEnd: string,
  destinationEmail: string
): Promise<XmlEmailResult> {
  let stage = "init";
  const setStage = (value: string) => {
    stage = value;
    console.log(`[XML Email] Etapa: ${value}`);
  };
  try {
    // 1. Busca a empresa
    setStage("load_company");
    const company = await storage.getCompanyById(companyId);
    if (!company) {
      throw new Error("Empresa não encontrada");
    }

    // 2. Busca XMLs do período
    setStage("load_xmls");
    const xmls = await storage.getXmlsByPeriod(companyId, periodStart, periodEnd);

    // 3. Busca eventos (filtrando por regras de período/numeração)
    setStage("load_events");
    const allEvents = await storage.getXmlEventsByCompany(companyId);
    const isWithinPeriod = (dateStr?: string | null) =>
      !!dateStr && dateStr >= periodStart && dateStr <= periodEnd;

    const allowedModels = new Set(
      xmls
        .map((xml) => (xml.tipoDoc === "NFe" ? "55" : xml.tipoDoc === "NFCe" ? "65" : null))
        .filter((model): model is string => !!model)
    );
    const matchesModel = (model?: string | null) =>
      allowedModels.size === 0 || !model || allowedModels.has(model);

    const numeros = xmls
      .map((xml) => Number.parseInt(xml.numeroNota || "", 10))
      .filter((numero) => Number.isFinite(numero) && numero > 0);
    const numeroMin = numeros.length > 0 ? Math.min(...numeros) : null;
    const numeroMax = numeros.length > 0 ? Math.max(...numeros) : null;

    const inutEvents = allEvents.filter((event) => {
      if (event.tipoEvento !== "inutilizacao") return false;
      if (!matchesModel(event.modelo)) return false;

      const inicio = Number.parseInt(event.numeroInicial || "", 10);
      const fim = Number.parseInt(event.numeroFinal || "", 10);
      if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return false;

      if (numeroMin === null || numeroMax === null) {
        return isWithinPeriod(event.dataEvento);
      }

      return fim >= numeroMin && inicio <= numeroMax;
    });

    const otherEvents = allEvents.filter((event) => {
      if (event.tipoEvento === "inutilizacao") return false;
      if (!matchesModel(event.modelo)) return false;
      return isWithinPeriod(event.dataEvento);
    });

    const events = [...otherEvents, ...inutEvents];

    if (xmls.length === 0 && events.length === 0) {
      throw new Error("Nenhum XML ou evento encontrado para o período informado");
    }

    // 4. Prepara lista de paths para XMLs e eventos
    setStage("prepare_paths");
    const xmlPaths = xmls.map((xml) => xml.filepath);

    // 5. Adiciona arquivos de eventos
    const eventPaths = events.map((event) => event.filepath);

    if (xmlPaths.length === 0 && eventPaths.length === 0) {
      throw new Error("Nenhum arquivo XML encontrado para o período informado");
    }

    // 4. Gera nomes dos arquivos ZIP
    setStage("prepare_zip_names");
    const xmlZipFilename = generateZipFilenameWithSuffix(company, periodStart, periodEnd, "notas");
    const xmlZipPath = path.join("/tmp", xmlZipFilename);
    const eventZipFilename = eventPaths.length > 0
      ? generateZipFilenameWithSuffix(company, periodStart, periodEnd, "eventos")
      : null;
    const eventZipPath = eventZipFilename ? path.join("/tmp", eventZipFilename) : null;

    // 5. Cria arquivos ZIP
    setStage("build_zip_entries");
    const xmlEntries = await buildZipEntries(xmlPaths);
    const eventEntries = await buildZipEntries(eventPaths);

    console.log(
      `[XML Email] Arquivos prontos: ${xmlEntries.length} notas, ${eventEntries.length} eventos`
    );

    if (xmlEntries.length === 0 && eventEntries.length === 0) {
      throw new Error("Nenhum arquivo XML válido encontrado no servidor");
    }

    if (xmlEntries.length > 0) {
      setStage("create_zip_xmls");
      await createZipFile(xmlEntries, xmlZipPath);
      console.log(`[XML Email] ZIP de notas criado: ${xmlZipFilename}`);
    }
    if (eventZipPath && eventEntries.length > 0) {
      setStage("create_zip_events");
      await createZipFile(eventEntries, eventZipPath);
      console.log(`[XML Email] ZIP de eventos criado: ${eventZipFilename}`);
    }

    // 6. Gera assunto e corpo do email
    setStage("prepare_email");
    const emailSubject = `${formatCnpj(company.cnpj)} - ${company.razaoSocial}`;
    const emailBody = generateEmailTemplate(
      company,
      periodStart,
      periodEnd,
      xmls.length,
      events.length,
      inutEvents.length,
      otherEvents.length,
      xmlZipFilename,
      eventZipFilename
    );

    // 7. Envia o email
    const attachments = [];
    if (xmlEntries.length > 0) {
      attachments.push({
        filename: xmlZipFilename,
        path: xmlZipPath,
      });
    }
    if (eventZipPath && eventZipFilename && eventEntries.length > 0) {
      attachments.push({
        filename: eventZipFilename,
        path: eventZipPath,
      });
    }

    setStage("send_email");
    const globalEmailSettings = await storage.getEmailGlobalSettings();
    const sendResult = await sendEmailWithFallback(company, {
      to: destinationEmail,
      subject: emailSubject,
      html: emailBody,
      attachments,
    }, globalEmailSettings);
    if (!sendResult.success) {
      throw new Error(sendResult.error || "Erro ao enviar email");
    }
    console.log(`[XML Email] Email enviado para ${destinationEmail} (id: ${sendResult.messageId || "n/a"})`);

    // 8. Remove arquivos ZIP temporários
    try {
      if (xmlEntries.length > 0) {
        await fs.unlink(xmlZipPath);
      }
      if (eventZipPath && eventEntries.length > 0) {
        await fs.unlink(eventZipPath);
      }
    } catch (err) {
      console.warn("Erro ao remover arquivo ZIP temporário:", err);
    }

    return {
      success: true,
      zipFilename: xmlZipFilename,
      xmlCount: xmls.length,
      emailSubject,
    };
  } catch (error: any) {
    console.error("Erro ao enviar XMLs por email:", error);
    const message = error?.message || "Erro desconhecido ao enviar email";
    const errorDetails = JSON.stringify({
      stage,
      message,
    });
    return {
      success: false,
      zipFilename: "",
      xmlCount: 0,
      emailSubject: "",
      error: message,
      errorDetails,
      errorStack: error?.stack,
    };
  }
}


