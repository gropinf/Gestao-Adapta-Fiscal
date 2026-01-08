import archiver from "archiver";
import * as fs from "fs/promises";
import * as path from "path";
import { sendEmail } from "./emailService";
import { storage } from "./storage";
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

/**
 * Cria arquivo ZIP com os XMLs
 */
async function createZipFile(
  xmlPaths: string[],
  outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = require("fs").createWriteStream(outputPath);
    const archive = archiver("zip", {
      zlib: { level: 9 } // Máxima compressão
    });

    output.on("close", () => {
      console.log(`ZIP criado: ${archive.pointer()} bytes`);
      resolve();
    });

    archive.on("error", (err: Error) => {
      reject(err);
    });

    archive.pipe(output);

    // Adiciona cada XML ao arquivo
    for (const xmlPath of xmlPaths) {
      const filename = path.basename(xmlPath);
      archive.file(xmlPath, { name: filename });
    }

    archive.finalize();
  });
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
  zipFilename: string
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
        ${eventCount > 0 ? `
        <div class="info-row">
          <span class="info-label">Eventos (Cancelamentos/Correções):</span>
          <span class="info-value highlight">${eventCount} arquivo${eventCount !== 1 ? 's' : ''}</span>
        </div>
        ` : ''}
      </div>
      
      <div class="file-box">
        <div class="file-icon">📦</div>
        <div class="file-name">${zipFilename}</div>
        <p style="margin-top: 10px; color: #6b7280;">Arquivo em anexo</p>
      </div>
      
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
  try {
    // 1. Busca a empresa
    const company = await storage.getCompanyById(companyId);
    if (!company) {
      throw new Error("Empresa não encontrada");
    }

    // 2. Busca XMLs do período
    const xmls = await storage.getXmlsByPeriod(companyId, periodStart, periodEnd);
    
    // 3. Busca eventos do período (cancelamentos, cartas de correção, inutilizações)
    const events = await storage.getXmlEventsByPeriod(companyId, periodStart, periodEnd);
    
    if (xmls.length === 0 && events.length === 0) {
      throw new Error("Nenhum XML ou evento encontrado para o período informado");
    }

    // 4. Valida que os arquivos XML existem e prepara paths
    // Nota: Para arquivos no Contabo, não podemos usar path.resolve
    // O serviço de email precisa receber os filepaths diretamente
    const xmlPaths: string[] = [];
    for (const xml of xmls) {
      // Se for URL do Contabo, usa diretamente; se for local, resolve o path
      if (xml.filepath.startsWith('http://') || xml.filepath.startsWith('https://')) {
        // É URL do Contabo - não precisa verificar acesso, será baixado pelo serviço
        xmlPaths.push(xml.filepath);
      } else {
        // É caminho local - verifica se existe
        const xmlPath = path.resolve(xml.filepath);
        try {
          await fs.access(xmlPath);
          xmlPaths.push(xmlPath);
        } catch {
          console.warn(`Arquivo XML não encontrado: ${xmlPath}`);
        }
      }
    }

    // 5. Adiciona arquivos de eventos
    for (const event of events) {
      if (event.filepath.startsWith('http://') || event.filepath.startsWith('https://')) {
        // É URL do Contabo
        xmlPaths.push(event.filepath);
      } else {
        // É caminho local
        const eventPath = path.resolve(event.filepath);
        try {
          await fs.access(eventPath);
          xmlPaths.push(eventPath);
        } catch {
          console.warn(`Arquivo de evento não encontrado: ${eventPath}`);
        }
      }
    }

    if (xmlPaths.length === 0) {
      throw new Error("Nenhum arquivo XML válido encontrado no servidor");
    }

    // 4. Gera nome do arquivo ZIP
    const zipFilename = generateZipFilename(company, periodStart, periodEnd);
    const zipPath = path.join("/tmp", zipFilename);

    // 5. Cria arquivo ZIP
    await createZipFile(xmlPaths, zipPath);

    // 6. Gera assunto e corpo do email
    const emailSubject = `${formatCnpj(company.cnpj)} - ${company.razaoSocial}`;
    const emailBody = generateEmailTemplate(
      company,
      periodStart,
      periodEnd,
      xmls.length,
      events.length,
      zipFilename
    );

    // 7. Envia o email
    await sendEmail({
      to: destinationEmail,
      subject: emailSubject,
      html: emailBody,
      attachments: [
        {
          filename: zipFilename,
          path: zipPath,
        },
      ],
    });

    // 8. Remove arquivo ZIP temporário
    try {
      await fs.unlink(zipPath);
    } catch (err) {
      console.warn("Erro ao remover arquivo ZIP temporário:", err);
    }

    return {
      success: true,
      zipFilename,
      xmlCount: xmlPaths.length,
      emailSubject,
    };
  } catch (error: any) {
    console.error("Erro ao enviar XMLs por email:", error);
    return {
      success: false,
      zipFilename: "",
      xmlCount: 0,
      emailSubject: "",
      error: error.message || "Erro desconhecido ao enviar email",
    };
  }
}


