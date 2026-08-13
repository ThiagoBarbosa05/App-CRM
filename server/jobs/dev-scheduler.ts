import cron from "node-cron";
import { JOB_GROUPS } from "./registry";

/**
 * Agenda os grupos de jobs dentro do próprio processo.
 *
 * Serve para o desenvolvimento (`npm run dev`), onde subir seis Scheduled
 * Deployments não faz sentido. Em produção isto fica desligado: o processo web
 * roda no Autoscale e precisa poder escalar a zero, e um cron em memória
 * impediria exatamente isso.
 *
 * Controlado por APP_ROLE — ver server/index.ts.
 */
export function startInProcessScheduler(): void {
  // `cron` vazio marca grupo sob demanda (ex.: bootstrap) — não se agenda.
  const scheduled = JOB_GROUPS.filter((group) => group.cron !== "");

  for (const group of scheduled) {
    let running = false;
    cron.schedule(
      group.cron,
      async () => {
        // Um tick que passou do intervalo não deve empilhar com o próximo.
        if (running) return;
        running = true;
        try {
          await group.run();
        } catch (error) {
          console.error(`[scheduler] grupo "${group.name}" falhou:`, error);
        } finally {
          running = false;
        }
      },
      { timezone: group.timezone },
    );
  }

  console.log(
    `[scheduler] ${scheduled.length} grupo(s) de jobs agendados no processo: ` +
      scheduled.map((g) => `${g.name} (${g.cron})`).join(", "),
  );
}
