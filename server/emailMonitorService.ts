import imapSimple from 'imap-simple';
import { simpleParser } from 'mailparser';
import { storage } from './storage';
import { parseXmlContent, isValidNFeXml } from './xmlParser';
import { isValidEventXml, parseEventOrInutilizacao, type ParsedEventoData, type ParsedInutilizacaoData } from './xmlEventParser';
import { saveXmlToContabo, saveEventXmlToContabo } from './xmlStorageService';
import { getOrCreateCompanyByCnpj } from './utils/companyAutoCreate';
import type { EmailMonitor } from '@shared/schema';

interface CheckResult {
  success: boolean;
  message: string;
  emailsChecked: number;
  xmlsFound: number;
  xmlsProcessed: number;
  xmlsDuplicated: number;
  errors: Array<{
    stage: string;
    message: string;
    emailUid?: number;
    filename?: string;
  }>;
  details?: any;
}

/**
 * Verifica emails de um monitor específico e processa XMLs encontrados (NFe e eventos)
 */
export async function checkEmailMonitor(monitor: EmailMonitor, userId: string, triggeredBy: string = 'manual'): Promise<CheckResult> {
  const startTime = Date.now();
  const result: CheckResult = {
    success: false,
    message: '',
    emailsChecked: 0,
    xmlsFound: 0,
    xmlsProcessed: 0,
    xmlsDuplicated: 0,
    errors: [],
  };

  const addError = (stage: string, message: string, extra?: { emailUid?: number; filename?: string }) => {
    result.errors.push({
      stage,
      message,
      ...(extra || {}),
    });
  };

  const getFirstErrorSummary = () => {
    const first = result.errors[0];
    if (!first) return null;
    return `${first.stage}: ${first.message}`;
  };

  let connection: any = null;
  
  // Criar log inicial
  const checkLog = await storage.createEmailCheckLog({
    emailMonitorId: monitor.id,
    emailAddress: monitor.email,
    status: 'error', // Será atualizado para 'success' se tudo correr bem
    startedAt: new Date(),
    finishedAt: null,
    durationMs: null,
    emailsChecked: 0,
    xmlsFound: 0,
    xmlsProcessed: 0,
    xmlsDuplicated: 0,
    errorMessage: null,
    errorDetails: null,
    triggeredBy,
  });

  try {
    console.log(`\n[IMAP Monitor] 📧 Iniciando verificação do monitor: ${monitor.email}`);
    console.log(`[IMAP Monitor] 📅 Monitorar desde: ${monitor.monitorSince || 'Todos os emails'}`);

    // 1. Configurar conexão IMAP
    const config = {
      imap: {
        user: monitor.email,
        password: monitor.password,
        host: monitor.host,
        port: monitor.port,
        tls: monitor.ssl,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000,
      }
    };

    // 2. Conectar ao servidor IMAP
    console.log(`[IMAP Monitor] 🔌 Conectando a ${monitor.host}:${monitor.port}...`);
    connection = await imapSimple.connect(config);
    console.log(`[IMAP Monitor] ✅ Conectado com sucesso!`);

    // 3. Abrir caixa de entrada
    await connection.openBox('INBOX');
    console.log(`[IMAP Monitor] 📬 Caixa INBOX aberta`);

    // 4. Construir critérios de busca
    const searchCriteria: any[] = ['ALL'];
    
    // Filtrar por data se configurado
    if (monitor.monitorSince) {
      const sinceDate = new Date(monitor.monitorSince);
      searchCriteria.push(['SINCE', sinceDate]);
      console.log(`[IMAP Monitor] 📅 Filtrando emails desde: ${sinceDate.toISOString()}`);
    }

    // Buscar apenas emails com anexos
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      markSeen: false, // Não marcar como lido
      struct: true,
    };

    // 5. Buscar emails
    console.log(`[IMAP Monitor] 🔍 Buscando emails...`);
    const messages = await connection.search(searchCriteria, fetchOptions);
    
    result.emailsChecked = messages.length;
    console.log(`[IMAP Monitor] 📨 Encontrados ${messages.length} email(s)`);

    if (messages.length === 0) {
      result.success = true;
      result.message = 'Nenhum email novo encontrado';

      const duration = Date.now() - startTime;
      await storage.updateEmailCheckLog(checkLog.id, {
        status: 'success',
        finishedAt: new Date(),
        durationMs: duration,
        emailsChecked: result.emailsChecked,
        xmlsFound: result.xmlsFound,
        xmlsProcessed: result.xmlsProcessed,
        xmlsDuplicated: result.xmlsDuplicated,
        errorMessage: null,
        errorDetails: null,
      });

      return result;
    }

    // 6. Processar cada email
    for (const message of messages) {
      let emailUid: number | undefined;
      try {
        emailUid = message.attributes.uid;
        
        // Verificar se já processamos este email
        if (monitor.lastEmailId && emailUid <= parseInt(monitor.lastEmailId)) {
          console.log(`[IMAP Monitor] ⏭️ Email UID ${emailUid} já processado, pulando...`);
          continue;
        }

        // Parsear email
        const all = message.parts.find((part: any) => part.which === '');
        if (!all || !all.body) {
          continue;
        }

        const parsed = await simpleParser(all.body);
        
        // Verificar se tem anexos
        if (!parsed.attachments || parsed.attachments.length === 0) {
          continue;
        }

        // 7. Processar anexos XML
        for (const attachment of parsed.attachments) {
          const filename = attachment.filename?.toLowerCase() || '';
          
          // Verificar se é arquivo XML
          if (!filename.endsWith('.xml')) {
            continue;
          }

          result.xmlsFound++;
          
          try {
            const xmlContent = attachment.content.toString('utf-8');
            
            const isNfeXml = isValidNFeXml(xmlContent);
            const isEventXml = !isNfeXml && isValidEventXml(xmlContent);
            
            if (!isNfeXml && !isEventXml) {
              console.log(`[IMAP Monitor] ⚠️ Arquivo ${filename} não é um XML válido de NFe/NFCe ou Evento`);
              addError("xml-validate", "Não é XML de NFe/NFCe ou Evento", { filename, emailUid });
              continue;
            }

            if (isEventXml) {
              const parsedEvent = await parseEventOrInutilizacao(xmlContent);
              const eventCnpj = parsedEvent.cnpj;
              const company = await storage.getCompanyByCnpj(eventCnpj);
              if (!company) {
                addError("company", `Empresa com CNPJ ${eventCnpj} não encontrada`, { filename, emailUid });
                continue;
              }

              if (parsedEvent.tipo === "evento") {
                const eventoData = parsedEvent as ParsedEventoData;
                const duplicate = await storage.getDuplicateXmlEventForEvento({
                  companyId: company.id,
                  chaveNFe: eventoData.chaveNFe,
                  tipoEvento: eventoData.tipoEvento,
                  numeroSequencia: eventoData.numeroSequencia ?? null,
                  protocolo: eventoData.protocolo ?? null,
                  dataEvento: eventoData.dataEvento ?? null,
                  horaEvento: eventoData.horaEvento ?? null,
                });
                if (duplicate) {
                  result.xmlsDuplicated++;
                  continue;
                }

                const saveResult = await saveEventXmlToContabo(xmlContent, parsedEvent);
                if (!saveResult.success) {
                  addError(
                    "storage",
                    `Erro ao salvar evento no Contabo Storage - ${saveResult.error || 'Erro desconhecido'}`,
                    { filename, emailUid }
                  );
                  continue;
                }

                const xml = await storage.getXmlByChave(eventoData.chaveNFe);

                await storage.createXmlEvent({
                  companyId: company.id,
                  chaveNFe: eventoData.chaveNFe,
                  xmlId: xml?.id || null,
                  tipoEvento: eventoData.tipoEvento,
                  codigoEvento: eventoData.codigoEvento,
                  dataEvento: eventoData.dataEvento,
                  horaEvento: eventoData.horaEvento,
                  numeroSequencia: eventoData.numeroSequencia,
                  protocolo: eventoData.protocolo,
                  justificativa: eventoData.justificativa || null,
                  correcao: eventoData.correcao || null,
                  ano: null,
                  serie: null,
                  numeroInicial: null,
                  numeroFinal: null,
                  cnpj: eventoData.cnpj,
                  modelo: eventoData.modelo,
                  filepath: saveResult.filepath || "",
                });

                if (eventoData.tipoEvento === "cancelamento" && xml) {
                  await storage.updateXml(xml.id, { dataCancelamento: eventoData.dataEvento });
                }
              } else {
                const inutData = parsedEvent as ParsedInutilizacaoData;
                const duplicate = await storage.getDuplicateXmlEventForInutilizacao({
                  companyId: company.id,
                  modelo: inutData.modelo,
                  serie: inutData.serie,
                  numeroInicial: inutData.numeroInicial,
                  numeroFinal: inutData.numeroFinal,
                  protocolo: inutData.protocolo ?? null,
                  dataEvento: inutData.dataEvento ?? null,
                  horaEvento: inutData.horaEvento ?? null,
                });
                if (duplicate) {
                  result.xmlsDuplicated++;
                  continue;
                }

                const saveResult = await saveEventXmlToContabo(xmlContent, parsedEvent);
                if (!saveResult.success) {
                  addError(
                    "storage",
                    `Erro ao salvar inutilização no Contabo Storage - ${saveResult.error || 'Erro desconhecido'}`,
                    { filename, emailUid }
                  );
                  continue;
                }

                await storage.createXmlEvent({
                  companyId: company.id,
                  chaveNFe: null,
                  xmlId: null,
                  tipoEvento: "inutilizacao",
                  codigoEvento: null,
                  dataEvento: inutData.dataEvento,
                  horaEvento: inutData.horaEvento,
                  numeroSequencia: null,
                  protocolo: inutData.protocolo,
                  justificativa: inutData.justificativa,
                  correcao: null,
                  ano: inutData.ano,
                  serie: inutData.serie,
                  numeroInicial: inutData.numeroInicial,
                  numeroFinal: inutData.numeroFinal,
                  cnpj: inutData.cnpj,
                  modelo: inutData.modelo,
                  filepath: saveResult.filepath || "",
                });
              }

              result.xmlsProcessed++;
              continue;
            }

            // Parsear XML de NFe/NFCe
            const parsedXml = await parseXmlContent(xmlContent);
            
            // Verificar duplicata pela chave
            const existingXml = await storage.getXmlByChave(parsedXml.chave);
            if (existingXml) {
              console.log(`[IMAP Monitor] 📋 XML já existe: ${parsedXml.chave.substring(0, 15)}...`);
              result.xmlsDuplicated++;
              continue;
            }

            // Buscar ou criar empresa pelo CNPJ do emitente
            await getOrCreateCompanyByCnpj(
              parsedXml.cnpjEmitente,
              parsedXml,
              userId
            );

            // Determinar categoria (emitida ou recebida)
            const userCompanies = await storage.getCompaniesByUser(userId);
            const userCnpjs = new Set(userCompanies.map(c => c.cnpj));
            
            let categoria: "emitida" | "recebida";
            if (userCnpjs.has(parsedXml.cnpjEmitente)) {
              categoria = "emitida";
            } else if (parsedXml.cnpjDestinatario && userCnpjs.has(parsedXml.cnpjDestinatario)) {
              categoria = "recebida";
            } else {
              categoria = "emitida"; // Padrão
            }

            // Salvar XML no Contabo Storage
            const saveResult = await saveXmlToContabo(xmlContent, parsedXml);
          if (!saveResult.success) {
            addError(
              "storage",
              `Erro ao salvar no Contabo Storage - ${saveResult.error || 'Erro desconhecido'}`,
              { filename, emailUid }
            );
              continue;
            }

            // Salvar no banco de dados
            await storage.createXml({
              companyId: null,
              chave: parsedXml.chave,
              numeroNota: parsedXml.numeroNota || null,
              tipoDoc: parsedXml.tipoDoc,
              dataEmissao: parsedXml.dataEmissao,
              hora: parsedXml.hora || "00:00:00",
              cnpjEmitente: parsedXml.cnpjEmitente,
              cnpjDestinatario: parsedXml.cnpjDestinatario || null,
              razaoSocialDestinatario: parsedXml.razaoSocialDestinatario || null,
              totalNota: parsedXml.totalNota.toString(),
              totalImpostos: parsedXml.totalImpostos.toString(),
              categoria,
              statusValidacao: "valido",
              filepath: saveResult.filepath || "",
            });

            console.log(`[IMAP Monitor] ✅ XML processado: ${parsedXml.chave.substring(0, 15)}... (${parsedXml.numeroNota || 'S/N'})`);
            result.xmlsProcessed++;

        } catch (xmlError) {
          const errorMsg = xmlError instanceof Error ? xmlError.message : 'Erro desconhecido';
          console.error(`[IMAP Monitor] ❌ Erro ao processar XML ${filename}:`, errorMsg);
          addError("xml-process", errorMsg, { filename, emailUid });
          }
        }

        // Atualizar last_email_id para este UID
        await storage.updateEmailMonitor(monitor.id, {
          lastEmailId: emailUid.toString(),
        });

    } catch (emailError) {
        const errorMsg = emailError instanceof Error ? emailError.message : 'Erro desconhecido';
        console.error(`[IMAP Monitor] ⚠️ Erro ao processar email:`, errorMsg);
      addError("email", errorMsg, { emailUid });
      }
    }

    // 8. Atualizar last_checked_at
    await storage.updateEmailMonitorLastCheck(monitor.id);

    // 9. Resultado final
    result.success = true;
    const duration = Date.now() - startTime;
    
    result.message = `Verificação concluída em ${(duration / 1000).toFixed(1)}s: ` +
                    `${result.emailsChecked} email(s) verificado(s), ` +
                    `${result.xmlsFound} XML(s) encontrado(s), ` +
                    `${result.xmlsProcessed} processado(s), ` +
                    `${result.xmlsDuplicated} duplicado(s)`;

    console.log(`[IMAP Monitor] ✅ ${result.message}`);
    
    if (result.errors.length > 0) {
      console.log(`[IMAP Monitor] ⚠️ ${result.errors.length} erro(s) durante processamento`);
    }

    // Atualizar log com sucesso
    await storage.updateEmailCheckLog(checkLog.id, {
      status: 'success',
      finishedAt: new Date(),
      durationMs: duration,
      emailsChecked: result.emailsChecked,
      xmlsFound: result.xmlsFound,
      xmlsProcessed: result.xmlsProcessed,
      xmlsDuplicated: result.xmlsDuplicated,
      errorMessage: result.errors.length > 0 ? getFirstErrorSummary() : null,
      errorDetails: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
    });

    return result;

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[IMAP Monitor] ❌ Erro na verificação:`, errorMsg);
    
    result.success = false;
    result.message = `Erro ao verificar emails: ${errorMsg}`;
    addError("monitor", errorMsg);
    
    // Atualizar log com erro
    const duration = Date.now() - startTime;
    await storage.updateEmailCheckLog(checkLog.id, {
      status: 'error',
      finishedAt: new Date(),
      durationMs: duration,
      emailsChecked: result.emailsChecked,
      xmlsFound: result.xmlsFound,
      xmlsProcessed: result.xmlsProcessed,
      xmlsDuplicated: result.xmlsDuplicated,
      errorMessage: errorMsg,
      errorDetails: JSON.stringify(result.errors),
    });
    
    return result;

  } finally {
    // Fechar conexão
    if (connection) {
      try {
        connection.end();
        console.log(`[IMAP Monitor] 🔌 Conexão IMAP fechada`);
      } catch (e) {
        console.error(`[IMAP Monitor] ⚠️ Erro ao fechar conexão:`, e);
      }
    }
  }
}

/**
 * Verifica todos os monitores ativos
 */
export async function checkAllActiveMonitors(userId: string, triggeredBy: string = 'cron'): Promise<{
  totalMonitors: number;
  executed: number;
  skipped: number;
  successful: number;
  failed: number;
  results: CheckResult[];
}> {
  console.log(`\n[IMAP Monitor] 🚀 Iniciando verificação de todos os monitores ativos`);
  
  const activeMonitors = await storage.getAllActiveEmailMonitors();
  
  console.log(`[IMAP Monitor] 📊 Encontrados ${activeMonitors.length} monitor(es) ativo(s)`);
  
  const results: CheckResult[] = [];
  let successful = 0;
  let failed = 0;
  let skipped = 0;
  let executed = 0;

  for (const monitor of activeMonitors) {
    // Verificar se já passou o intervalo configurado
    if (monitor.lastCheckedAt) {
      const lastCheck = new Date(monitor.lastCheckedAt);
      const now = new Date();
      const minutesSinceCheck = (now.getTime() - lastCheck.getTime()) / (1000 * 60);
      
      if (minutesSinceCheck < monitor.checkIntervalMinutes) {
        console.log(`[IMAP Monitor] ⏭️ Monitor ${monitor.email} ainda não precisa verificar (última: ${minutesSinceCheck.toFixed(1)}min atrás)`);
        skipped++;
        continue;
      }
    }

    const result = await checkEmailMonitor(monitor, userId, triggeredBy);
    results.push(result);
    executed++;
    
    if (result.success) {
      successful++;
    } else {
      failed++;
    }
  }

  console.log(`\n[IMAP Monitor] 🏁 Verificação concluída: ${successful} sucesso, ${failed} falhas`);
  
  return {
    totalMonitors: activeMonitors.length,
    executed,
    skipped,
    successful,
    failed,
    results,
  };
}





