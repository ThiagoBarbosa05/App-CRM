/**
 * Adiciona a coluna `avatar_storage_key` à tabela `users` — foto de perfil.
 * Guarda a CHAVE do objeto no R2, não a URL pública.
 *
 * Uso (banco de produção):
 *   node scripts/add-user-avatar-column.mjs
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/add-user-avatar-column.mjs
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
  ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_storage_key text
`;

console.log("[migration] Coluna avatar_storage_key adicionada à tabela users.");
