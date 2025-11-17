import nodemailer from "nodemailer";
import type { Company } from "@shared/schema";

/**
 * Interface para configuração de email
 */
export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean; // true para SSL (porta 465), false para TLS (porta 587)
  auth: {
    user: string;
    pass: string;
  };
}

/**
 * Interface para dados de email
 */
export interface EmailData {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer | string;
  }>;
}

/**
 * Cria um transporter do Nodemailer baseado na config da empresa
 */
export function createTransporter(config: EmailConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });
}

/**
 * Cria transporter a partir dos dados da empresa
 */
export function createTransporterFromCompany(company: Company) {
  if (!company.emailHost || !company.emailUser || !company.emailPassword) {
    throw new Error("Configuração de email incompleta para esta empresa");
  }

  return createTransporter({
    host: company.emailHost,
    port: company.emailPort || 587,
    secure: company.emailSsl ?? true,
    auth: {
      user: company.emailUser,
      pass: company.emailPassword,
    },
  });
}

/**
 * Envia um email usando a configuração da empresa
 */
export async function sendEmail(
  company: Company,
  emailData: EmailData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = createTransporterFromCompany(company);

    const info = await transporter.sendMail({
      from: `"${company.razaoSocial}" <${company.emailUser}>`,
      to: Array.isArray(emailData.to) ? emailData.to.join(", ") : emailData.to,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html,
      attachments: emailData.attachments,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error("Erro ao enviar email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao enviar email",
    };
  }
}

/**
 * Verifica se a configuração de email da empresa está completa
 */
export function hasEmailConfig(company: Company): boolean {
  return !!(
    company.emailHost &&
    company.emailPort &&
    company.emailUser &&
    company.emailPassword
  );
}

/**
 * Testa a conexão de email da empresa
 */
export async function testEmailConnection(company: Company): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const transporter = createTransporterFromCompany(company);
    await transporter.verify();
    
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erro ao testar conexão",
    };
  }
}

// ============= TEMPLATES DE EMAIL =============

/**
 * Template HTML base para emails
 */
function getEmailTemplate(content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          color: white;
          padding: 30px;
          border-radius: 12px 12px 0 0;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 700;
        }
        .content {
          background: #ffffff;
          padding: 30px;
          border: 1px solid #e5e7eb;
          border-top: none;
        }
        .footer {
          background: #f9fafb;
          padding: 20px;
          border-radius: 0 0 12px 12px;
          text-align: center;
          font-size: 12px;
          color: #6b7280;
          border: 1px solid #e5e7eb;
          border-top: none;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background: #10B981;
          color: white;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          margin: 15px 0;
        }
        .info-box {
          background: #f0fdf4;
          border-left: 4px solid #10B981;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .warning-box {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📄 Adapta Fiscal</h1>
        <p style="margin: 5px 0 0 0; opacity: 0.9;">Gestão de Documentos Fiscais</p>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        <p style="margin: 0;">
          Este é um email automático do sistema Adapta Fiscal.<br>
          Por favor, não responda este email.
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Template: Envio de XMLs para contador
 */
export function getXmlEmailTemplate(data: {
  companyName: string;
  xmlCount: number;
  period?: string;
}): { subject: string; html: string; text: string } {
  const subject = `Documentos Fiscais - ${data.companyName}`;
  
  const html = getEmailTemplate(`
    <h2 style="margin-top: 0; color: #111827;">Documentos Fiscais Anexados</h2>
    
    <p>Prezado(a) Contador(a),</p>
    
    <p>Seguem em anexo <strong>${data.xmlCount} arquivo(s) XML</strong> de documentos fiscais 
    da empresa <strong>${data.companyName}</strong>.</p>
    
    ${data.period ? `
      <div class="info-box">
        <strong>📅 Período:</strong> ${data.period}
      </div>
    ` : ''}
    
    <div class="info-box">
      <strong>📦 Total de arquivos:</strong> ${data.xmlCount} XML(s)<br>
      <strong>🏢 Empresa:</strong> ${data.companyName}
    </div>
    
    <p>Os arquivos estão anexados neste email em formato ZIP para facilitar o download.</p>
    
    <p style="margin-top: 30px;">
      Atenciosamente,<br>
      <strong>Sistema Adapta Fiscal</strong>
    </p>
  `);

  const text = `
Documentos Fiscais - ${data.companyName}

Prezado(a) Contador(a),

Seguem em anexo ${data.xmlCount} arquivo(s) XML de documentos fiscais da empresa ${data.companyName}.

${data.period ? `Período: ${data.period}\n` : ''}

Total de arquivos: ${data.xmlCount} XML(s)
Empresa: ${data.companyName}

Os arquivos estão anexados neste email em formato ZIP.

Atenciosamente,
Sistema Adapta Fiscal
  `.trim();

  return { subject, html, text };
}

/**
 * Template: Email de teste de configuração
 */
export function getTestEmailTemplate(companyName: string): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = "Teste de Configuração de Email - Adapta Fiscal";

  const html = getEmailTemplate(`
    <h2 style="margin-top: 0; color: #111827;">✅ Configuração de Email Funcionando!</h2>
    
    <p>Olá,</p>
    
    <p>Este é um email de teste para confirmar que a configuração de email da empresa 
    <strong>${companyName}</strong> está funcionando corretamente.</p>
    
    <div class="info-box">
      <strong>✅ Status:</strong> Conexão estabelecida com sucesso!<br>
      <strong>📧 Sistema:</strong> Adapta Fiscal<br>
      <strong>🏢 Empresa:</strong> ${companyName}
    </div>
    
    <p>Você já pode utilizar o sistema para:</p>
    <ul>
      <li>Enviar XMLs para contadores</li>
      <li>Receber notificações automáticas</li>
      <li>Monitorar emails (se configurado)</li>
    </ul>
    
    <p style="margin-top: 30px;">
      Sistema Adapta Fiscal
    </p>
  `);

  const text = `
Teste de Configuração de Email - Adapta Fiscal

Olá,

Este é um email de teste para confirmar que a configuração de email da empresa ${companyName} está funcionando corretamente.

Status: Conexão estabelecida com sucesso!
Sistema: Adapta Fiscal
Empresa: ${companyName}

Você já pode utilizar o sistema para:
- Enviar XMLs para contadores
- Receber notificações automáticas
- Monitorar emails (se configurado)

Sistema Adapta Fiscal
  `.trim();

  return { subject, html, text };
}

/**
 * Template: Notificação de XMLs processados
 */
export function getNotificationEmailTemplate(data: {
  companyName: string;
  xmlCount: number;
  successCount: number;
  errorCount: number;
}): { subject: string; html: string; text: string } {
  const subject = `Processamento de XMLs Concluído - ${data.companyName}`;

  const html = getEmailTemplate(`
    <h2 style="margin-top: 0; color: #111827;">Processamento de XMLs Concluído</h2>
    
    <p>O processamento em lote de XMLs foi concluído para a empresa <strong>${data.companyName}</strong>.</p>
    
    <div class="info-box">
      <strong>📊 Resumo do Processamento:</strong><br><br>
      📥 Total de arquivos: ${data.xmlCount}<br>
      ✅ Processados com sucesso: ${data.successCount}<br>
      ${data.errorCount > 0 ? `❌ Com erro: ${data.errorCount}<br>` : ''}
    </div>
    
    ${data.errorCount > 0 ? `
      <div class="warning-box">
        <strong>⚠️ Atenção:</strong> Alguns arquivos apresentaram erros durante o processamento.
        Acesse o sistema para mais detalhes.
      </div>
    ` : ''}
    
    <p>Acesse o sistema para visualizar os documentos processados.</p>
    
    <p style="margin-top: 30px;">
      Sistema Adapta Fiscal
    </p>
  `);

  const text = `
Processamento de XMLs Concluído - ${data.companyName}

O processamento em lote de XMLs foi concluído.

Resumo:
- Total de arquivos: ${data.xmlCount}
- Processados com sucesso: ${data.successCount}
${data.errorCount > 0 ? `- Com erro: ${data.errorCount}` : ''}

${data.errorCount > 0 ? 'Alguns arquivos apresentaram erros. Acesse o sistema para detalhes.\n' : ''}

Sistema Adapta Fiscal
  `.trim();

  return { subject, html, text };
}












