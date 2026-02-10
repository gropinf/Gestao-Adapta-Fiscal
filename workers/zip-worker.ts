import { Zip } from "fflate";

type R2Bucket = any;

type Env = {
  XML_BUCKET: R2Bucket;
};

type ListEntry = string | { key?: string; url?: string; name?: string };

type NormalizedEntry = {
  key: string;
  name: string;
};

const isUrl = (value: string) => value.startsWith("http://") || value.startsWith("https://");

const extractKeyFromUrl = (url: string): string | null => {
  try {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split("/").filter((p) => p);
    if (parts.length < 2) return null;
    return parts.slice(1).join("/");
  } catch {
    return null;
  }
};

const normalizeEntry = (entry: ListEntry): NormalizedEntry | null => {
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

const getConcurrency = (value: string | null) => {
  const parsed = Number(value || 0);
  if (Number.isNaN(parsed) || parsed <= 0) return 6;
  return Math.min(parsed, 20);
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const listKey = url.searchParams.get("listKey");
    const filename = url.searchParams.get("filename") || "xmls.zip";
    const concurrency = getConcurrency(url.searchParams.get("concurrency"));

    if (!listKey) {
      return new Response("listKey is required", { status: 400 });
    }

    const listObject = await env.XML_BUCKET.get(listKey);
    if (!listObject) {
      return new Response("list not found", { status: 404 });
    }

    let list: ListEntry[] = [];
    try {
      const text = await listObject.text();
      list = JSON.parse(text);
    } catch {
      return new Response("invalid list content", { status: 400 });
    }

    if (!Array.isArray(list) || list.length === 0) {
      return new Response("empty list", { status: 400 });
    }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const zip = new Zip((error, data, final) => {
          if (error) {
            controller.error(error);
            return;
          }
          if (data) controller.enqueue(data);
          if (final) controller.close();
        });

        let active = 0;
        let index = 0;
        let finished = 0;

        const pump = () => {
          while (active < concurrency && index < list.length) {
            const entry = normalizeEntry(list[index++]);
            active += 1;
            const finish = () => {
              active -= 1;
              finished += 1;
              if (finished === list.length) {
                zip.end();
                return;
              }
              pump();
            };

            if (!entry) {
              finish();
              continue;
            }

            env.XML_BUCKET
              .get(entry.key)
              .then(async (obj: any) => {
                if (!obj) return;
                const buffer = new Uint8Array(await obj.arrayBuffer());
                (zip as any).add(entry.name, buffer);
              })
              .catch(() => {})
              .finally(() => finish());
          }
        };

        pump();
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
