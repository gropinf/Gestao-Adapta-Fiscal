import {
  listFilesFromContabo,
  listFilesFromR2,
  getFileFromContabo,
  getFileFromR2,
} from "../contaboStorage";

const prefix = process.env.MIGRATION_PREFIX || "";
const sampleCount = Number(process.env.MIGRATION_SAMPLE_COUNT || 25);

const main = async () => {
  console.log(`[R2 VALIDATION] Validando prefixo "${prefix}"`);
  const contaboFiles = await listFilesFromContabo(prefix);
  const r2Files = await listFilesFromR2(prefix);

  console.log(`[R2 VALIDATION] Contabo: ${contaboFiles.length} arquivos`);
  console.log(`[R2 VALIDATION] R2: ${r2Files.length} arquivos`);

  const r2Map = new Set(r2Files.map((f) => f.key));
  const missingInR2 = contaboFiles.filter((f) => !r2Map.has(f.key));
  console.log(`[R2 VALIDATION] Faltando no R2: ${missingInR2.length}`);

  if (missingInR2.length > 0) {
    console.log(`[R2 VALIDATION] Exemplo faltando: ${missingInR2.slice(0, 5).map((f) => f.key).join(", ")}`);
  }

  const sample = contaboFiles.slice(0, sampleCount);
  let matched = 0;
  let mismatched = 0;

  for (const file of sample) {
    const contaboBuffer = await getFileFromContabo(file.key);
    const r2Buffer = await getFileFromR2(file.key);
    if (!contaboBuffer || !r2Buffer) {
      mismatched++;
      continue;
    }
    if (contaboBuffer.length === r2Buffer.length) {
      matched++;
    } else {
      mismatched++;
    }
  }

  console.log(`[R2 VALIDATION] Amostra ${sampleCount}: iguais=${matched}, diferentes=${mismatched}`);
};

main().catch((error) => {
  console.error("[R2 VALIDATION] Erro fatal:", error);
  process.exit(1);
});
