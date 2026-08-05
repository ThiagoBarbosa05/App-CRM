/**
 * Adiciona whatsapp_channels.connection_checked_at: última vez que o Baileys
 * Gateway CONFIRMOU o estado do canal.
 *
 * connection_status_at só avança em transições — de propósito, senão o polling
 * de QR (a cada 2,5s) empurraria o relógio à frente do "open" real e a guarda de
 * ordem descartaria justamente o webhook de conexão bem-sucedida. O efeito
 * colateral é que "Conectado" não tem prazo de validade: um cache de dias atrás
 * é indistinguível de uma verificação de agora. Esta coluna é esse prazo.
 *
 * Uso:
 *   node scripts/add-channel-connection-checked-at.mjs
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
  ADD COLUMN IF NOT EXISTS connection_checked_at timestamp
`;
console.log("[migration] Coluna whatsapp_channels.connection_checked_at criada (ou já existente).");

// Canais existentes ficam com NULL, que a UI trata como "nunca verificado" —
// o job de reconciliação preenche o valor no primeiro minuto após o deploy.
