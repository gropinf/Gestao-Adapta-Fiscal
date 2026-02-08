import {
  listFilesFromContabo,
  uploadFile,
  getFileFromContabo,
  fileExistsInR2,
} from "../contaboStorage";

const prefix = process.env.MIGRATION_PREFIX || "";
const limit = Number(process.env.MIGRATION_LIMIT || 0);

const main = async () => {
  console.log(`[R2 MIGRATION] Iniciando migração. Prefixo: "${prefix}"`);
  const files = await listFilesFromContabo(prefix);
  console.log(`[R2 MIGRATION] Contabo arquivos encontrados: ${files.length}`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const [index, file] of files.entries()) {
    if (limit && migrated + skipped + failed >= limit) {
      break;
    }

    const exists = await fileExistsInR2(file.key);
    if (exists) {
      skipped++;
      if ((index + 1) % 100 === 0) {
        console.log(`[R2 MIGRATION] Progresso: ${index + 1}/${files.length} (migrated=${migrated}, skipped=${skipped}, failed=${failed})`);
      }
      continue;
    }

    try {
      const buffer = await getFileFromContabo(file.key);
      if (!buffer) {
        failed++;
        console.warn(`[R2 MIGRATION] Arquivo não encontrado no Contabo: ${file.key}`);
        continue;
      }
      const upload = await uploadFile(buffer, file.key, "application/octet-stream");
      if (!upload.success) {
        failed++;
        console.warn(`[R2 MIGRATION] Falha ao enviar ${file.key}: ${upload.error}`);
        continue;
      }
      migrated++;
    } catch (error: any) {
      failed++;
      console.error(`[R2 MIGRATION] Erro em ${file.key}:`, error?.message || error);
    }

    if ((index + 1) % 50 === 0) {
      console.log(`[R2 MIGRATION] Progresso: ${index + 1}/${files.length} (migrated=${migrated}, skipped=${skipped}, failed=${failed})`);
    }
  }

  console.log(`[R2 MIGRATION] Finalizado. Migrados=${migrated}, Skipped=${skipped}, Falhas=${failed}`);
};

main().catch((error) => {
  console.error("[R2 MIGRATION] Erro fatal:", error);
  process.exit(1);
});
