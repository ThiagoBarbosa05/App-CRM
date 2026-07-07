/**
 * Adiciona as colunas `total_recipients` e `sent_count` à tabela
 * `email_campaigns`. Ambas já existem no schema Drizzle (shared/schema.ts)
 * como integer(...).default(0), mas nunca foram aplicadas ao banco, causando
 * o erro `column "total_recipients" does not exist` ao listar campanhas de
 * email e nos ticks do email-campaign-dispatcher.
 *
 * Uso (banco de produção):
 *   node scripts/add-email-campaign-count-cols.mjs
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/add-email-campaign-count-cols.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL ou TEST_DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

await sql`
  ALTER TABLE email_campaigns
    ADD COLUMN IF NOT EXISTS total_recipients integer DEFAULT 0
`;
await sql`
  ALTER TABLE email_campaigns
    ADD COLUMN IF NOT EXISTS sent_count integer DEFAULT 0
`;

console.log("[migration] Colunas total_recipients e sent_count adicionadas à tabela email_campaigns.");
