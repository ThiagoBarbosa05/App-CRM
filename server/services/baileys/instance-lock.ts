import { Pool, type PoolClient } from "@neondatabase/serverless";

// Pool dedicado e pequeno só para locks: cada lock adquirido retém uma conexão
// pelo tempo de vida do socket Baileys, então não pode competir com o pool
// principal da aplicação (server/db.ts), cujo `max: 10` é usado por todas as
// queries normais do app.
const lockPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

lockPool.on("error", (err: Error) => {
  console.error("[Baileys lock] Erro inesperado na conexão de lock:", err);
});

/**
 * Tenta adquirir um advisory lock do Postgres para a instância. Mantém uma
 * conexão dedicada e RETIDA (fora do pool) enquanto o lock estiver em uso —
 * é essa mesma conexão que deve ser passada para releaseInstanceLock().
 *
 * Se o processo cair, a conexão cai junto e o Postgres libera o lock
 * automaticamente: nenhuma outra réplica fica bloqueada por um dono morto.
 *
 * Retorna null se outro processo já é dono do lock desta instância.
 */
export async function tryAcquireInstanceLock(instanceName: string): Promise<PoolClient | null> {
  const client = await lockPool.connect();
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS locked",
      [instanceName],
    );
    if (!rows[0]?.locked) {
      client.release();
      return null;
    }
    return client;
  } catch (err) {
    client.release();
    throw err;
  }
}

/**
 * Libera o advisory lock e devolve a conexão dedicada ao pool. Best-effort —
 * se o client já caiu (conexão morta), apenas ignora.
 */
export async function releaseInstanceLock(instanceName: string, client: PoolClient): Promise<void> {
  try {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [instanceName]);
  } catch {
    // conexão pode já estar morta — sem problema, o Postgres libera o lock
    // sozinho quando a conexão cai
  } finally {
    try { client.release(); } catch { /* ignore */ }
  }
}
