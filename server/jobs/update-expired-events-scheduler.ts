import cron, { type ScheduledTask } from "node-cron";
import { pool } from "../db";
import { startOfTodayInSaoPaulo, SAO_PAULO_TZ } from "@shared/sao-paulo-date";

const UPDATE_EXPIRED_EVENTS_LOCK_KEY = 727_100_003;

type Logger = Pick<Console, "log" | "error">;

export interface ExpiredEventsJobController {
  catchUp: Promise<number>;
  stop(): Promise<void>;
}

export interface ExpiredEventsJobOptions {
  now?: () => Date;
  update?: (now: Date) => Promise<number>;
  logger?: Logger;
}

/**
 * Finaliza eventos de dias anteriores em uma transação protegida entre réplicas.
 * Erros são propagados para que o chamador nunca registre sucesso falso.
 */
export async function updateExpiredEvents(now: Date = new Date()): Promise<number> {
  const cutoff = startOfTodayInSaoPaulo(now);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const lockResult = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_xact_lock($1) AS locked",
      [UPDATE_EXPIRED_EVENTS_LOCK_KEY],
    );

    if (!lockResult.rows[0]?.locked) {
      await client.query("ROLLBACK");
      return 0;
    }

    const result = await client.query(
      `UPDATE events
       SET status = 'finalizado', updated_at = NOW()
       WHERE event_date < $1
         AND status IN ('planejado', 'ativo')`,
      [cutoff],
    );
    await client.query("COMMIT");
    return result.rowCount ?? 0;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("[ExpiredEvents] Erro ao reverter transação:", rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

async function runAndLog(
  update: (now: Date) => Promise<number>,
  now: () => Date,
  logger: Logger,
): Promise<number> {
  const startedAt = Date.now();
  try {
    const updatedCount = await update(now());
    logger.log(
      `[ExpiredEvents] Concluído em ${Date.now() - startedAt}ms; ${updatedCount} evento(s) finalizado(s).`,
    );
    return updatedCount;
  } catch (error) {
    logger.error(
      `[ExpiredEvents] Falha após ${Date.now() - startedAt}ms:`,
      error,
    );
    throw error;
  }
}

/** Registra o cron e inicia imediatamente a reconciliação de startup. */
export function startUpdateExpiredEventsJob(
  options: ExpiredEventsJobOptions = {},
): ExpiredEventsJobController {
  const now = options.now ?? (() => new Date());
  const update = options.update ?? updateExpiredEvents;
  const logger = options.logger ?? console;

  const task: ScheduledTask = cron.schedule(
    "0 0 * * *",
    async () => {
      try {
        await runAndLog(update, now, logger);
      } catch {
        // runAndLog já registrou a falha; o próximo tick deve continuar ativo.
      }
    },
    {
      timezone: SAO_PAULO_TZ,
      noOverlap: true,
      name: "update-expired-events",
    },
  );

  return {
    catchUp: runAndLog(update, now, logger),
    async stop(): Promise<void> {
      await task.stop();
    },
  };
}
