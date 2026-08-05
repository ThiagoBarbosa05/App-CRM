/**
 * Cancela campanhas "órfãs" de whatsapp_campaigns: linhas com status
 * 'created' ou 'in_progress' cujo id não tem correspondente em `campaigns`
 * (linhas legadas do Umbler Talk, ou qualquer outro caso de valor de id
 * compartilhado quebrado). Sem essa correção o dispatcher (runTick) fica
 * tentando disparar essas campanhas a cada tick, para sempre, mesmo depois
 * do innerJoin ter parado de selecioná-las — o innerJoin evita que NOVAS
 * execuções peguem essas linhas, mas não corrige o estado das que já estão
 * presas hoje.
 *
 * Uso (somente relatório, não altera nada):
 *   node scripts/fix-wa-campaign-orphans-and-stale-impacts.mjs
 *
 * Uso (aplica o cancelamento):
 *   node scripts/fix-wa-campaign-orphans-and-stale-impacts.mjs --apply
 *
 * Uso (banco de teste):
 *   TEST_DATABASE_URL="..." node scripts/fix-wa-campaign-orphans-and-stale-impacts.mjs
 *
 * NOTA: este script é estruturado para ser estendido — uma task futura
 * (liberação de impacts presos) adiciona uma seção própria aqui.
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

// ─── Seção 1: campanhas órfãs (whatsapp_campaigns sem campaigns correspondente) ───

async function fixOrphanCampaigns() {
  const orphans = await sql`
    SELECT wc.id, wc.title, wc.status
    FROM whatsapp_campaigns wc
    WHERE wc.status IN ('created', 'in_progress')
      AND NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.id = wc.id)
  `;

  console.log(
    `[fix-wa-campaign-orphans] ${orphans.length} campanha(s) órfã(s) encontrada(s) (whatsapp_campaigns sem linha correspondente em campaigns).`,
  );

  for (const row of orphans) {
    console.log(`  id=${row.id} title=${row.title ?? "(sem título)"} status=${row.status}`);
  }

  if (!apply) {
    console.log(
      "\n[fix-wa-campaign-orphans] Modo dry-run — nenhuma alteração aplicada. Rode com --apply para cancelar as campanhas órfãs.",
    );
    return;
  }

  await sql`
    UPDATE whatsapp_campaigns wc
    SET status = 'cancelled', completed_at = NOW(), updated_at = NOW()
    WHERE wc.status IN ('created', 'in_progress')
      AND NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.id = wc.id)
  `;

  console.log(`\n[fix-wa-campaign-orphans] ${orphans.length} campanha(s) órfã(s) marcada(s) como 'cancelled'.`);
}

await fixOrphanCampaigns();

if (!apply) {
  process.exit(0);
}
