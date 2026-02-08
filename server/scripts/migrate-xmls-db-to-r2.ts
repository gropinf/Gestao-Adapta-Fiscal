import * as fs from "fs/promises";
import {
  getKeyFromPublicUrl,
  getR2PublicUrl,
  getFileFromContabo,
  fileExistsInR2,
  uploadFile,
  deleteFileFromContabo,
  getYearMonthFromChave,
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
  const xmlMatch = value.match(/(\d{14}\/xml\/(?:\d{6}|\d{4})\/\d{44}\.xml)/);
  if (xmlMatch) return xmlMatch[1];
  const eventMatch = value.match(/(\d{14}\/xml_events\/(?:\d{6}|\d{4})\/[^/]+\.xml)/);
  return eventMatch ? eventMatch[1] : null;
};

const uploadToR2 = async (key: string, sourceBuffer: Buffer) => {
  const upload = await uploadFile(sourceBuffer, key, "application/xml");
  if (!upload.success) {
    throw new Error(upload.error || "Falha ao enviar para R2");
  }
  return upload.url || getR2PublicUrl(key);
};

const processFile = async (
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
      }
) => {
  let oldKey: string | null = null;
  const filepath = row.filepath;

  if (isUrl(filepath)) {
    oldKey = getKeyFromPublicUrl(filepath);
  } else {
    oldKey = guessKeyFromPath(filepath);
  }

  if (!oldKey) {
    console.warn(`[DB MIGRATION] Key não encontrada (${row.table}): ${row.id}`);
    return { migrated: false, skipped: true };
  }

  let newKey = oldKey;
  if (row.table === "xmls") {
    const storageCnpj = row.cnpjEmitente || row.cnpjDestinatario;
    const { yearMonth } = getYearMonthFromChave(row.chave);
    const fallbackYearMonth = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    newKey = `${storageCnpj}/xml/${yearMonth || fallbackYearMonth}/${row.chave}.xml`;
  } else {
    const storageCnpj = row.cnpj || "unknown";
    const yearMonthFromChave = row.chaveNFe ? getYearMonthFromChave(row.chaveNFe).yearMonth : null;
    const yearMonthFromDate =
      row.dataEvento && row.dataEvento.includes("-")
        ? `${row.dataEvento.substring(0, 4)}${row.dataEvento.substring(5, 7)}`
        : null;
    const eventFolder = yearMonthFromChave || yearMonthFromDate || String(new Date().getFullYear());
    const fileName = oldKey.split("/").pop() || `${row.id}.xml`;
    newKey = `${storageCnpj}/xml_events/${eventFolder}/${fileName}`;
  }

  const newUrl = getR2PublicUrl(newKey);
  const existsR2 = await fileExistsInR2(newKey);
  let uploaded = false;

  if (!existsR2) {
    const contaboBuffer = await getFileFromContabo(oldKey);
    if (!contaboBuffer) {
      console.warn(`[DB MIGRATION] Arquivo não encontrado no Contabo: ${oldKey}`);
      return { migrated: false, skipped: true };
    }
    if (!dryRun) {
      await uploadToR2(newKey, contaboBuffer);
      uploaded = true;
    }
  }

  if (!dryRun && filepath !== newUrl) {
    if (row.table === "xmls") {
      await db.update(xmls).set({ filepath: newUrl }).where(eq(xmls.id, row.id));
    } else {
      await db.update(xmlEvents).set({ filepath: newUrl }).where(eq(xmlEvents.id, row.id));
    }
  }

  if (!dryRun && deleteFromContabo && (existsR2 || uploaded)) {
    await deleteFileFromContabo(oldKey);
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
            .select({
              id: xmls.id,
              filepath: xmls.filepath,
              chave: xmls.chave,
              cnpjEmitente: xmls.cnpjEmitente,
              cnpjDestinatario: xmls.cnpjDestinatario,
            })
            .from(xmls)
            .where(sql`filepath is not null`)
            .limit(batchSize)
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
            .where(sql`filepath is not null`)
            .limit(batchSize)
            .offset(offset);

    if (rows.length === 0) break;

    for (const row of rows) {
      try {
        const result =
          table === "xmls"
            ? await processFile({ ...row, table: "xmls" })
            : await processFile({ ...row, table: "xml_events" });
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
