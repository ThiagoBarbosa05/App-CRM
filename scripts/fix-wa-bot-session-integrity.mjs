/**
 * Resolve sessões de bot "active" duplicadas por telefone (podem ter sido
 * criadas por uma corrida entre o SELECT de checagem e o INSERT em
 * startBotSession, antes de existir um índice único protegendo isso) e então
 * cria o índice único parcial wa_bot_sessions_active_phone_uidx, que garante
 * no máximo UMA sessão "active" por telefone.
 *
 * Uso (somente relatório, não altera nada):
 *   node scripts/fix-wa-bot-session-integrity.mjs
 *
 * Uso (aplica a resolução de duplicatas e cria o índice):
 *   node scripts/fix-wa-bot-session-integrity.mjs --apply
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/fix-wa-bot-session-integrity.mjs
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

const duplicateGroups = await sql`
  SELECT phone_number, array_agg(id ORDER BY started_at DESC) AS ids
  FROM whatsapp_bot_sessions
  WHERE status = 'active'
  GROUP BY phone_number
  HAVING count(*) > 1
`;

console.log(`[fix-wa-bot-session-integrity] ${duplicateGroups.length} telefone(s) com mais de uma sessão 'active'.`);

let closedCount = 0;
for (const group of duplicateGroups) {
  const { phone_number, ids } = group;
  const [keep, ...rest] = ids; // mais recente primeiro (started_at DESC)

  console.log(
    `  phone=${phone_number}: mantém sessão ${keep}, encerra ${rest.length} sessão(ões) mais antiga(s) [${rest.join(", ")}]`,
  );

  if (apply) {
    for (const id of rest) {
      await sql`
        UPDATE whatsapp_bot_sessions
        SET status = 'timed_out', completion_reason = 'Duplicata resolvida por migração', completed_at = now()
        WHERE id = ${id}
      `;
      closedCount++;
    }
  }
}

if (!apply) {
  console.log("\n[fix-wa-bot-session-integrity] Modo dry-run — nenhuma alteração aplicada. Rode com --apply para resolver as duplicatas e criar o índice único.");
  process.exit(0);
}

console.log(`\n[fix-wa-bot-session-integrity] ${closedCount} sessão(ões) duplicada(s) marcada(s) como 'timed_out'.`);

await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS wa_bot_sessions_active_phone_uidx
  ON whatsapp_bot_sessions (phone_number)
  WHERE status = 'active'
`;

console.log("[fix-wa-bot-session-integrity] Índice único wa_bot_sessions_active_phone_uidx criado (ou já existia).");
