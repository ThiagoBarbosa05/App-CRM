/**
 * Colunas da Fase 2 do Copiloto em copiloto_signals: a mensagem de WhatsApp
 * redigida pela IA em cima dos sinais determinísticos.
 *
 * ai_reason foi descartada: o motivo gerado pela IA é sempre mais vago que o
 * motivo determinístico do próprio sinal, então não vale persistir. O DROP fica
 * aqui para limpar bases onde a versão anterior deste script já rodou.
 *
 * Uso:
 *   node scripts/add-copiloto-ai-columns.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

await sql`ALTER TABLE copiloto_signals ADD COLUMN IF NOT EXISTS suggested_message text`;
await sql`ALTER TABLE copiloto_signals ADD COLUMN IF NOT EXISTS ai_generated_at timestamp`;
await sql`ALTER TABLE copiloto_signals DROP COLUMN IF EXISTS ai_reason`;

console.log("[migration] Colunas de IA ajustadas em copiloto_signals.");
