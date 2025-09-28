import { setupBirthdayJobs } from "./birthday-job-scheduler";

/**
 * Função para reconfigurar os schedulers após mudanças nas configurações
 * Esta função pode ser chamada pelas APIs de configuração
 */
export async function reconfigureBirthdayScheduler(): Promise<void> {
  console.log("[Reconfigure] Reconfigurando schedulers de aniversário...");
  try {
    await setupBirthdayJobs();
    console.log("[Reconfigure] Schedulers reconfigurados com sucesso.");
  } catch (error) {
    console.error("[Reconfigure] Erro ao reconfigurar schedulers:", error);
    throw error;
  }
}
