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
 * Libera impacts 'reserved' presos por um bug antigo de reserveCampaignMessage
 * (Bug D): o insert de whatsapp_campaign_messages usava .onConflictDoNothing()
 * sem .returning(), então o código não sabia se a linha realmente foi
 * inserida — e sempre criava um whatsapp_campaign_impacts 'reserved' quando
 * não havia conflito de dedupe por fingerprint, mesmo quando a mensagem
 * colidiu (índice único campanha+contato, ou corrida de duplo clique) e não
 * foi inserida de fato. Esse impact 'reserved' fica órfão: nunca é liberado
 * porque markImpactSent/releaseImpact só rodam a partir do processamento da
 * mensagem real (outra linha), e bloqueia campanhas futuras para o mesmo
 * telefone+conteúdo dentro da janela de dedupe. Esta seção libera esses
 * impacts presos identificando os que apontam para uma mensagem que já
 * terminou em estado não-processável (failed/cancelled/suppressed).
 *
 * NOTA: este script é estruturado para ser estendido.
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

// ─── Seção 2: impacts 'reserved' presos por mensagens que não avançam mais ───

async function fixStuckImpacts() {
  const stuck = await sql`
    SELECT wci.id, wci.campaign_id, wci.campaign_message_id, wci.phone_normalized, wci.status
    FROM whatsapp_campaign_impacts wci
    WHERE wci.status = 'reserved'
      AND EXISTS (
        SELECT 1 FROM whatsapp_campaign_messages wcm
        WHERE wcm.id = wci.campaign_message_id
          AND wcm.status IN ('failed', 'cancelled', 'suppressed')
      )
  `;

  console.log(
    `\n[fix-wa-stale-impacts] ${stuck.length} impact(s) 'reserved' preso(s) encontrado(s) (mensagem correspondente já em failed/cancelled/suppressed).`,
  );

  for (const row of stuck) {
    console.log(
      `  id=${row.id} campaignId=${row.campaign_id} campaignMessageId=${row.campaign_message_id} phone=${row.phone_normalized}`,
    );
  }

  if (!apply) {
    console.log(
      "\n[fix-wa-stale-impacts] Modo dry-run — nenhuma alteração aplicada. Rode com --apply para liberar os impacts presos.",
    );
    return;
  }

  await sql`
    UPDATE whatsapp_campaign_impacts wci
    SET status = 'released', updated_at = NOW()
    WHERE wci.status = 'reserved'
      AND EXISTS (
        SELECT 1 FROM whatsapp_campaign_messages wcm
        WHERE wcm.id = wci.campaign_message_id
          AND wcm.status IN ('failed', 'cancelled', 'suppressed')
      )
  `;

  console.log(`\n[fix-wa-stale-impacts] ${stuck.length} impact(s) preso(s) marcado(s) como 'released'.`);
}

await fixStuckImpacts();

if (!apply) {
  process.exit(0);
}
