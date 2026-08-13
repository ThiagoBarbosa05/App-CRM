import { pool } from "../db";

/**
 * Executa `fn` sob um advisory lock do Postgres, ou não executa nada.
 *
 * `pg_try_advisory_lock` não bloqueia: se outro processo já segura a chave,
 * retorna false na hora e este tick é pulado. É o que impede dois containers
 * (ou um tick que passou do intervalo) de disparar a mesma campanha duas vezes.
 *
 * Retorna `null` quando o lock não foi obtido, para quem chamou conseguir
 * distinguir "pulei" de "rodei e não havia trabalho".
 */
export async function withAdvisoryLock<T>(
  key: number,
  fn: () => Promise<T>,
): Promise<T | null> {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [key],
    );
    if (!rows[0]?.locked) return null;
    try {
      return await fn();
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [key]);
    }
  } finally {
    client.release();
  }
}
