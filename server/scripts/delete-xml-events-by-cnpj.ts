import { sql } from "drizzle-orm";
import { db, pool } from "../db";

const CNPJS = ["30797024000184", "37063686000170"];

async function run() {
  try {
    const result = await db.execute(sql`
      DELETE FROM xml_events
      WHERE cnpj IN (${sql.join(CNPJS.map((cnpj) => sql`${cnpj}`), sql`,`)})
      RETURNING id;
    `);

    const deletedCount = Array.isArray(result) ? result.length : result?.rowCount ?? 0;
    console.log(`Eventos removidos para CNPJs ${CNPJS.join(", ")}: ${deletedCount}`);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Erro ao remover eventos:", error);
  process.exit(1);
});
