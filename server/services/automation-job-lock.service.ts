import { pool } from "server/db";

/** Executes work only when this process acquired the named PostgreSQL lock. */
export async function withAutomationJobLock(
  key: number,
  work: () => Promise<void>,
): Promise<boolean> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [key],
    );
    if (!rows[0]?.locked) return false;
    try {
      await work();
      return true;
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [key]);
    }
  } finally {
    client.release();
  }
}
