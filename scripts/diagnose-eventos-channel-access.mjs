/**
 * Diagnóstico (somente leitura): por que o usuário "Televendas" não recebe
 * mensagens do canal "Eventos" mesmo aparecendo com acesso ao setor e ao canal.
 *
 * Verifica: dados do canal, dados do usuário, membership de setor, membership
 * de canal (whatsapp_channel_members) e estado da conversa do número
 * 21989014965.
 *
 * Uso:
 *   node scripts/diagnose-eventos-channel-access.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

console.log("\n=== 1. Canal(is) 'Eventos' ===");
const channels = await sql.query(`
  SELECT id, name, user_id, default_sector_id, connection_status, is_active, evolution_instance_name, deleted_at
  FROM whatsapp_channels
  WHERE name ILIKE '%eventos%'
`);
console.table(channels.rows ?? channels);

console.log("\n=== 2. Usuário(s) 'Televendas' ===");
const users = await sql.query(`
  SELECT id, name, email, role
  FROM users
  WHERE name ILIKE '%televendas%' OR email ILIKE '%televendas%'
`);
console.table(users.rows ?? users);

const userRows = users.rows ?? users;
const channelRows = channels.rows ?? channels;

if (userRows.length === 0) {
  console.log("\nNenhum usuário 'Televendas' encontrado — abortando checagens dependentes.");
  process.exit(0);
}

for (const user of userRows) {
  console.log(`\n=== 3. Membership de setor — usuário ${user.name} (${user.id}) ===`);
  const sectorMembers = await sql.query(
    `SELECT sm.*, s.name AS sector_name
     FROM whatsapp_sector_members sm
     JOIN whatsapp_sectors s ON s.id = sm.sector_id
     WHERE sm.user_id = $1`,
    [user.id],
  );
  console.table(sectorMembers.rows ?? sectorMembers);

  console.log(`\n=== 4. Membership de canal (whatsapp_channel_members) — usuário ${user.name} (${user.id}) ===`);
  const channelMembers = await sql.query(
    `SELECT cm.*, c.name AS channel_name
     FROM whatsapp_channel_members cm
     JOIN whatsapp_channels c ON c.id = cm.channel_id
     WHERE cm.user_id = $1`,
    [user.id],
  );
  console.table(channelMembers.rows ?? channelMembers);

  if (channelRows.length > 0) {
    const eventosIds = channelRows.map((c) => c.id);
    const ownsEventos = channelRows.some((c) => c.user_id === user.id);
    const memberRows = channelMembers.rows ?? channelMembers;
    const hasGrant = memberRows.some((m) => eventosIds.includes(m.channel_id));
    console.log(
      `  -> Dono de algum canal Eventos? ${ownsEventos} | Tem grant explícito em whatsapp_channel_members? ${hasGrant}`,
    );
  }
}

console.log("\n=== 5. Conversa(s) do número 21989014965 ===");
const conversations = await sql.query(`
  SELECT id, phone, channel_id, sector_id, assigned_agent_id, status, created_at
  FROM whatsapp_conversations
  WHERE phone LIKE '%989014965%'
  ORDER BY created_at DESC
`);
console.table(conversations.rows ?? conversations);

const conversationRows = conversations.rows ?? conversations;
const involvedChannelIds = [...new Set(conversationRows.map((c) => c.channel_id))];
if (involvedChannelIds.length > 0) {
  console.log(`\n=== 6. Canais reais das conversas encontradas (ids: ${involvedChannelIds.join(", ")}) ===`);
  const involvedChannels = await sql.query(
    `SELECT id, name, user_id, default_sector_id, connection_status, is_active, evolution_instance_name, deleted_at
     FROM whatsapp_channels
     WHERE id = ANY($1)`,
    [involvedChannelIds],
  );
  console.table(involvedChannels.rows ?? involvedChannels);
}

console.log("\nDiagnóstico concluído.");
