import { db } from "./db";
import { xmls, xmlEvents } from "../shared/schema";
import { and, eq, like, or, sql } from "drizzle-orm";
import * as contaboStorage from "./contaboStorage";
import { storage } from "./storage";

type MigrationOptions = {
  dryRun: boolean;
  deleteFromContabo: boolean;
  batchSize: number;
  prefix?: string | null;
  companyCnpj: string;
  filepathUrlPrefix: string;
};

const r2Endpoint = process.env.R2_PUBLIC_ENDPOINT || process.env.R2_ENDPOINT || "";

const isUrl = (value?: string | null) => !!value && (value.startsWith("http://") || value.startsWith("https://"));
const isR2Url = (value?: string | null) =>
  !!value &&
  (value.startsWith(r2Endpoint) ||
    value.includes("r2.dev") ||
    value.includes("r2.cloudflarestorage.com"));

const guessKeyFromPath = (value: string): string | null => {
  const xmlMatch = value.match(/(\d{14}\/xml\/(?:\d{6}|\d{4})\/\d{44}\.xml)/);
  if (xmlMatch) return xmlMatch[1];
  const eventMatch = value.match(/(\d{14}\/xml_events\/(?:\d{6}|\d{4})\/[^/]+\.xml)/);
  return eventMatch ? eventMatch[1] : null;
};

const uploadToR2 = async (key: string, sourceBuffer: Buffer) => {
  const upload = await contaboStorage.uploadFile(sourceBuffer, key, "application/xml");
  if (!upload.success) {
    throw new Error(upload.error || "Falha ao enviar para R2");
  }
  return upload.url || contaboStorage.getR2PublicUrl(key);
};

const isRunCancelled = async (runId: string) => {
  const run = await storage.getR2MigrationRunById(runId);
  return run?.status === "cancelled";
};

const processFile = async (
  runId: string,
  row:
    | {
        table: "xmls";
        id: string;
        filepath: string;
        chave: string;
        cnpjEmitente: string;
        cnpjDestinatario: string | null;
      }
    | {
        table: "xml_events";
        id: string;
        filepath: string;
        cnpj: string | null;
        chaveNFe: string | null;
        dataEvento: string | null;
      },
  options: MigrationOptions
) => {
  if (await isRunCancelled(runId)) {
    return { migrated: false, skipped: true, cancelled: true };
  }

  let oldKey: string | null = null;
  const filepath = row.filepath;
  if (isUrl(filepath)) {
    if (options.filepathUrlPrefix && !filepath.startsWith(options.filepathUrlPrefix)) {
      return { migrated: false, skipped: true, cancelled: false };
    }
    if (options.prefix && isUrl(options.prefix) && !filepath.startsWith(options.prefix)) {
      return { migrated: false, skipped: true, cancelled: false };
    }
    oldKey = contaboStorage.getKeyFromPublicUrl(filepath);
  } else {
    oldKey = guessKeyFromPath(filepath);
  }

  if (!oldKey) {
    await storage.updateR2MigrationRun(runId, {
      lastKey: filepath,
      lastMessage: `Key não encontrada (${row.table})`,
    });
    return { migrated: false, skipped: true };
  }

  if (options.prefix && !isUrl(options.prefix) && !oldKey.startsWith(options.prefix)) {
    return { migrated: false, skipped: true };
  }

  let newKey = oldKey;
  if (row.table === "xmls") {
    const storageCnpj = row.cnpjEmitente || row.cnpjDestinatario || options.companyCnpj;
    const { yearMonth } = contaboStorage.getYearMonthFromChave(row.chave);
    const fallbackYearMonth = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    newKey = `${storageCnpj}/xml/${yearMonth || fallbackYearMonth}/${row.chave}.xml`;
  } else {
    const storageCnpj = row.cnpj || options.companyCnpj;
    const yearMonthFromChave = row.chaveNFe
      ? contaboStorage.getYearMonthFromChave(row.chaveNFe).yearMonth
      : null;
    const yearMonthFromDate =
      row.dataEvento && row.dataEvento.includes("-")
        ? `${row.dataEvento.substring(0, 4)}${row.dataEvento.substring(5, 7)}`
        : null;
    const eventFolder = yearMonthFromChave || yearMonthFromDate || String(new Date().getFullYear());
    const fileName = oldKey.split("/").pop() || `${row.id}.xml`;
    newKey = `${storageCnpj}/xml_events/${eventFolder}/${fileName}`;
  }

  const existsR2 = await contaboStorage.fileExistsInR2(newKey);
  let uploaded = false;

  if (!existsR2) {
    const contaboBuffer = await contaboStorage.getFileFromContabo(oldKey);
    if (!contaboBuffer) {
      await storage.updateR2MigrationRun(runId, {
        lastKey: oldKey,
        lastMessage: "Arquivo não encontrado no Contabo",
      });
      return { migrated: false, skipped: true };
    }
    if (!options.dryRun) {
      await uploadToR2(newKey, contaboBuffer);
      uploaded = true;
    }
  }

  const newUrl = contaboStorage.getR2PublicUrl(newKey);
  if (!options.dryRun && !isR2Url(filepath)) {
    if (row.table === "xmls") {
      await db.update(xmls).set({ filepath: newUrl }).where(eq(xmls.id, row.id));
    } else {
      await db.update(xmlEvents).set({ filepath: newUrl }).where(eq(xmlEvents.id, row.id));
    }
  }

  if (!options.dryRun && options.deleteFromContabo && (existsR2 || uploaded)) {
    await contaboStorage.deleteFileFromContabo(oldKey);
  }

  await storage.updateR2MigrationRun(runId, {
    lastKey: newKey,
    lastMessage: `OK (${row.table})`,
  });

  return { migrated: true, skipped: false, cancelled: false };
};

const migrateTable = async (runId: string, table: "xmls" | "xml_events", options: MigrationOptions) => {
  let offset = 0;
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  while (true) {
    if (await isRunCancelled(runId)) {
      return { migrated, skipped, failed, totalProcessed: migrated + skipped + failed };
    }

    const rows =
      table === "xmls"
        ? await db
            .select({
              id: xmls.id,
              filepath: xmls.filepath,
              chave: xmls.chave,
              cnpjEmitente: xmls.cnpjEmitente,
              cnpjDestinatario: xmls.cnpjDestinatario,
            })
            .from(xmls)
            .where(
              and(
                sql`filepath is not null`,
                like(xmls.filepath, `${options.filepathUrlPrefix}%`),
                or(eq(xmls.cnpjEmitente, options.companyCnpj), eq(xmls.cnpjDestinatario, options.companyCnpj))
              )
            )
            .limit(options.batchSize)
            .offset(offset)
        : await db
            .select({
              id: xmlEvents.id,
              filepath: xmlEvents.filepath,
              cnpj: xmlEvents.cnpj,
              chaveNFe: xmlEvents.chaveNFe,
              dataEvento: xmlEvents.dataEvento,
            })
            .from(xmlEvents)
            .where(
              and(
                sql`filepath is not null`,
                like(xmlEvents.filepath, `${options.filepathUrlPrefix}%`),
                eq(xmlEvents.cnpj, options.companyCnpj)
              )
            )
            .limit(options.batchSize)
            .offset(offset);

    if (rows.length === 0) break;

    for (const row of rows) {
      if (await isRunCancelled(runId)) {
        return { migrated, skipped, failed, totalProcessed: migrated + skipped + failed };
      }

      try {
        const result =
          table === "xmls"
            ? await processFile(runId, { ...row, table: "xmls" }, options)
            : await processFile(runId, { ...row, table: "xml_events" }, options);
        if (result.cancelled) {
          return { migrated, skipped, failed, totalProcessed: migrated + skipped + failed };
        }
        if (result.migrated) migrated++;
        if (result.skipped) skipped++;
      } catch (error: any) {
        failed++;
        await storage.updateR2MigrationRun(runId, {
          lastKey: row.filepath as string,
          lastMessage: error?.message || "Erro desconhecido",
        });
      }
    }

    offset += rows.length;
    await storage.updateR2MigrationRun(runId, {
      totalProcessed: offset,
      migrated,
      skipped,
      failed,
    });
  }

  return { migrated, skipped, failed, totalProcessed: migrated + skipped + failed };
};

export const runR2Migration = async (runId: string, options: MigrationOptions) => {
  const xmlsResult = await migrateTable(runId, "xmls", options);
  if (await isRunCancelled(runId)) return;
  const eventsResult = await migrateTable(runId, "xml_events", options);
  if (await isRunCancelled(runId)) return;

  await storage.updateR2MigrationRun(runId, {
    status: "success",
    totalProcessed: xmlsResult.totalProcessed + eventsResult.totalProcessed,
    migrated: xmlsResult.migrated + eventsResult.migrated,
    skipped: xmlsResult.skipped + eventsResult.skipped,
    failed: xmlsResult.failed + eventsResult.failed,
    finishedAt: new Date(),
    lastMessage: "Migração concluída",
  });
};
