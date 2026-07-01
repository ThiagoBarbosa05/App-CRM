/**
 * Resolve duplicatas em whatsapp_campaign_messages (linhas repetidas para o
 * mesmo par campaign_id+contact_id, geradas antes da constraint única existir
 * — ex: usuário clicando "disparar" duas vezes) e então cria o índice único
 * wa_campaign_messages_campaign_contact_uidx que impede novas duplicatas.
 *
 * Uso (somente relatório, não altera nada):
 *   node scripts/fix-wa-campaign-dispatch-integrity.mjs
 *
 * Uso (aplica a resolução de duplicatas e cria o índice):
 *   node scripts/fix-wa-campaign-dispatch-integrity.mjs --apply
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/fix-wa-campaign-dispatch-integrity.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL ou TEST_DATABASE_URL no .env");
  process.exit(1);
}

const apply = process.argv.includes("--apply");
const sql = neon(url);

// Rank de "quão avançada" uma mensagem está — mantém a mais avançada, cancela o resto.
const STATUS_RANK = { read: 5, delivered: 4, sent: 3, scheduled: 2, failed: 1, cancelled: 0 };

const duplicateGroups = await sql`
  SELECT campaign_id, contact_id, array_agg(id ORDER BY created_at) AS ids, array_agg(status ORDER BY created_at) AS statuses
  FROM whatsapp_campaign_messages
  WHERE contact_id IS NOT NULL
  GROUP BY campaign_id, contact_id
  HAVING count(*) > 1
`;

console.log(`[fix-wa-campaign-dispatch-integrity] ${duplicateGroups.length} par(es) campaign_id+contact_id duplicado(s) encontrado(s).`);

let cancelledCount = 0;
for (const group of duplicateGroups) {
  const { campaign_id, contact_id, ids, statuses } = group;
  const rows = ids.map((id, i) => ({ id, status: statuses[i] }));
  rows.sort((a, b) => (STATUS_RANK[b.status] ?? 0) - (STATUS_RANK[a.status] ?? 0));
  const [keep, ...rest] = rows;

  console.log(
    `  campaign=${campaign_id} contact=${contact_id}: mantém ${keep.id} (${keep.status}), cancela ${rest.length} duplicata(s) [${rest.map((r) => `${r.id}:${r.status}`).join(", ")}]`,
  );

  if (apply) {
    for (const r of rest) {
      await sql`
        UPDATE whatsapp_campaign_messages
        SET status = 'cancelled', error_message = 'Duplicata resolvida por migração', updated_at = now()
        WHERE id = ${r.id}
      `;
      cancelledCount++;
    }
  }
}

if (!apply) {
  console.log("\n[fix-wa-campaign-dispatch-integrity] Modo dry-run — nenhuma alteração aplicada. Rode com --apply para resolver as duplicatas e criar o índice único.");
  process.exit(0);
}

console.log(`\n[fix-wa-campaign-dispatch-integrity] ${cancelledCount} linha(s) duplicada(s) marcada(s) como 'cancelled'.`);

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS wa_campaign_messages_campaign_contact_uidx
  ON whatsapp_campaign_messages (campaign_id, contact_id)
  WHERE contact_id IS NOT NULL
`;

console.log("[fix-wa-campaign-dispatch-integrity] Índice único wa_campaign_messages_campaign_contact_uidx criado (ou já existia).");
