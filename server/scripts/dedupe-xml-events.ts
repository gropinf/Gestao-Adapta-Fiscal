import { sql } from "drizzle-orm";
import { db, pool } from "../db";

async function run() {
  try {
    const dedupEventsResult = await db.execute(sql`
      WITH ranked AS (
        SELECT
          id,
          row_number() OVER (
            PARTITION BY
              company_id,
              tipo_evento,
              chave_nfe,
              COALESCE(numero_sequencia, -1),
              COALESCE(protocolo, ''),
              COALESCE(data_evento, ''),
              COALESCE(hora_evento, '')
            ORDER BY created_at ASC
          ) AS rn
        FROM xml_events
        WHERE tipo_evento <> 'inutilizacao'
      )
      DELETE FROM xml_events
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
      RETURNING id;
    `);

    const dedupInutilizacoesResult = await db.execute(sql`
      WITH ranked AS (
        SELECT
          id,
          row_number() OVER (
            PARTITION BY
              company_id,
              tipo_evento,
              modelo,
              serie,
              numero_inicial,
              numero_final,
              COALESCE(protocolo, ''),
              COALESCE(data_evento, ''),
              COALESCE(hora_evento, '')
            ORDER BY created_at ASC
          ) AS rn
        FROM xml_events
        WHERE tipo_evento = 'inutilizacao'
      )
      DELETE FROM xml_events
      WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
      RETURNING id;
    `);

    const dedupEventsCount = Array.isArray(dedupEventsResult) ? dedupEventsResult.length : dedupEventsResult?.rowCount ?? 0;
    const dedupInutCount = Array.isArray(dedupInutilizacoesResult)
      ? dedupInutilizacoesResult.length
      : dedupInutilizacoesResult?.rowCount ?? 0;

    console.log(`Duplicidades removidas (eventos): ${dedupEventsCount}`);
    console.log(`Duplicidades removidas (inutilizacoes): ${dedupInutCount}`);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Erro ao remover duplicidades:", error);
  process.exit(1);
});
