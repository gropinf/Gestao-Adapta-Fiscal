import * as fs from "fs/promises";
import {
  getKeyFromPublicUrl,
  getR2PublicUrl,
  getFileFromContabo,
  fileExistsInR2,
  uploadFile,
  deleteFileFromContabo,
} from "../contaboStorage";
import { db } from "../db";
import { xmls, xmlEvents } from "../../shared/schema";
import { eq, sql } from "drizzle-orm";

const batchSize = Number(process.env.MIGRATION_BATCH_SIZE || 200);
const deleteFromContabo = process.env.MIGRATION_DELETE_CONTABO === "true";
const dryRun = process.env.MIGRATION_DRY_RUN === "true";

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
  const upload = await uploadFile(sourceBuffer, key, "application/xml");
  if (!upload.success) {
    throw new Error(upload.error || "Falha ao enviar para R2");
  }
  return upload.url || getR2PublicUrl(key);
};

const processFile = async (id: string, filepath: string, table: "xmls" | "xml_events") => {
  let key: string | null = null;

  if (isUrl(filepath)) {
    key = getKeyFromPublicUrl(filepath);
  } else {
    key = guessKeyFromPath(filepath);
  }

  if (!key) {
    console.warn(`[DB MIGRATION] Key não encontrada (${table}): ${id}`);
    return { migrated: false, skipped: true };
  }

  const newUrl = getR2PublicUrl(key);
  const existsR2 = await fileExistsInR2(key);
  let uploaded = false;

  if (!existsR2) {
    const contaboBuffer = await getFileFromContabo(key);
    if (!contaboBuffer) {
      console.warn(`[DB MIGRATION] Arquivo não encontrado no Contabo: ${key}`);
      return { migrated: false, skipped: true };
    }
    if (!dryRun) {
      await uploadToR2(key, contaboBuffer);
      uploaded = true;
    }
  }

  if (!dryRun && filepath !== newUrl) {
    if (table === "xmls") {
      await db.update(xmls).set({ filepath: newUrl }).where(eq(xmls.id, id));
    } else {
      await db.update(xmlEvents).set({ filepath: newUrl }).where(eq(xmlEvents.id, id));
    }
  }

  if (!dryRun && deleteFromContabo && (existsR2 || uploaded)) {
    await deleteFileFromContabo(key);
  }

  return { migrated: true, skipped: false };
};

const migrateTable = async (table: "xmls" | "xml_events") => {
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
            .limit(batchSize)
            .offset(offset)
        : await db
            .select({ id: xmlEvents.id, filepath: xmlEvents.filepath })
            .from(xmlEvents)
            .where(sql`filepath is not null`)
            .limit(batchSize)
            .offset(offset);

    if (rows.length === 0) break;

    for (const row of rows) {
      try {
        const result = await processFile(row.id, row.filepath as string, table);
        if (result.migrated) migrated++;
        if (result.skipped) skipped++;
      } catch (error: any) {
        failed++;
        console.error(`[DB MIGRATION] Erro ${table}:${row.id}`, error?.message || error);
      }
    }

    offset += rows.length;
    console.log(
      `[DB MIGRATION] ${table} progresso: migrated=${migrated}, skipped=${skipped}, failed=${failed}, offset=${offset}`
    );
  }

  return { migrated, skipped, failed };
};

const main = async () => {
  console.log(`[DB MIGRATION] Iniciando migração via banco. dryRun=${dryRun}, deleteContabo=${deleteFromContabo}`);
  const xmlsResult = await migrateTable("xmls");
  const eventsResult = await migrateTable("xml_events");
  console.log(`[DB MIGRATION] XMLs:`, xmlsResult);
  console.log(`[DB MIGRATION] Eventos:`, eventsResult);
};

main().catch((error) => {
  console.error("[DB MIGRATION] Erro fatal:", error);
  process.exit(1);
});
