import { sql } from "drizzle-orm";
import { db, pool } from "../db";

const CNPJ = "30797024000184";

async function run() {
  try {
    const companyResult = await db.execute(sql`
      SELECT id, razao_social
      FROM companies
      WHERE cnpj = ${CNPJ}
      LIMIT 1;
    `);

    const companyRow = Array.isArray(companyResult) ? companyResult[0] : companyResult?.rows?.[0];
    if (companyRow) {
      console.log(`Empresa encontrada: ${companyRow.razao_social} (id: ${companyRow.id})`);
    } else {
      console.log(`Empresa com CNPJ ${CNPJ} nao encontrada em companies`);
    }

    const result = await db.execute(sql`
      WITH inutilizacoes AS (
        SELECT
          cnpj,
          modelo,
          CAST(numero_inicial AS integer) AS numero_inicial,
          CAST(numero_final AS integer) AS numero_final
        FROM xml_events
        WHERE tipo_evento = 'inutilizacao'
          AND cnpj = ${CNPJ}
          AND numero_inicial ~ '^[0-9]+$'
          AND numero_final ~ '^[0-9]+$'
      ),
      emitidas AS (
        SELECT
          id,
          numero_nota
        FROM xmls
        WHERE cnpj_emitente = ${CNPJ}
          AND categoria = 'emitida'
          AND numero_nota ~ '^[0-9]+$'
          AND deleted_at IS NULL
      ),
      inconsistentes AS (
        SELECT e.id
        FROM emitidas e
        JOIN inutilizacoes i
          ON CAST(e.numero_nota AS integer) BETWEEN i.numero_inicial AND i.numero_final
      )
      UPDATE xmls
      SET deleted_at = now()
      WHERE id IN (SELECT id FROM inconsistentes)
      RETURNING id;
    `);

    const deletedCount = Array.isArray(result) ? result.length : result?.rowCount ?? 0;
    console.log(`XMLs excluidos (soft delete) por inconsistencias: ${deletedCount}`);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Erro ao excluir XMLs inconsistentes:", error);
  process.exit(1);
});
