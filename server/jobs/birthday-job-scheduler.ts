import cron from "node-cron";
import { sendBirthdayMessagesScheduled } from "./send-birthday-mensage";

// Agenda para rodar a cada hora (produção)
cron.schedule("*/2 * * * *", async () => {
  console.log("[Scheduler] Executando verificação de aniversariantes...");
  try {
    await sendBirthdayMessagesScheduled();
    console.log(
      "[Scheduler] Verificação de aniversariantes concluída com sucesso.",
    );
  } catch (error) {
    console.error("[Scheduler] Erro na verificação de aniversariantes:", error);
  }
});

// Agenda para rodar a cada 2 minutos (desenvolvimento/teste)
if (process.env.NODE_ENV === "development") {
  cron.schedule("*/2 * * * *", async () => {
    console.log(
      "[Scheduler - DEV] Executando verificação de aniversariantes (modo desenvolvimento)...",
    );
    try {
      await sendBirthdayMessagesScheduled();
      console.log(
        "[Scheduler - DEV] Verificação de aniversariantes concluída com sucesso.",
      );
    } catch (error) {
      console.error(
        "[Scheduler - DEV] Erro na verificação de aniversariantes:",
        error,
      );
    }
  });
}

// Mantém o processo rodando
console.log(
  "[Scheduler] Birthday job scheduler iniciado. Produção: a cada hora no minuto 0. Desenvolvimento: a cada 2 minutos.",
);
