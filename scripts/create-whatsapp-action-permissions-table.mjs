/**
 * Cria a tabela whatsapp_action_permissions: permissões de ação por
 * atendente ("o que ele pode fazer"), genérica por permission_key.
 * Default-deny — sem linha aqui, o atendente não pode. Como hoje (antes
 * desta tabela existir) criar/editar templates e aplicar etiquetas é
 * liberado para qualquer vendedor, faz o backfill concedendo as duas
 * permissões a todo vendedor já existente, para não quebrar o que já
 * funciona.
 *
 * Uso:
 *   node scripts/create-whatsapp-action-permissions-table.mjs
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
  CREATE TABLE IF NOT EXISTS whatsapp_action_permissions (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_key text NOT NULL,
    created_at timestamp NOT NULL DEFAULT now(),
    UNIQUE (user_id, permission_key)
  )
`;
console.log("[migration] Tabela whatsapp_action_permissions criada (ou já existente).");

const { rowCount } = await sql.query(`
  INSERT INTO whatsapp_action_permissions (user_id, permission_key)
  SELECT u.id, k.key
  FROM users u
  CROSS JOIN (VALUES ('manage_templates'), ('manage_tags')) AS k(key)
  WHERE u.role = 'vendedor'
  ON CONFLICT (user_id, permission_key) DO NOTHING
`);
console.log(`[migration] Backfill: ${rowCount} permissão(ões) concedida(s) a vendedores existentes.`);
