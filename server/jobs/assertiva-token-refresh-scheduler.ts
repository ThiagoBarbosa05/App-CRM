import cron from "node-cron";
import { ensureFreshToken } from "../services/assertiva.service";

cron.schedule(
  "*/5 * * * *",
  async () => {
    await ensureFreshToken();
  },
  {
    timezone: "America/Sao_Paulo",
  },
);

ensureFreshToken().catch(() => {
  // Erros já são registrados via getAssertivaStatus(); o cron não deve falhar na inicialização.
});
