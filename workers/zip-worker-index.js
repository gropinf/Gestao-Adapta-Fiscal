/**
 * Worker ZIP - versão JavaScript para deploy (wrangler).
 * Copie este arquivo para zip-worker/zip-worker/src/index.js no projeto de deploy.
 * Última atualização: 2026-02-10, 22:00 (BRT).
 */
import { Zip, ZipPassThrough } from "fflate";

const isUrl = (value) => value.startsWith("http://") || value.startsWith("https://");

const extractKeyFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split("/").filter((p) => p);
    if (parts.length < 2) return null;
    return parts.slice(1).join("/");
  } catch {
    return null;
  }
};

const normalizeEntry = (entry) => {
  if (typeof entry === "string") {
    const name = entry.split("/").pop() || entry;
    if (isUrl(entry)) {
      const key = extractKeyFromUrl(entry);
      if (!key) return null;
      return { key, name };
    }
    return { key: entry, name };
  }
  if (entry.key) {
    const name = entry.name || entry.key.split("/").pop() || entry.key;
    return { key: entry.key, name };
  }
  if (entry.url) {
    const key = extractKeyFromUrl(entry.url);
    if (!key) return null;
    const name = entry.name || entry.url.split("/").pop() || entry.url;
    return { key, name };
  }
  return null;
};

const getConcurrency = (value) => {
  const parsed = Number(value || 0);
  if (Number.isNaN(parsed) || parsed <= 0) return 6;
  return Math.min(parsed, 20);
};

function runPump(zip, list, concurrency, env, ref) {
  let active = 0;
  let index = 0;
  let finished = 0;
  let addedCount = 0;
  let notFoundCount = 0;

  const pump = () => {
    while (active < concurrency && index < list.length) {
      const entry = normalizeEntry(list[index++]);
      active += 1;
      const finish = () => {
        active -= 1;
        finished += 1;
        if (finished === list.length) {
          if (ref) {
            ref.addedCount = addedCount;
            ref.notFoundCount = notFoundCount;
          }
          console.log(`[Worker ZIP] Concluído: ${addedCount} adicionados, ${notFoundCount} não encontrados, total ${list.length}`);
          zip.end();
          return;
        }
        pump();
      };

      if (!entry) {
        notFoundCount += 1;
        finish();
        continue;
      }

      const keyToFetch = entry.key;
      env.XML_BUCKET
        .get(keyToFetch)
        .then(async (obj) => {
          if (!obj) {
            notFoundCount += 1;
            if (notFoundCount <= 5) {
              console.warn(`[Worker ZIP] Arquivo não encontrado no R2. Key usada: "${keyToFetch}"`);
            }
            return;
          }
          let buffer;
          try {
            if (typeof obj.arrayBuffer === "function") {
              const ab = await obj.arrayBuffer();
              buffer = ab ? new Uint8Array(ab) : new Uint8Array(0);
            } else if (obj.body) {
              const ab = await new Response(obj.body).arrayBuffer();
              buffer = ab ? new Uint8Array(ab) : new Uint8Array(0);
            } else {
              console.warn(`[Worker ZIP] Objeto R2 sem body/arrayBuffer. Key: ${keyToFetch}`);
              notFoundCount += 1;
              return;
            }
          } catch (e) {
            console.error(`[Worker ZIP] Erro ao ler corpo R2 key "${keyToFetch}":`, e);
            notFoundCount += 1;
            return;
          }
          if (!buffer || buffer.length === undefined) {
            buffer = new Uint8Array(0);
          }
          const file = new ZipPassThrough(entry.name);
          file.size = buffer.length;
          zip.add(file);
          file.push(buffer, true);
          addedCount += 1;
          if (addedCount <= 3) {
            console.log(`[Worker ZIP] Adicionado: ${entry.name} (${buffer.length} bytes)`);
          }
        })
        .catch((err) => {
          notFoundCount += 1;
          console.error(`[Worker ZIP] Erro ao buscar key "${keyToFetch}":`, err);
        })
        .finally(() => finish());
    }
  };

  pump();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const listKey = url.searchParams.get("listKey");
    const filename = url.searchParams.get("filename") || "xmls.zip";
    const concurrency = getConcurrency(url.searchParams.get("concurrency"));
    const debug = url.searchParams.get("debug") === "1";

    if (!listKey) {
      return new Response("listKey is required", { status: 400 });
    }

    const listObject = await env.XML_BUCKET.get(listKey);
    if (!listObject) {
      return new Response("list not found", { status: 404 });
    }

    let list = [];
    try {
      const text = await listObject.text();
      list = JSON.parse(text);
    } catch {
      return new Response("invalid list content", { status: 400 });
    }

    if (!Array.isArray(list) || list.length === 0) {
      return new Response("empty list", { status: 400 });
    }

    const first = list[0];
    const firstPreview =
      typeof first === "string" ? first.substring(0, 80) : first ? JSON.stringify(first) : "";
    console.log(`[Worker ZIP] Processando ${list.length} arquivos. Primeira entrada: ${firstPreview}`);
    
    // Log das primeiras 3 keys normalizadas para debug
    for (let i = 0; i < Math.min(3, list.length); i++) {
      const entry = normalizeEntry(list[i]);
      if (entry) {
        console.log(`[Worker ZIP] Key ${i + 1}/${list.length}: "${entry.key}" (nome: "${entry.name}")`);
      } else {
        console.warn(`[Worker ZIP] Entrada ${i + 1} não pôde ser normalizada: ${JSON.stringify(list[i])}`);
      }
    }

    if (debug) {
      const chunks = [];
      const ref = { addedCount: 0, notFoundCount: 0, resolve: null };
      const responsePromise = new Promise((resolve) => {
        ref.resolve = resolve;
      });

      const zip = new Zip((error, data, final) => {
        if (error) {
          ref.resolve(new Response("ZIP error: " + error.message, { status: 500 }));
          return;
        }
        if (data) chunks.push(data);
        if (final) {
          const totalLen = chunks.reduce((s, c) => s + c.length, 0);
          const body = new Uint8Array(totalLen);
          let off = 0;
          for (const c of chunks) {
            body.set(c, off);
            off += c.length;
          }
          ref.resolve(
            new Response(body, {
              headers: {
                "Content-Type": "application/zip",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "X-Zip-Files-Added": String(ref.addedCount),
                "X-Zip-Files-NotFound": String(ref.notFoundCount),
                "X-Zip-Files-Total": String(list.length),
              },
            })
          );
        }
      });

      runPump(zip, list, concurrency, env, ref);
      return responsePromise;
    }

    const stream = new ReadableStream({
      start(controller) {
        const zip = new Zip((error, data, final) => {
          if (error) {
            controller.error(error);
            return;
          }
          if (data) controller.enqueue(data);
          if (final) controller.close();
        });
        runPump(zip, list, concurrency, env, null);
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  },
};
