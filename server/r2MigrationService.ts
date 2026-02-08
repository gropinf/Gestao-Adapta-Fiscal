import { db } from "./db";
import { xmls, xmlEvents } from "../shared/schema";
import { eq, sql } from "drizzle-orm";
import * as contaboStorage from "./contaboStorage";
import { storage } from "./storage";

type MigrationOptions = {
  dryRun: boolean;
  deleteFromContabo: boolean;
  batchSize: number;
  prefix?: string | null;
};

const r2Endpoint = process.env.R2_PUBLIC_ENDPOINT || process.env.R2_ENDPOINT || "";

const isUrl = (value?: string | null) => !!value && (value.startsWith("http://") || value.startsWith("https://"));
const isR2Url = (value?: string | null) =>
  !!value &&
  (value.startsWith(r2Endpoint) ||
    value.includes("r2.dev") ||
    value.includes("r2.cloudflarestorage.com"));

const guessKeyFromPath = (value: string): string | null => {
  const match = value.match(/(\d{14}\/xml\/\d{44}\.xml)/);
  return match ? match[1] : null;
};

const uploadToR2 = async (key: string, sourceBuffer: Buffer) => {
  const upload = await contaboStorage.uploadFile(sourceBuffer, key, "application/xml");
  if (!upload.success) {
    throw new Error(upload.error || "Falha ao enviar para R2");
  }
  return upload.url || contaboStorage.getR2PublicUrl(key);
};

const processFile = async (
  runId: string,
  id: string,
  filepath: string,
  table: "xmls" | "xml_events",
  options: MigrationOptions
) => {
  let key: string | null = null;
  if (isUrl(filepath)) {
    key = contaboStorage.getKeyFromPublicUrl(filepath);
  } else {
    key = guessKeyFromPath(filepath);
  }

  if (!key) {
    await storage.updateR2MigrationRun(runId, {
      lastKey: filepath,
      lastMessage: `Key não encontrada (${table})`,
    });
    return { migrated: false, skipped: true };
  }

  if (options.prefix && !key.startsWith(options.prefix)) {
    return { migrated: false, skipped: true };
  }

  const existsR2 = await contaboStorage.fileExistsInR2(key);
  let uploaded = false;

  if (!existsR2) {
    const contaboBuffer = await contaboStorage.getFileFromContabo(key);
    if (!contaboBuffer) {
      await storage.updateR2MigrationRun(runId, {
        lastKey: key,
        lastMessage: "Arquivo não encontrado no Contabo",
      });
      return { migrated: false, skipped: true };
    }
    if (!options.dryRun) {
      await uploadToR2(key, contaboBuffer);
      uploaded = true;
    }
  }

  const newUrl = contaboStorage.getR2PublicUrl(key);
  if (!options.dryRun && !isR2Url(filepath)) {
    if (table === "xmls") {
      await db.update(xmls).set({ filepath: newUrl }).where(eq(xmls.id, id));
    } else {
      await db.update(xmlEvents).set({ filepath: newUrl }).where(eq(xmlEvents.id, id));
    }
  }

  if (!options.dryRun && options.deleteFromContabo && (existsR2 || uploaded)) {
    await contaboStorage.deleteFileFromContabo(key);
  }

  await storage.updateR2MigrationRun(runId, {
    lastKey: key,
    lastMessage: `OK (${table})`,
  });

  return { migrated: true, skipped: false };
};

const migrateTable = async (runId: string, table: "xmls" | "xml_events", options: MigrationOptions) => {
  let offset = 0;
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  while (true) {
    const rows =
      table === "xmls"
        ? await db
            .select({ id: xmls.id, filepath: xmls.filepath })
            .from(xmls)
            .where(sql`filepath is not null`)
            .limit(options.batchSize)
            .offset(offset)
        : await db
            .select({ id: xmlEvents.id, filepath: xmlEvents.filepath })
            .from(xmlEvents)
            .where(sql`filepath is not null`)
            .limit(options.batchSize)
            .offset(offset);

    if (rows.length === 0) break;

    for (const row of rows) {
      try {
        const result = await processFile(runId, row.id, row.filepath as string, table, options);
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
  const eventsResult = await migrateTable(runId, "xml_events", options);

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
