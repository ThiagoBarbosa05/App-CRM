import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import "dotenv/config";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });

// Chave de agrupamento por telefone: ignora não-dígitos e o DDI 55 (BR), para
// que "5554..." e "54..." caiam no mesmo grupo (mesma lógica do findOrCreate).
function normKey(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
}

async function backfillLidPhones() {
  console.log("\n== 1) Backfill de telefone p/ conversas com número LID ==");
  // Mensagens antigas do Baileys guardaram a key original: remoteJid = <lid>@lid
  // e remoteJidAlt = <telefone>@s.whatsapp.net. Usamos o alt p/ recuperar o real.
  const { rows } = await pool.query<{ conv_id: string; alt: string }>(`
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id AS conv_id,
      m.raw_payload->'key'->>'remoteJidAlt' AS alt
    FROM whatsapp_messages m
    WHERE m.raw_payload->'key'->>'remoteJid' LIKE '%@lid'
      AND m.raw_payload->'key'->>'remoteJidAlt' LIKE '%@s.whatsapp.net'
    ORDER BY m.conversation_id, m.created_at ASC
  `);

  for (const r of rows) {
    const phone = String(r.alt).split("@")[0].split(":")[0].replace(/\D/g, "");
    if (!phone) continue;
    const norm = normKey(phone);
    const { rows: cli } = await pool.query<{ id: string }>(
      `SELECT id FROM clients
       WHERE regexp_replace(phone, '\\D', '', 'g') = $1
          OR regexp_replace(phone, '\\D', '', 'g') = $2
          OR '55' || regexp_replace(phone, '\\D', '', 'g') = $1
       LIMIT 1`,
      [phone, norm],
    );
    if (cli[0]) {
      await pool.query(
        `UPDATE whatsapp_conversations SET phone = $1, client_id = COALESCE(client_id, $3) WHERE id = $2`,
        [phone, r.conv_id, cli[0].id],
      );
    } else {
      await pool.query(`UPDATE whatsapp_conversations SET phone = $1 WHERE id = $2`, [phone, r.conv_id]);
    }
    console.log(`  conversa ${r.conv_id}: phone → ${phone}${cli[0] ? " (cliente vinculado)" : ""}`);
  }
  console.log(`  ${rows.length} conversa(s) processada(s).`);
}

async function mergeByPhone() {
  console.log("\n== 2) Merge de conversas duplicadas por telefone ==");
  const { rows: convs } = await pool.query<{ id: string; phone: string; client_id: string | null }>(
    `SELECT id, phone, client_id FROM whatsapp_conversations ORDER BY created_at ASC`,
  );

  const groups = new Map<string, { id: string; client_id: string | null }[]>();
  for (const c of convs) {
    const key = normKey(c.phone);
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(c);
    groups.set(key, list);
  }

  let merged = 0;
  for (const [, list] of groups) {
    if (list.length < 2) continue;
    const canonical = list[0]; // mais antiga (ordenado asc)
    for (const dup of list.slice(1)) {
      // Reatribui mensagens
      await pool.query(`UPDATE whatsapp_messages SET conversation_id = $1 WHERE conversation_id = $2`, [canonical.id, dup.id]);
      // Reads têm unique(user_id, conversation_id): remove os que conflitariam, depois reatribui
      await pool.query(
        `DELETE FROM whatsapp_conversation_reads r
         WHERE r.conversation_id = $2
           AND EXISTS (SELECT 1 FROM whatsapp_conversation_reads r2 WHERE r2.conversation_id = $1 AND r2.user_id = r.user_id)`,
        [canonical.id, dup.id],
      );
      await pool.query(`UPDATE whatsapp_conversation_reads SET conversation_id = $1 WHERE conversation_id = $2`, [canonical.id, dup.id]);
      // Herda client_id se a canônica não tiver
      await pool.query(
        `UPDATE whatsapp_conversations SET client_id = COALESCE(client_id, $2) WHERE id = $1`,
        [canonical.id, dup.client_id],
      );
      await pool.query(`DELETE FROM whatsapp_conversations WHERE id = $1`, [dup.id]);
      console.log(`  ${dup.id} → ${canonical.id}`);
      merged++;
    }
  }
  console.log(`  ${merged} conversa(s) duplicada(s) mescladas.`);
}

async function reportUnresolved() {
  console.log("\n== 3) Conversas sem cliente vinculado (revisar manualmente) ==");
  const { rows } = await pool.query<{ id: string; phone: string }>(
    `SELECT id, phone FROM whatsapp_conversations WHERE client_id IS NULL ORDER BY created_at ASC`,
  );
  if (rows.length === 0) {
    console.log("  Nenhuma.");
  } else {
    for (const r of rows) console.log(`  ${r.id}  phone=${r.phone}`);
    console.log(`  ${rows.length} conversa(s) sem cliente — verifique se são LID não resolvidos.`);
  }
}

async function main() {
  await backfillLidPhones();
  await mergeByPhone();
  await reportUnresolved();
  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro no merge:", err);
  process.exit(1);
});
