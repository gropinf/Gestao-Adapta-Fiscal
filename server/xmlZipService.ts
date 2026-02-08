import archiver from "archiver";
import * as fs from "fs/promises";
import { createWriteStream } from "fs";
import * as path from "path";
import { isStorageUrl, readXmlBuffer } from "./xmlReaderService";

type ZipEntry = {
  name: string;
  path?: string;
  buffer?: Buffer;
};

type ZipProgress = {
  index: number;
  total: number;
  filepath: string;
  status: "start" | "ok" | "skip" | "error";
  message?: string;
};

type BuildZipOptions = {
  onProgress?: (progress: ZipProgress) => void | Promise<void>;
  perFileTimeoutMs?: number;
};

export async function buildZipEntries(
  filepaths: string[],
  options: BuildZipOptions = {}
): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = [];
  const total = filepaths.length;
  const perFileTimeoutMs = options.perFileTimeoutMs ?? 30000;

  const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout de ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  };

  for (const [index, filepath] of filepaths.entries()) {
    await options.onProgress?.({ index: index + 1, total, filepath, status: "start" });
    if (isStorageUrl(filepath)) {
      try {
        const buffer = await withTimeout(readXmlBuffer(filepath), perFileTimeoutMs);
        if (!buffer) {
          console.warn(`Arquivo XML não encontrado no Contabo: ${filepath}`);
          await options.onProgress?.({
            index: index + 1,
            total,
            filepath,
            status: "skip",
            message: "Arquivo não encontrado no Contabo",
          });
          continue;
        }
        const name = path.basename(new URL(filepath).pathname);
        entries.push({ name, buffer });
        await options.onProgress?.({ index: index + 1, total, filepath, status: "ok" });
        continue;
      } catch (error: any) {
        console.warn(`Erro ao ler XML do Contabo: ${filepath}`, error);
        await options.onProgress?.({
          index: index + 1,
          total,
          filepath,
          status: "error",
          message: error?.message || "Erro ao ler arquivo do Contabo",
        });
        continue;
      }
    }

    const resolved = path.resolve(filepath);
    try {
      await withTimeout(fs.access(resolved), perFileTimeoutMs);
      entries.push({ name: path.basename(resolved), path: resolved });
      await options.onProgress?.({ index: index + 1, total, filepath, status: "ok" });
    } catch {
      console.warn(`Arquivo XML não encontrado: ${resolved}`);
      await options.onProgress?.({
        index: index + 1,
        total,
        filepath,
        status: "skip",
        message: "Arquivo não encontrado",
      });
    }
  }

  return entries;
}

export async function createZipFile(entries: ZipEntry[], outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    output.on("close", () => {
      console.log(`ZIP criado: ${archive.pointer()} bytes`);
      resolve();
    });

    archive.on("error", (err: Error) => {
      reject(err);
    });

    archive.pipe(output);

    for (const entry of entries) {
      if (entry.buffer) {
        archive.append(entry.buffer, { name: entry.name });
      } else if (entry.path) {
        archive.file(entry.path, { name: entry.name });
      }
    }

    archive.finalize();
  });
}
