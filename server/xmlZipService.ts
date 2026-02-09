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
  concurrency?: number;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout de ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
};

export async function buildZipEntries(
  filepaths: string[],
  options: BuildZipOptions = {}
): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = [];
  const total = filepaths.length;
  const perFileTimeoutMs = options.perFileTimeoutMs ?? 30000;

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

export async function createZipFileFromFilepaths(
  filepaths: string[],
  outputPath: string,
  options: BuildZipOptions = {}
): Promise<void> {
  const total = filepaths.length;
  const perFileTimeoutMs = options.perFileTimeoutMs ?? 30000;
  const concurrency = options.concurrency ?? 6;

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

    let nextIndex = 0;
    let running = 0;
    let finished = 0;
    let appendChain = Promise.resolve();

    const enqueueAppend = (cb: () => void) => {
      appendChain = appendChain.then(() => cb());
      return appendChain;
    };

    const processFile = async (index: number, filepath: string) => {
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
            return;
          }
          const name = path.basename(new URL(filepath).pathname);
          await enqueueAppend(() => {
            archive.append(buffer, { name });
          });
          await options.onProgress?.({ index: index + 1, total, filepath, status: "ok" });
          return;
        } catch (error: any) {
          console.warn(`Erro ao ler XML do Contabo: ${filepath}`, error);
          await options.onProgress?.({
            index: index + 1,
            total,
            filepath,
            status: "error",
            message: error?.message || "Erro ao ler arquivo do Contabo",
          });
          return;
        }
      }

      const resolved = path.resolve(filepath);
      try {
        await withTimeout(fs.access(resolved), perFileTimeoutMs);
        const name = path.basename(resolved);
        await enqueueAppend(() => {
          archive.file(resolved, { name });
        });
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
    };

    const pump = () => {
      while (running < concurrency && nextIndex < filepaths.length) {
        const currentIndex = nextIndex++;
        const filepath = filepaths[currentIndex];
        running++;
        processFile(currentIndex, filepath)
          .catch((error) => {
            console.warn(`Erro ao processar arquivo ${filepath}`, error);
          })
          .finally(() => {
            running--;
            finished++;
            if (finished === filepaths.length) {
              appendChain
                .then(() => archive.finalize())
                .catch((error) => reject(error));
              return;
            }
            pump();
          });
      }
    };

    if (filepaths.length === 0) {
      archive.finalize();
      return;
    }

    pump();
  });
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
