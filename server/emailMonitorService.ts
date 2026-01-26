import imapSimple from 'imap-simple';
import unzipper from "unzipper";
import { simpleParser } from 'mailparser';
import { storage } from './storage';
import { parseXmlContent, isValidNFeXml, getNfeAuthorizationStatus } from './xmlParser';
import { isValidEventXml, parseEventOrInutilizacao, type ParsedEventoData, type ParsedInutilizacaoData } from './xmlEventParser';
import { saveXmlToContabo, saveEventXmlToContabo } from './xmlStorageService';
import { getOrCreateCompanyByCnpj } from './utils/companyAutoCreate';
import type { EmailMonitor, EmailCheckLog } from '@shared/schema';

interface CheckResult {
  success: boolean;
  message: string;
  monitorId?: string;
  monitorEmail?: string;
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
    monitorId: monitor.id,
    monitorEmail: monitor.email,
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

  let logUpdated = false;
  const updateCheckLogSafe = async (data: Partial<Omit<EmailCheckLog, "id" | "createdAt">>) => {
    try {
      await storage.updateEmailCheckLog(checkLog.id, data);
      logUpdated = true;
    } catch (logError) {
      console.error("[IMAP Monitor] ⚠️ Falha ao atualizar log:", logError);
    }
  };

  const processXmlContent = async (xmlContent: string, filename: string, emailUid?: number) => {
    let hadError = false;
    let processed = false;
    let duplicated = false;

    const isNfeXml = isValidNFeXml(xmlContent);
    const isEventXml = !isNfeXml && isValidEventXml(xmlContent);

    if (!isNfeXml && !isEventXml) {
      console.log(`[IMAP Monitor] ⚠️ Arquivo ${filename} não é um XML válido de NFe/NFCe ou Evento`);
      addError("xml-validate", "Não é XML de NFe/NFCe ou Evento", { filename, emailUid });
      return { hadError: true, processed, duplicated };
    }

    if (isEventXml) {
      const parsedEvent = await parseEventOrInutilizacao(xmlContent);
      const eventCnpj = parsedEvent.cnpj;
      const company = await storage.getCompanyByCnpj(eventCnpj);
      if (!company) {
        addError("company", `Empresa com CNPJ ${eventCnpj} não encontrada`, { filename, emailUid });
        return { hadError: true, processed, duplicated };
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
          return { hadError, processed, duplicated: true };
        }

        const saveResult = await saveEventXmlToContabo(xmlContent, parsedEvent);
        if (!saveResult.success) {
          addError(
            "storage",
            `Erro ao salvar evento no Contabo Storage - ${saveResult.error || 'Erro desconhecido'}`,
            { filename, emailUid }
          );
          return { hadError: true, processed, duplicated };
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

        return { hadError, processed: true, duplicated };
      }

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
        return { hadError, processed, duplicated: true };
      }

      const saveResult = await saveEventXmlToContabo(xmlContent, parsedEvent);
      if (!saveResult.success) {
        addError(
          "storage",
          `Erro ao salvar inutilização no Contabo Storage - ${saveResult.error || 'Erro desconhecido'}`,
          { filename, emailUid }
        );
        return { hadError: true, processed, duplicated };
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

      return { hadError, processed: true, duplicated };
    }

    const authorization = await getNfeAuthorizationStatus(xmlContent);
    if (!authorization.authorized) {
      const motivo = authorization.motivo || "XML não autorizado";
      const statusLabel = authorization.cStat ? `cStat ${authorization.cStat}` : "sem cStat";
      addError("sefaz", `${motivo} (${statusLabel})`, { filename, emailUid });
      return { hadError: true, processed, duplicated };
    }

    // Parsear XML de NFe/NFCe
    const parsedXml = await parseXmlContent(xmlContent);
    
    // Verificar duplicata pela chave
    const existingXml = await storage.getXmlByChave(parsedXml.chave);
    if (existingXml) {
      console.log(`[IMAP Monitor] 📋 XML já existe: ${parsedXml.chave.substring(0, 15)}...`);
      return { hadError, processed, duplicated: true };
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
      return { hadError: true, processed, duplicated };
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
    return { hadError, processed: true, duplicated };
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
    console.log(`[IMAP Monitor] 📅 Monitorar todos os emails (sem filtros)`);

    // 1. Configurar conexão IMAP
    const authTimeout = Number(process.env.IMAP_AUTH_TIMEOUT_MS || 30000);
    const connTimeout = Number(process.env.IMAP_CONN_TIMEOUT_MS || 30000);
    const config = {
      imap: {
        user: monitor.email,
        password: monitor.password,
        host: monitor.host,
        port: monitor.port,
        tls: monitor.ssl,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout,
        connTimeout,
      }
    };

    const ensureConnection = async () => {
      if (connection) {
        return;
      }
      console.log(`[IMAP Monitor] 🔌 Reabrindo conexão com ${monitor.host}:${monitor.port}...`);
      connection = await imapSimple.connect(config);
      await connection.openBox('INBOX');
      console.log(`[IMAP Monitor] ✅ Conexão reaberta e INBOX pronta`);
    };

    // 2. Conectar ao servidor IMAP
    console.log(`[IMAP Monitor] 🔌 Conectando a ${monitor.host}:${monitor.port}...`);
    try {
      connection = await imapSimple.connect(config);
      console.log(`[IMAP Monitor] ✅ Conectado com sucesso!`);
    } catch (connectError) {
      const errorMsg = connectError instanceof Error ? connectError.message : "Erro ao conectar IMAP";
      addError("imap-connect", errorMsg);
      throw connectError;
    }

    // 3. Abrir caixa de entrada
    try {
      await connection.openBox('INBOX');
      console.log(`[IMAP Monitor] 📬 Caixa INBOX aberta`);
    } catch (openError) {
      const errorMsg = openError instanceof Error ? openError.message : "Erro ao abrir INBOX";
      addError("imap-openbox", errorMsg);
      throw openError;
    }

    // 4. Construir critérios de busca (sem filtros)
    const searchTimeoutMs = Number(process.env.IMAP_SEARCH_TIMEOUT_MS || 30000);
    const batchSize = Number(
      process.env.IMAP_MAX_EMAILS_PER_RUN ||
      process.env.IMAP_MAX_EMAILS_PER_DAY ||
      100
    );

    const searchCriteria: any[] = ['ALL'];

    // Buscar apenas emails com anexos (filtramos após o download)
    const fetchOptions = {
      bodies: ['HEADER', 'TEXT', ''],
      markSeen: false, // Não marcar como lido
      struct: true,
    };

    // 5. Buscar emails (paginado por UID)
    console.log(`[IMAP Monitor] 🔍 Buscando emails...`);
    const searchStart = Date.now();
    let messages: any[];
    try {
      messages = await Promise.race([
        connection.search(searchCriteria, fetchOptions),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Timeout na busca de emails (${searchTimeoutMs} ms)`)),
            searchTimeoutMs
          )
        ),
      ]) as any[];
    } catch (searchError) {
      const errorMsg = searchError instanceof Error ? searchError.message : "Erro na busca de emails";
      addError("imap-search", errorMsg);
      throw searchError;
    }

    const elapsed = Date.now() - searchStart;
    console.log(`[IMAP Monitor] ✅ Busca concluída em ${elapsed} ms`);

    messages.sort((a, b) => (a?.attributes?.uid || 0) - (b?.attributes?.uid || 0));
    if (messages.length > batchSize) {
      console.log(`[IMAP Monitor] ⚠️ Limitando a ${batchSize} emails por execução`);
      messages = messages.slice(0, batchSize);
    }
    result.emailsChecked = messages.length;
    console.log(`[IMAP Monitor] 📨 Encontrados ${messages.length} email(s) no total`);

    const seenUids = await storage.getEmailMonitorSeenUids(monitor.id);
    const seenUidSet = new Set(seenUids.map((item) => item.emailUid));

    const markSeenUid = async (emailUid: number, reason: string) => {
      try {
        const uidStr = emailUid.toString();
        if (seenUidSet.has(uidStr)) {
          return;
        }
        await storage.addEmailMonitorSeenUid({
          emailMonitorId: monitor.id,
          emailUid: uidStr,
          reason,
        });
        seenUidSet.add(uidStr);
      } catch (error) {
        console.warn(`[IMAP Monitor] ⚠️ Falha ao registrar UID ${emailUid} (${reason}):`, error);
      }
    };

    if (messages.length === 0) {
      result.success = true;
      result.message = 'Nenhum email novo encontrado';

      const duration = Date.now() - startTime;
      await updateCheckLogSafe({
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
      let emailHadErrors = false;
      let emailXmlsFound = 0;
      let emailXmlsProcessed = 0;
      let emailXmlsDuplicated = 0;
      try {
        emailUid = message.attributes.uid;
        
        if (emailUid && seenUidSet.has(emailUid.toString())) {
          console.log(`[IMAP Monitor] ⏭️ Email UID ${emailUid} já registrado, pulando...`);
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
          if (emailUid) {
            await markSeenUid(emailUid, "no_xml");
          }
          continue;
        }

        const relevantAttachments = parsed.attachments.filter((attachment) => {
          const filename = attachment.filename?.toLowerCase() || '';
          const contentType = attachment.contentType?.toLowerCase() || '';
          return (
            filename.endsWith('.xml') ||
            filename.endsWith('.zip') ||
            contentType === "application/zip" ||
            contentType === "application/x-zip-compressed"
          );
        });

        if (relevantAttachments.length === 0) {
          if (emailUid) {
            await markSeenUid(emailUid, "no_xml");
          }
          continue;
        }

        const shouldCloseForProcessing =
          parsed.attachments.length > 1 ||
          relevantAttachments.some((attachment) => {
            const filename = attachment.filename?.toLowerCase() || '';
            const contentType = attachment.contentType?.toLowerCase() || '';
            return (
              filename.endsWith('.zip') ||
              contentType === "application/zip" ||
              contentType === "application/x-zip-compressed"
            );
          });

        if (shouldCloseForProcessing && connection) {
          try {
            connection.end();
          } catch (e) {
            console.warn(`[IMAP Monitor] ⚠️ Erro ao fechar conexão antes de processar:`, e);
          } finally {
            connection = null;
            console.log(`[IMAP Monitor] 🔌 Conexão fechada para processar anexos`);
          }
        }

        // 7. Processar anexos XML
        for (const attachment of relevantAttachments) {
          const filename = attachment.filename?.toLowerCase() || '';
          const contentType = attachment.contentType?.toLowerCase() || '';
          const isXmlAttachment = filename.endsWith('.xml');
          const isZipAttachment =
            filename.endsWith('.zip') ||
            contentType === "application/zip" ||
            contentType === "application/x-zip-compressed";

          if (!isXmlAttachment && !isZipAttachment) {
            continue;
          }

          if (isXmlAttachment) {
            emailXmlsFound++;
            result.xmlsFound++;

            try {
              const xmlContent = attachment.content.toString('utf-8');
              const { hadError, processed, duplicated } = await processXmlContent(xmlContent, filename, emailUid);
              if (hadError) emailHadErrors = true;
              if (processed) {
                result.xmlsProcessed++;
                emailXmlsProcessed++;
              }
              if (duplicated) {
                result.xmlsDuplicated++;
                emailXmlsDuplicated++;
              }
            } catch (xmlError) {
              const errorMsg = xmlError instanceof Error ? xmlError.message : 'Erro desconhecido';
              console.error(`[IMAP Monitor] ❌ Erro ao processar XML ${filename}:`, errorMsg);
              emailHadErrors = true;
              addError("xml-process", errorMsg, { filename, emailUid });
            }

            continue;
          }

          try {
            const zip = await unzipper.Open.buffer(attachment.content);
            let zipXmlFound = 0;

            for (const entry of zip.files) {
              if (entry.type !== "File") continue;
              const entryName = entry.path.toLowerCase();
              if (!entryName.endsWith(".xml")) continue;

              zipXmlFound++;
              emailXmlsFound++;
              result.xmlsFound++;

              try {
                const entryBuffer = await entry.buffer();
                const xmlContent = entryBuffer.toString("utf-8");
                const { hadError, processed, duplicated } = await processXmlContent(xmlContent, entry.path, emailUid);
                if (hadError) emailHadErrors = true;
                if (processed) {
                  result.xmlsProcessed++;
                  emailXmlsProcessed++;
                }
                if (duplicated) {
                  result.xmlsDuplicated++;
                  emailXmlsDuplicated++;
                }
              } catch (xmlError) {
                const errorMsg = xmlError instanceof Error ? xmlError.message : 'Erro desconhecido';
                console.error(`[IMAP Monitor] ❌ Erro ao processar XML do ZIP ${entry.path}:`, errorMsg);
                emailHadErrors = true;
                addError("zip-xml-process", errorMsg, { filename: entry.path, emailUid });
              }
            }

            if (zipXmlFound === 0) {
              addError("zip-extract", "Nenhum XML encontrado no arquivo ZIP", { filename, emailUid });
            }
          } catch (zipError) {
            const errorMsg = zipError instanceof Error ? zipError.message : 'Erro desconhecido';
            console.error(`[IMAP Monitor] ❌ Erro ao abrir ZIP ${filename}:`, errorMsg);
            emailHadErrors = true;
            addError("zip-extract", errorMsg, { filename, emailUid });
          }
        }

        if (monitor.deleteAfterProcess && emailUid) {
          const shouldDeleteEmail =
            !emailHadErrors && emailXmlsFound > 0 && (emailXmlsProcessed > 0 || emailXmlsDuplicated > 0);

          if (shouldDeleteEmail) {
            try {
              await ensureConnection();
              await connection.addFlags(emailUid, '\\Deleted');
              if (connection.imap?.expunge) {
                await new Promise<void>((resolve, reject) => {
                  connection.imap.expunge((err: Error | null) => {
                    if (err) {
                      reject(err);
                      return;
                    }
                    resolve();
                  });
                });
              }
              console.log(`[IMAP Monitor] 🗑️ Email UID ${emailUid} deletado após processamento`);
            } catch (deleteError) {
              const errorMsg = deleteError instanceof Error ? deleteError.message : "Erro ao deletar email";
              console.warn(`[IMAP Monitor] ⚠️ Falha ao deletar email UID ${emailUid}:`, deleteError);
              addError("imap-delete", errorMsg, { emailUid });
            }
          }
        }

        if (!monitor.deleteAfterProcess && emailUid) {
          const shouldMarkSeen =
            !emailHadErrors && emailXmlsFound > 0 && (emailXmlsProcessed > 0 || emailXmlsDuplicated > 0);

          if (shouldMarkSeen) {
            const reason = emailXmlsProcessed > 0 ? "processed_no_delete" : "duplicate_xml";
            await markSeenUid(emailUid, reason);
          }
        }

    } catch (emailError) {
        const errorMsg = emailError instanceof Error ? emailError.message : 'Erro desconhecido';
        console.error(`[IMAP Monitor] ⚠️ Erro ao processar email:`, errorMsg);
        emailHadErrors = true;
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
    await updateCheckLogSafe({
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
    if (result.errors.length === 0) {
      addError("monitor", errorMsg);
    }
    
    // Atualizar log com erro
    const duration = Date.now() - startTime;
    const errorDetails =
      result.errors.length > 0
        ? JSON.stringify(result.errors)
        : JSON.stringify([{ stage: "monitor", message: errorMsg }]);
    await updateCheckLogSafe({
      status: 'error',
      finishedAt: new Date(),
      durationMs: duration,
      emailsChecked: result.emailsChecked,
      xmlsFound: result.xmlsFound,
      xmlsProcessed: result.xmlsProcessed,
      xmlsDuplicated: result.xmlsDuplicated,
      errorMessage: errorMsg,
      errorDetails,
    });
    
    return result;
    
  } finally {
    if (!logUpdated) {
      const duration = Date.now() - startTime;
      const fallbackMessage = result.message || "Erro desconhecido";
      const fallbackDetails =
        result.errors.length > 0
          ? JSON.stringify(result.errors)
          : JSON.stringify([{ stage: "monitor", message: fallbackMessage }]);
      await updateCheckLogSafe({
        status: result.success ? 'success' : 'error',
        finishedAt: new Date(),
        durationMs: duration,
        emailsChecked: result.emailsChecked,
        xmlsFound: result.xmlsFound,
        xmlsProcessed: result.xmlsProcessed,
        xmlsDuplicated: result.xmlsDuplicated,
        errorMessage: result.success ? null : fallbackMessage,
        errorDetails: result.success ? null : fallbackDetails,
      });
    }
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





