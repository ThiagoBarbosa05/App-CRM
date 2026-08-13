/**
 * Reconfiguração dos schedulers de aniversário após mudança nas configurações.
 *
 * Virou no-op de propósito. O agendamento não vive mais em memória (um
 * `cron.schedule` por automação): o worker de background relê as automações do
 * banco a cada tick, então criar, editar ou desabilitar uma automação já passa
 * a valer no ciclo seguinte, sem nada para reconfigurar.
 *
 * A função continua exportada para os controllers de create/update/delete não
 * precisarem saber disso.
 */
export async function reconfigureBirthdayScheduler(): Promise<void> {
  // Nada a fazer — ver comentário acima.
}
