import archiver from "archiver";
import * as fs from "fs/promises";
import { createWriteStream } from "fs";
import * as path from "path";
import { isContaboUrl, readXmlBuffer } from "./xmlReaderService";

type ZipEntry = {
  name: string;
  path?: string;
  buffer?: Buffer;
};

export async function buildZipEntries(filepaths: string[]): Promise<ZipEntry[]> {
  const entries: ZipEntry[] = [];

  for (const filepath of filepaths) {
    if (isContaboUrl(filepath)) {
      const buffer = await readXmlBuffer(filepath);
      if (!buffer) {
        console.warn(`Arquivo XML não encontrado no Contabo: ${filepath}`);
        continue;
      }
      const name = path.basename(new URL(filepath).pathname);
      entries.push({ name, buffer });
      continue;
    }

    const resolved = path.resolve(filepath);
    try {
      await fs.access(resolved);
      entries.push({ name: path.basename(resolved), path: resolved });
    } catch {
      console.warn(`Arquivo XML não encontrado: ${resolved}`);
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
