/**
 * Adiciona whatsapp_channels.connection_status_at: instante do evento que
 * produziu o connection_status atual.
 *
 * Os webhooks do Baileys Gateway chegam fora de ordem (entrega concorrente com
 * backoff independente por evento). Sem um carimbo do momento do evento, um
 * "close" reentregue depois de um "open" sobrescreve o status e o canal fica
 * marcado como desconectado — ou o contrário, que é pior: o CRM mostra
 * "Conectado" com a sessão morta. Esta coluna é a guarda de ordem.
 *
 * Uso:
 *   node scripts/add-channel-connection-status-at.mjs
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
  ALTER TABLE whatsapp_channels
  ADD COLUMN IF NOT EXISTS connection_status_at timestamp
`;
console.log("[migration] Coluna whatsapp_channels.connection_status_at criada (ou já existente).");

// Canais existentes ficam com NULL, que a guarda de ordem trata como "aceita
// qualquer evento" — o primeiro evento após o deploy preenche o valor.
