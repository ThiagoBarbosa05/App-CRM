/**
 * Adiciona índice em connect_orders.app_client_id — necessário para o painel
 * de qualidade de cadastro (server/services/registration-quality-panel.service.ts),
 * que agora varre todos os clientes (não só os priorizados por RFM) e faz um
 * LATERAL JOIN de compras por cliente. bling_orders já tinha índice equivalente;
 * connect_orders não, o que deixava a consulta lenta (~7s p/ 7.4k clientes).
 *
 * Uso:
 *   node scripts/add-connect-orders-client-index.mjs
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
  CREATE INDEX IF NOT EXISTS connect_orders_app_client_idx
  ON connect_orders (app_client_id)
`;

console.log("[migration] Índice connect_orders_app_client_idx criado (ou já existente).");
