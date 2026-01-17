/**
 * Utilidades para criação automática de empresas a partir de XMLs
 * Quando um XML é processado e o CNPJ não está cadastrado, cria empresa automaticamente
 */

import { storage } from "../storage";
import { sendPublicEmail } from "../emailService";
import type { ParsedXmlData } from "../xmlParser";

/**
 * Formata CNPJ para exibição
 */
function formatCNPJ(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/**
 * Sanitiza telefone para garantir que não exceda 20 caracteres
 */
function sanitizeTelefone(telefone: string | null | undefined): string | undefined {
  if (!telefone) return undefined;
  // Remove espaços extras e limita a 20 caracteres
  const cleaned = telefone.trim();
  return cleaned.length > 20 ? cleaned.substring(0, 20) : cleaned;
}

/**
 * Cria empresa automaticamente a partir dos dados do XML
 * Empresa é criada com status "Aguardando Liberação"
 * Admin é notificado por email
 * @param xmlData - Dados do XML processado
 * @param userId - ID do usuário que fez o upload (será vinculado automaticamente)
 */
export async function createCompanyFromXml(xmlData: ParsedXmlData, userId?: string): Promise<string> {
  try {
    console.log(`[AUTO-CREATE] Criando empresa automaticamente para CNPJ: ${xmlData.cnpjEmitente}`);

    // Cria empresa com dados do emitente
    const company = await storage.createCompany({
      cnpj: xmlData.cnpjEmitente,
      razaoSocial: xmlData.razaoSocialEmitente || "Empresa (Aguardando Atualização)",
      nomeFantasia: xmlData.razaoSocialEmitente || undefined,
      inscricaoEstadual: xmlData.inscricaoEstadualEmitente || undefined,
      crt: xmlData.crtEmitente || undefined,
      telefone: sanitizeTelefone(xmlData.telefoneEmitente),
      email: xmlData.emailEmitente || undefined,
      // Status: 1 = Aguardando Liberação
      status: 1,
      ativo: true,
      // Endereço do emitente (se disponível)
      rua: xmlData.enderecoEmitente?.rua,
      numero: xmlData.enderecoEmitente?.numero,
      bairro: xmlData.enderecoEmitente?.bairro,
      cidade: xmlData.enderecoEmitente?.cidade,
      uf: xmlData.enderecoEmitente?.uf,
      cep: xmlData.enderecoEmitente?.cep,
    });

    console.log(`[AUTO-CREATE] ✅ Empresa criada com sucesso: ${company.id} - ${company.razaoSocial}`);

    // Vincula o usuário que fez o upload à empresa criada
    if (userId) {
      try {
        await storage.addUserToCompany(userId, company.id);
        console.log(`[AUTO-CREATE] ✅ Usuário ${userId} vinculado à empresa ${company.id}`);
      } catch (linkError) {
        console.error(`[AUTO-CREATE] ⚠️ Erro ao vincular usuário à empresa:`, linkError);
        // Não propaga o erro - a empresa foi criada com sucesso
      }
    }

    // Notifica admin (assíncrono, não bloqueia)
    notifyAdminNewCompany(company, xmlData).catch(err => {
      console.error("[AUTO-CREATE] Erro ao notificar admin:", err);
    });

    return company.id;
  } catch (error) {
    console.error("[AUTO-CREATE] ❌ Erro ao criar empresa automaticamente:", error);
    throw new Error("Falha ao criar empresa automaticamente: " + (error instanceof Error ? error.message : "Erro desconhecido"));
  }
}

/**
 * Notifica administrador sobre criação automática de empresa
 */
async function notifyAdminNewCompany(company: any, xmlData: ParsedXmlData): Promise<void> {
  try {
    // Busca todos admins
    const admins = await storage.getUsersByRole("admin");
    
    if (admins.length === 0) {
      console.warn("[AUTO-CREATE] Nenhum admin encontrado para notificar");
      return;
    }

    const emailSubject = `[Adapta Fiscal] Nova Empresa Criada Automaticamente`;
    
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">🏢 Nova Empresa Criada</h1>
        </div>
        
        <div style="padding: 30px; background: #f9fafb;">
          <h2 style="color: #1f2937; margin-top: 0;">Criação Automática via Upload de XML</h2>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10B981;">
            <h3 style="margin-top: 0; color: #059669;">Dados da Empresa</h3>
            <p><strong>CNPJ:</strong> ${formatCNPJ(company.cnpj)}</p>
            <p><strong>Razão Social:</strong> ${company.razaoSocial}</p>
            <p><strong>Nome Fantasia:</strong> ${company.nomeFantasia || "Não informado"}</p>
            <p><strong>Status:</strong> <span style="color: #f59e0b; font-weight: bold;">Aguardando Liberação</span></p>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Endereço</h3>
            <p>${company.rua || "Não informado"}, ${company.numero || "S/N"}</p>
            <p>${company.bairro || ""} - ${company.cidade || ""} / ${company.uf || ""}</p>
            <p>CEP: ${company.cep || "Não informado"}</p>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Origem: XML Processado</h3>
            <p><strong>Chave:</strong> ${xmlData.chave}</p>
            <p><strong>Tipo:</strong> ${xmlData.tipoDoc}</p>
            <p><strong>Data Emissão:</strong> ${xmlData.dataEmissao} ${xmlData.hora || ""}</p>
            <p><strong>Valor Total:</strong> R$ ${xmlData.totalNota.toFixed(2)}</p>
          </div>
          
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0;"><strong>⚠️ Ação Necessária:</strong></p>
            <p style="margin: 10px 0 0 0;">Esta empresa foi criada automaticamente e está com status <strong>"Aguardando Liberação"</strong>. Acesse o sistema para revisar os dados e liberar a empresa.</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.APP_URL || 'http://localhost:5000'}/clientes" 
               style="display: inline-block; background: #10B981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Acessar Sistema
            </a>
          </div>
        </div>
        
        <div style="background: #1f2937; padding: 20px; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">Adapta Fiscal - Sistema de Gestão de XMLs</p>
          <p style="margin: 5px 0 0 0;">Notificação automática - Não responda este email</p>
        </div>
      </div>
    `;

    const globalEmailSettings = await storage.getEmailGlobalSettings();

    // Envia email para todos admins
    for (const admin of admins) {
      try {
        // Usa configuração de email padrão do sistema (não da empresa)
        await sendPublicEmail({
          to: admin.email,
          subject: emailSubject,
          html: emailBody,
        }, globalEmailSettings);
        
        console.log(`[AUTO-CREATE] ✉️ Notificação enviada para admin: ${admin.email}`);
      } catch (emailError) {
        console.error(`[AUTO-CREATE] Erro ao enviar email para ${admin.email}:`, emailError);
      }
    }
  } catch (error) {
    console.error("[AUTO-CREATE] Erro ao notificar admins:", error);
    // Não propaga erro - notificação é secundária
  }
}

/**
 * Busca empresa por CNPJ
 * Se não encontrar, cria automaticamente
 * 
 * @param cnpj - CNPJ da empresa
 * @param xmlData - Dados do XML processado
 * @param userId - ID do usuário que fez o upload (opcional)
 * @returns { company, wasCreated }
 */
export async function getOrCreateCompanyByCnpj(
  cnpj: string, 
  xmlData: ParsedXmlData,
  userId?: string
): Promise<{ company: any; wasCreated: boolean }> {
  // Busca empresa existente
  const existingCompany = await storage.getCompanyByCnpj(cnpj);
  
  if (existingCompany) {
    return { company: existingCompany, wasCreated: false };
  }

  // Empresa não existe - criar automaticamente
  const newCompanyId = await createCompanyFromXml(xmlData, userId);
  const newCompany = await storage.getCompany(newCompanyId);
  
  if (!newCompany) {
    throw new Error("Erro ao buscar empresa recém-criada");
  }

  return { company: newCompany, wasCreated: true };
}



