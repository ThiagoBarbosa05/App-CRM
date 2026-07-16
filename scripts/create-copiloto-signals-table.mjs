/**
 * Cria a tabela copiloto_signals: fila diária de contatos sugeridos ao vendedor
 * (um card = "ligue para X porque Y"), gerada pelo job copiloto-scan-scheduler.
 *
 * Uso:
 *   node scripts/create-copiloto-signals-table.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

await sql`
  CREATE TABLE IF NOT EXISTS copiloto_signals (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id varchar NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    seller_id varchar NOT NULL REFERENCES users(id),
    type text NOT NULL,
    score integer NOT NULL DEFAULT 0,
    estimated_value numeric(12, 2) NOT NULL DEFAULT 0.00,
    reason text NOT NULL,
    payload jsonb,
    status text NOT NULL DEFAULT 'pending',
    dismiss_reason text,
    snoozed_until timestamp,
    generated_at timestamp NOT NULL DEFAULT now(),
    acted_at timestamp,
    acted_by varchar REFERENCES users(id)
  )
`;

await sql`
  CREATE INDEX IF NOT EXISTS copiloto_signals_seller_status_idx
    ON copiloto_signals (seller_id, status)
`;

await sql`
  CREATE INDEX IF NOT EXISTS copiloto_signals_client_type_idx
    ON copiloto_signals (client_id, type)
`;

console.log("[migration] Tabela copiloto_signals criada (ou já existente).");
