/**
 * Catálogo único dos processos de background.
 *
 * Antes cada job registrava seu próprio `cron.schedule` como efeito colateral
 * de import dentro do processo web. Isso custava caro no Autoscale (o
 * container nunca podia dormir) e, pior, era pouco confiável: um serviço que
 * escala a zero não tem cron nenhum rodando quando está desligado.
 *
 * Agora as expressões cron moram aqui e são consumidas por dois caminhos:
 *  - produção: um Replit Scheduled Deployment por grupo, chamando
 *    `npm run job -- <grupo>` (ver server/worker.ts);
 *  - desenvolvimento: `startInProcessScheduler()`, para `npm run dev`
 *    continuar sendo um processo só.
 *
 * Os imports são dinâmicos de propósito: um grupo pequeno não deve pagar o
 * custo de carregar todos os serviços do CRM só porque estão no mesmo arquivo.
 */

export interface JobGroup {
  /** Identificador passado na linha de comando: `npm run job -- minute`. */
  name: string;
  /** Expressão cron do Scheduled Deployment correspondente. */
  cron: string;
  /** Timezone da expressão. Toda regra de negócio do CRM é São Paulo. */
  timezone: string;
  description: string;
  run: () => Promise<void>;
}

/**
 * Roda os jobs de um grupo em sequência, sem deixar a falha de um impedir os
 * demais. Cada job já trata seus próprios erros; isto é a rede de segurança.
 */
async function runAll(jobs: Array<[string, () => Promise<unknown>]>): Promise<void> {
  for (const [label, job] of jobs) {
    try {
      await job();
    } catch (error) {
      console.error(`[worker] job "${label}" falhou:`, error);
    }
  }
}

export const JOB_GROUPS: JobGroup[] = [
  {
    name: "bootstrap",
    // Sem cron: é sob demanda. Rodava no boot do processo web, o que com
    // scale-to-zero significaria repetir seed e migrações a cada vez que o
    // Autoscale acordasse o container. Todas são idempotentes, então rodar de
    // novo é seguro — só não deve ser automático.
    cron: "",
    timezone: "America/Sao_Paulo",
    description:
      "Seed de países e migrações de dados. Executar manualmente após um deploy que mude o schema.",
    run: async () => {
      const [countries, winery, category, pdv, orderClient, quotes] = await Promise.all([
        import("./seed-countries"),
        import("./migrate-winery-goals"),
        import("./migrate-category-goals"),
        import("./migrate-pdv-settings"),
        import("./migrate-order-client"),
        import("./migrate-quotes"),
      ]);
      await runAll([
        ["seed-countries", countries.seedCountries],
        ["migrate-winery-goals", winery.migrateWineryGoals],
        ["migrate-category-goals", category.migrateCategoryGoals],
        ["migrate-pdv-settings", pdv.migratePdvSettings],
        ["migrate-order-client", orderClient.migrateOrderClient],
        ["migrate-quotes", quotes.migrateQuotes],
      ]);
    },
  },
  {
    name: "minute",
    cron: "* * * * *",
    timezone: "America/Sao_Paulo",
    description:
      "Disparo de campanhas, timeouts de template, retomada de sessões de bot e retentativa de webhooks do gateway.",
    run: async () => {
      const [wa, email, sms, voice, templates, resume, inbox] = await Promise.all([
        import("./whatsapp-campaign-dispatcher"),
        import("./email-campaign-dispatcher"),
        import("./sms-campaign-dispatcher"),
        import("./campaign-dispatcher"),
        import("./template-timeouts.job"),
        import("./resume-bot-sessions.job"),
        import("../services/baileys-gateway-webhook-inbox.service"),
      ]);
      await runAll([
        // Devolve à fila os eventos presos em 'processing' por um container que
        // morreu no meio do processamento, antes de tentar drenar.
        ["recover-gateway-webhooks", inbox.recoverStuckGatewayWebhooks],
        ["drain-gateway-webhooks", inbox.processGatewayWebhookInboxBatch],
        ["whatsapp-campaigns", wa.runWhatsappCampaignDispatchTick],
        ["email-campaigns", email.runEmailCampaignDispatchTick],
        ["sms-campaigns", sms.runSmsCampaignDispatchTick],
        ["voice-campaigns", voice.runVoiceCampaignDispatchTick],
        ["template-timeouts", templates.runTemplateTimeoutsTick],
        ["resume-bot-sessions", resume.runResumeBotSessionsJobTick],
      ]);
    },
  },
  {
    name: "frequent",
    cron: "*/5 * * * *",
    timezone: "America/Sao_Paulo",
    description:
      "Expiração de sessões de bot, retry de comandas no Bling e automações de aniversário do dia.",
    run: async () => {
      const [expire, bling, birthday] = await Promise.all([
        import("./expire-bot-sessions.job"),
        import("./bling-sales-order-sync-scheduler"),
        import("./birthday-job-scheduler"),
      ]);
      await runAll([
        ["expire-bot-sessions", expire.runExpireBotSessionsTick],
        ["bling-sales-order-sync", bling.retryPendingBlingSyncs],
        ["birthday-automations", birthday.runBirthdayAutomations],
      ]);
    },
  },
  {
    name: "quarter",
    cron: "*/15 * * * *",
    timezone: "America/Sao_Paulo",
    description:
      "Reconciliação de status dos canais com o Baileys Gateway e refresh dos tokens Bling e Assertiva.",
    run: async () => {
      const [reconcile, bling, assertiva] = await Promise.all([
        import("./reconcile-baileys-status.job"),
        import("./bling-token-refresh-scheduler"),
        import("./assertiva-token-refresh-scheduler"),
      ]);
      await runAll([
        ["reconcile-baileys-status", reconcile.runReconcileBaileysStatusTick],
        ["bling-token-refresh", bling.refreshBlingConnections],
        ["assertiva-token-refresh", assertiva.refreshAssertivaToken],
      ]);
    },
  },
  {
    name: "daily-night",
    cron: "0 0 * * *",
    timezone: "America/Sao_Paulo",
    description: "Finaliza eventos cuja data já passou.",
    run: async () => {
      const events = await import("./update-expired-events-scheduler");
      await runAll([["update-expired-events", events.updateExpiredEvents]]);
    },
  },
  {
    name: "daily-rfm",
    cron: "0 3 * * *",
    timezone: "America/Sao_Paulo",
    description:
      "Recalcula os scores RFM. Roda de madrugada porque faz um UPDATE por cliente.",
    run: async () => {
      const rfm = await import("./rfm-recalculate-scheduler");
      await runAll([["rfm-recalculate", rfm.recalculateRfm]]);
    },
  },
  {
    name: "daily-morning",
    cron: "0 8 * * *",
    timezone: "America/Sao_Paulo",
    description:
      "Rotinas de início do dia útil: cashback a vencer, alertas de orçamento, reengajamento e fila do Copiloto.",
    run: async () => {
      const [cashback, quotes, reengagement, copiloto] = await Promise.all([
        import("./cashback-automation-scheduler"),
        import("./quote-expiry-alert-scheduler"),
        import("./reengagement-automation-scheduler"),
        import("./copiloto-scan-scheduler"),
      ]);
      await runAll([
        ["cashback-expiring", cashback.checkCashbackExpiringReminders],
        ["quote-alerts", quotes.runQuoteAlerts],
        ["inactivity-reengagement", reengagement.checkInactivityReengagement],
        // Depende do RFM recalculado às 3h (sinal de campeão silencioso lê
        // clients.rfm_segment), por isso vem depois no mesmo grupo da manhã.
        ["copiloto-scan", copiloto.scanCopiloto],
      ]);
    },
  },
];

export function findJobGroup(name: string): JobGroup | undefined {
  return JOB_GROUPS.find((group) => group.name === name);
}
