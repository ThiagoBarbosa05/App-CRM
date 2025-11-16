import cron from "node-cron";
import {
  sendBirthdayMessages,
  sendBirthdayMessagesForAutomation,
} from "./send-birthday-mensage";
import { getAllMessageAutomationSettings } from "../db/functions/get-message-automation-settings";
import {
  recordExecution,
  wasExecutedToday,
} from "./automation-execution-tracker";
import { executeTodaysAutomations } from "./automation-catchup";

// Mapa para armazenar os jobs ativos
const activeJobs = new Map<string, any>();

/**
 * Converte horário HH:mm para expressão cron
 * @param timeString - Horário no formato "HH:mm" (ex: "09:30")
 * @returns Expressão cron no formato "mm HH * * *"
 */
function convertTimeToCron(timeString: string): string {
  const [hours, minutes] = timeString.split(":");
  return `${minutes} ${hours} * * *`;
}

/**
 * Cria ou atualiza os jobs de aniversário baseados nas configurações do banco
 */
async function setupBirthdayJobs(): Promise<void> {
  try {
    console.log("[Scheduler] Configurando jobs de aniversário...");

    // Buscar todas as automações do banco
    const automations = await getAllMessageAutomationSettings();
    const activeAutomations = automations.filter(
      (automation) => automation.enabled
    );

    // Cancelar todos os jobs existentes
    activeJobs.forEach((job, key) => {
      console.log(`[Scheduler] Cancelando job existente: ${key}`);
      job.destroy();
    });
    activeJobs.clear();

    // Criar novos jobs baseados nas configurações
    activeAutomations.forEach((automation) => {
      const cronExpression = convertTimeToCron(automation.sendTime);
      const jobKey = `automation_${automation.id}`;

      console.log(
        `[Scheduler] Criando job para automação ${automation.id}: ${automation.daysBefore} dias antes, horário ${automation.sendTime} (cron: ${cronExpression})`
      );

      const job = cron.schedule(
        cronExpression,
        async () => {
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(
            today.getMonth() + 1
          ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

          console.log(
            `[Scheduler] Executando automação específica ${automation.id} - ${automation.daysBefore} dias antes do aniversário às ${automation.sendTime}`
          );

          // Verificar se já foi executada hoje (evitar duplicatas)
          const alreadyExecuted = await wasExecutedToday(
            automation.id,
            todayStr
          );
          if (alreadyExecuted) {
            console.log(
              `[Scheduler] Automação ${automation.id} já foi executada hoje - pulando`
            );
            return;
          }

          let messagesSent = 0;
          let messagesFailed = 0;
          let status: "success" | "partial" | "failed" = "success";
          let error: string | undefined;

          try {
            // CORREÇÃO: Processar apenas esta automação específica
            await sendBirthdayMessagesForAutomation(automation.id);
            messagesSent = 1; // TODO: Obter métricas reais
            status = "success";
            console.log(
              `[Scheduler] Automação ${automation.id} concluída com sucesso.`
            );
          } catch (err) {
            console.error(
              `[Scheduler] Erro na automação ${automation.id}:`,
              err
            );
            messagesFailed = 1;
            status = "failed";
            error = err instanceof Error ? err.message : String(err);
          } finally {
            // Registrar execução
            await recordExecution({
              automationId: automation.id,
              executionDate: todayStr,
              scheduledTime: automation.sendTime,
              status,
              messagesProcessed: messagesSent + messagesFailed,
              messagesSent,
              messagesFailed,
              error,
              triggeredBy: "cron",
            });
          }
        },
        {
          timezone: "America/Sao_Paulo", // Ajuste para o timezone apropriado
        }
      );

      activeJobs.set(jobKey, job);
    });

    console.log(
      `[Scheduler] ${activeJobs.size} job(s) de aniversário configurado(s) com sucesso.`
    );
  } catch (error) {
    console.error("[Scheduler] Erro ao configurar jobs de aniversário:", error);
  }
}

/**
 * Job para reconfigurar os schedulers a cada hora
 * Isso garante que mudanças nas configurações sejam aplicadas
 */
cron.schedule("0 * * * *", async () => {
  console.log("[Scheduler] Recarregando configurações de automação...");
  await setupBirthdayJobs();
});

// Job de desenvolvimento que roda a cada 5 minutos para teste
if (process.env.NODE_ENV === "development") {
  cron.schedule("*/5 * * * *", async () => {
    console.log(
      "[Scheduler - DEV] Recarregando configurações de automação (desenvolvimento)..."
    );
    await setupBirthdayJobs();
  });
}

// Configurar jobs iniciais
setupBirthdayJobs()
  .then(() => {
    console.log(
      "[Scheduler] Birthday job scheduler iniciado com configuração dinâmica."
    );
    // Executar catch-up ao iniciar (recuperar execuções perdidas)
    console.log("[Scheduler] Executando catch-up inicial...");
    return executeTodaysAutomations();
  })
  .then((result) => {
    console.log(
      `[Scheduler] Catch-up inicial concluído: ${result.executedAutomations} automações executadas`
    );
  })
  .catch((error) => {
    console.error("[Scheduler] Erro ao iniciar scheduler:", error);
  });

// Função para reconfigurar jobs externamente (útil para APIs)
export { setupBirthdayJobs };
