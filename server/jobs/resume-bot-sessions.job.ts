import { resumeWaitingSessions } from "../services/whatsapp-bot-engine.service";
import { pool } from "../db";
import { LOCK_KEYS } from "./lock-keys";

const RESUME_BOT_SESSIONS_LOCK_KEY = LOCK_KEYS.resumeBotSessions;

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

/**
 * Retoma as sessões pausadas por um nó Aguardar.
 *
 * Rodava a cada 5 segundos dentro do processo web — ~17 mil conexões ao
 * Postgres por dia, quase todas sem nada a fazer. Agora roda a cada minuto no
 * worker de background: um nó Aguardar pode atrasar até 1 min, o que é
 * irrelevante para uma pausa que costuma ser de minutos ou horas.
 */
export async function runResumeBotSessionsJobTick(): Promise<void> {
  try {
    const count = await runResumeBotSessionsTick();
    if (count > 0) {
      console.log(`[ResumeBotSessions] ${count} sessão(ões) retomada(s)`);
    }
  } catch (err) {
    console.error("[ResumeBotSessions] Erro:", err);
  }
}
