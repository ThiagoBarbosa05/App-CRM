import cron from "node-cron";
import { resumeWaitingSessions } from "../services/whatsapp-bot-engine.service";
import { pool } from "../db";

const RESUME_BOT_SESSIONS_LOCK_KEY = 727_100_002;

export async function runResumeBotSessionsTick(): Promise<number> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [RESUME_BOT_SESSIONS_LOCK_KEY],
    );
    if (!rows[0]?.locked) return 0;
    try {
      return await resumeWaitingSessions();
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [RESUME_BOT_SESSIONS_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

// Verifica a cada cinco segundos as sessões pausadas por um nó Aguardar. A trava
// compartilhada impede retomada duplicada quando há mais de uma instância.
export function startResumeBotSessionsJob() {
  let running = false;
  cron.schedule("*/5 * * * * *", async () => {
    if (running) return;
    running = true;
    try {
      const count = await runResumeBotSessionsTick();
      if (count > 0) {
        console.log(`[ResumeBotSessions] ${count} sessão(ões) retomada(s)`);
      }
    } catch (err) {
      console.error("[ResumeBotSessions] Erro:", err);
    } finally {
      running = false;
    }
  });
}
