import { Pool } from "@neondatabase/serverless";
import { initAuthCreds, BufferJSON } from "@whiskeysockets/baileys";
import type { AuthenticationState, SignalDataTypeMap } from "@whiskeysockets/baileys";

// Cache em memória por instância: elimina round-trips ao banco durante operações
// Signal (pre-key upload, session setup). O banco persiste em background.
const instanceCaches = new Map<string, Map<string, unknown>>();

// Fila de escrita serializada por instância. Sem isso, a conexão do WhatsApp
// dispara centenas de keys.set em paralelo, cada um abrindo sua própria conexão
// no pool do Neon (max: 10) → "timeout exceeded when trying to connect" e crash
// por unhandled rejection. Serializando, no máximo 1 conexão de auth é usada
// por vez, e as gravações são feitas em lote.
const writeQueues = new Map<string, Promise<unknown>>();

/**
 * Enfileira uma tarefa de escrita para a instância, encadeando após a anterior.
 * Retorna uma Promise que reflete o resultado desta tarefa (pode rejeitar),
 * mas a fila interna nunca quebra mesmo em caso de erro.
 */
function enqueueWrite(instanceName: string, task: () => Promise<unknown>): Promise<unknown> {
  const prev = writeQueues.get(instanceName) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(task);
  // Versão da fila que engole erros para não interromper as próximas escritas
  writeQueues.set(instanceName, next.catch(() => {}));
  return next;
}

async function loadCache(pool: Pool, instanceName: string): Promise<Map<string, unknown>> {
  if (instanceCaches.has(instanceName)) return instanceCaches.get(instanceName)!;

  const cache = new Map<string, unknown>();
  const { rows } = await pool.query(
    `SELECT data_key, data_value FROM whatsapp_baileys_auth WHERE instance_name = $1`,
    [instanceName],
  );
  for (const row of rows as { data_key: string; data_value: unknown }[]) {
    cache.set(row.data_key, JSON.parse(JSON.stringify(row.data_value), BufferJSON.reviver));
  }
  instanceCaches.set(instanceName, cache);
  return cache;
}

// Grava várias chaves em uma única query (multi-row upsert), reduzindo
// drasticamente o número de conexões abertas no pool.
function dbWriteBatch(
  pool: Pool,
  instanceName: string,
  entries: { key: string; data: unknown }[],
): Promise<unknown> {
  if (entries.length === 0) return Promise.resolve();
  const valuesSql: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  for (const { key, data } of entries) {
    valuesSql.push(`($${i++}, $${i++}, $${i++}::jsonb)`);
    params.push(instanceName, key, JSON.stringify(data, BufferJSON.replacer));
  }
  return pool.query(
    `INSERT INTO whatsapp_baileys_auth (instance_name, data_key, data_value)
     VALUES ${valuesSql.join(", ")}
     ON CONFLICT (instance_name, data_key) DO UPDATE SET data_value = EXCLUDED.data_value`,
    params,
  );
}

function dbDeleteBatch(pool: Pool, instanceName: string, keys: string[]): Promise<unknown> {
  if (keys.length === 0) return Promise.resolve();
  return pool.query(
    `DELETE FROM whatsapp_baileys_auth WHERE instance_name = $1 AND data_key = ANY($2)`,
    [instanceName, keys],
  );
}

export async function useNeonAuthState(
  pool: Pool,
  instanceName: string,
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const cache = await loadCache(pool, instanceName);

  const readCached = (key: string): unknown => cache.get(key) ?? null;

  // saveCreds é best-effort: nunca rejeita (o handler creds.update não trata
  // erros, então uma rejeição derrubaria o processo). O cache em memória é
  // atualizado de forma síncrona, garantindo reconexão correta mesmo se o DB
  // estiver lento (ex.: stream error 515 após o pareamento por QR).
  const saveCredsToDb = async (): Promise<void> => {
    cache.set("__creds__", creds);
    try {
      await enqueueWrite(instanceName, () =>
        dbWriteBatch(pool, instanceName, [{ key: "__creds__", data: creds }]),
      );
    } catch (err) {
      console.error("[Baileys auth] Falha ao persistir creds:", err);
    }
  };

  const creds = (readCached("__creds__") ?? initAuthCreds()) as AuthenticationState["creds"];

  const state: AuthenticationState = {
    creds,
    keys: {
      get: (type, ids) => {
        const data: { [id: string]: SignalDataTypeMap[typeof type] } = {};
        for (const id of ids) {
          const val = readCached(`${type}:${id}`);
          if (val != null) data[id] = val as SignalDataTypeMap[typeof type];
        }
        return Promise.resolve(data);
      },
      set: (dataMap) => {
        const toWrite: { key: string; data: unknown }[] = [];
        const toDelete: string[] = [];
        for (const category of Object.keys(dataMap) as (keyof SignalDataTypeMap)[]) {
          for (const [id, value] of Object.entries(dataMap[category] ?? {})) {
            const dbKey = `${String(category)}:${id}`;
            if (value == null) {
              cache.delete(dbKey);
              toDelete.push(dbKey);
            } else {
              cache.set(dbKey, value);
              toWrite.push({ key: dbKey, data: value });
            }
          }
        }
        // Persiste em lote, serializado e em background. O cache (síncrono) já
        // está atualizado, então retornar imediatamente é seguro.
        enqueueWrite(instanceName, () => dbWriteBatch(pool, instanceName, toWrite)).catch((err) =>
          console.error("[Baileys auth] Falha ao persistir chaves:", err),
        );
        enqueueWrite(instanceName, () => dbDeleteBatch(pool, instanceName, toDelete)).catch((err) =>
          console.error("[Baileys auth] Falha ao deletar chaves:", err),
        );
        return Promise.resolve();
      },
    },
  };

  return {
    state,
    saveCreds: saveCredsToDb,
  };
}

export async function getInstancesWithCreds(pool: Pool): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT instance_name FROM whatsapp_baileys_auth WHERE data_key = '__creds__'`,
  );
  return rows.map((r: { instance_name: string }) => r.instance_name);
}

export async function deleteInstanceCreds(pool: Pool, instanceName: string): Promise<void> {
  // Remove do cache em memória e da fila de escrita para evitar leitura/gravação
  // de dados obsoletos.
  instanceCaches.delete(instanceName);
  writeQueues.delete(instanceName);
  await pool.query(`DELETE FROM whatsapp_baileys_auth WHERE instance_name = $1`, [instanceName]);
}
