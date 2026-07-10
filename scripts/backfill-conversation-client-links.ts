import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import "dotenv/config";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

async function main() {
  console.log("Vinculando conversas órfãs (client_id NULL) a clientes existentes por telefone...");

  // Mesma normalização usada em findOrCreateConversation/autoLinkConversationsByPhone:
  // compara os dígitos do telefone com e sem o código do país (55).
  const result = await pool.query(`
    UPDATE whatsapp_conversations c
    SET client_id = cl.id, updated_at = now()
    FROM clients cl
    WHERE c.client_id IS NULL
      AND cl.phone IS NOT NULL
      AND (
        regexp_replace(cl.phone, '\\D', '', 'g') = regexp_replace(c.phone, '\\D', '', 'g')
        OR regexp_replace(cl.phone, '\\D', '', 'g') = regexp_replace(regexp_replace(c.phone, '\\D', '', 'g'), '^55', '')
        OR '55' || regexp_replace(cl.phone, '\\D', '', 'g') = regexp_replace(c.phone, '\\D', '', 'g')
      )
    RETURNING c.id, c.phone, cl.name
  `);

  console.log(`✓ ${result.rowCount ?? 0} conversa(s) vinculada(s):`);
  for (const row of result.rows) {
    console.log(`  - ${row.phone} → ${row.name}`);
  }

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro no backfill:", err);
  process.exit(1);
});
