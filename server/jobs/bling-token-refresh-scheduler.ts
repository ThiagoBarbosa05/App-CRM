import cron from "node-cron";
import { runBlingTokenMaintenance } from "./bling-token-maintenance.worker";

const BLING_TOKEN_MAINTENANCE_CRON =
  process.env.BLING_TOKEN_MAINTENANCE_CRON?.trim() || "30 3 * * *";

async function runMaintenanceSafely(source: "cron" | "startup"): Promise<void> {
  try {
    await runBlingTokenMaintenance();
  } catch (error: unknown) {
    console.error(
      `[Bling Token Maintenance] Falha na execucao via ${source}:`,
      error,
    );
  }
}

cron.schedule(
  BLING_TOKEN_MAINTENANCE_CRON,
  async () => {
    await runMaintenanceSafely("cron");
  },
  { timezone: "America/Sao_Paulo" },
);

// O processo pode estar desligado no horario do cron em ambientes Autoscale.
// A selecao por vencimento e os advisory locks tornam este catch-up seguro
// quando mais de uma replica inicia ao mesmo tempo.
void runMaintenanceSafely("startup");
