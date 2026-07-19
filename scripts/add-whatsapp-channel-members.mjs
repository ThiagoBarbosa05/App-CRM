/**
 * Cria whatsapp_channel_members: vínculo muitos-para-muitos usuário <-> canal,
 * usado para conceder acesso a um canal sem transferir a posse dele (coluna
 * whatsapp_channels.user_id continua sendo o dono/owner do canal Evolution/QR
 * Code). A visibilidade de conversas de um vendedor passa a exigir setor E
 * canal permitidos (ver vendorScopeCondition em whatsapp-conversations.service.ts).
 *
 * Backfill: para não regredir o acesso de quem já é membro de algum setor
 * (whatsapp_sector_members) hoje — antes desta migração a visibilidade da fila
 * de setor não dependia de canal nenhum — concede a cada um desses usuários
 * acesso a todos os canais ativos existentes. Um admin pode restringir depois
 * pela nova UI de escopo de acesso.
 *
 * Uso:
 *   node scripts/add-whatsapp-channel-members.mjs
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
  CREATE TABLE IF NOT EXISTS whatsapp_channel_members (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id integer NOT NULL REFERENCES whatsapp_channels(id) ON DELETE CASCADE,
    user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at timestamp NOT NULL DEFAULT now(),
    UNIQUE (channel_id, user_id)
  )
`;
console.log("[migration] Tabela whatsapp_channel_members criada (ou já existente).");

const { rowCount: backfilled } = await sql.query(`
  INSERT INTO whatsapp_channel_members (channel_id, user_id)
  SELECT c.id, sm.user_id
  FROM (SELECT DISTINCT user_id FROM whatsapp_sector_members) sm
  CROSS JOIN whatsapp_channels c
  WHERE c.is_active = true
  ON CONFLICT (channel_id, user_id) DO NOTHING
`);
console.log(
  `[migration] Backfill: ${backfilled} concessão(ões) de canal criada(s) para usuários já membros de algum setor.`,
);

console.log("[migration] Concluído.");
