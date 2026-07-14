/**
 * Cria a tabela zernio_settings, usada para configurar a API key e o webhook
 * secret do Zernio pela tela de Integrações em vez de env vars manuais
 * (server/services/zernio-settings.service.ts). Mesmo formato de
 * whatsapp_settings: key/value com flag isSensitive para mascarar na UI.
 *
 * Uso:
 *   node scripts/create-zernio-settings-table.mjs
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
  CREATE TABLE IF NOT EXISTS zernio_settings (
    key varchar PRIMARY KEY,
    value text NOT NULL,
    description text,
    is_sensitive boolean NOT NULL DEFAULT false,
    updated_at timestamp NOT NULL DEFAULT now()
  )
`;

console.log("[migration] Tabela zernio_settings criada (ou já existente).");
