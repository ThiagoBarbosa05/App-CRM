/**
 * Cria a tabela assertiva_tokens: linha única (id fixo "singleton") que persiste
 * o token OAuth2 da Assertiva (access_token, expiração, último refresh, último erro),
 * evitando reautenticar a cada restart e permitindo compartilhamento entre instâncias.
 *
 * Uso:
 *   node scripts/create-assertiva-tokens-table.mjs
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
  CREATE TABLE IF NOT EXISTS assertiva_tokens (
    id text PRIMARY KEY DEFAULT 'singleton',
    access_token text,
    expires_at timestamp,
    last_refresh_at timestamp,
    last_error text,
    updated_at timestamp NOT NULL DEFAULT now()
  )
`;

console.log("[migration] Tabela assertiva_tokens criada (ou já existente).");
