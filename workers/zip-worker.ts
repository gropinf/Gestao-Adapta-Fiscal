import { Zip } from "fflate";

type Env = {
  XML_BUCKET: R2Bucket;
};

type ListEntry = string | { key: string; name?: string };

const normalizeEntry = (entry: ListEntry) => {
  if (typeof entry === "string") {
    const name = entry.split("/").pop() || entry;
    return { key: entry, name };
  }
  return { key: entry.key, name: entry.name || entry.key.split("/").pop() || entry.key };
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
            env.XML_BUCKET
              .get(entry.key)
              .then(async (obj) => {
                if (!obj) return;
                const buffer = new Uint8Array(await obj.arrayBuffer());
                zip.add(entry.name, buffer);
              })
              .catch(() => {})
              .finally(() => {
                active -= 1;
                finished += 1;
                if (finished === list.length) {
                  zip.end();
                  return;
                }
                pump();
              });
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
