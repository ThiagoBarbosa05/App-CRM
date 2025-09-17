import cron from "node-cron";
import { sendBirthdayMessagesScheduled } from "./send-birthday-mensage";

// Agenda para rodar a cada hora
cron.schedule("0 * * * *", async () => {
  console.log("[Scheduler] Executando verificação de aniversariantes...");
  await sendBirthdayMessagesScheduled();
});

// Mantém o processo rodando
console.log(
  "[Scheduler] Birthday job scheduler iniciado. Rodando a cada minuto."
);
