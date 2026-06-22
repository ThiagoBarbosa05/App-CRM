import { Pool } from "@neondatabase/serverless";
import { initAuthCreds, BufferJSON } from "@whiskeysockets/baileys";
import type { AuthenticationState, SignalDataTypeMap } from "@whiskeysockets/baileys";

export async function useNeonAuthState(
  pool: Pool,
  instanceName: string,
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const write = async (key: string, data: unknown) => {
    const json = JSON.stringify(data, BufferJSON.replacer);
    await pool.query(
      `INSERT INTO whatsapp_baileys_auth (instance_name, data_key, data_value)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (instance_name, data_key) DO UPDATE SET data_value = EXCLUDED.data_value`,
      [instanceName, key, json],
    );
  };

  const read = async (key: string): Promise<unknown> => {
    const { rows } = await pool.query(
      `SELECT data_value FROM whatsapp_baileys_auth WHERE instance_name = $1 AND data_key = $2`,
      [instanceName, key],
    );
    if (!rows[0]) return null;
    return JSON.parse(JSON.stringify(rows[0].data_value), BufferJSON.reviver);
  };

  const del = async (keys: string[]) => {
    if (keys.length === 0) return;
    await pool.query(
      `DELETE FROM whatsapp_baileys_auth WHERE instance_name = $1 AND data_key = ANY($2)`,
      [instanceName, keys],
    );
  };

  const creds = ((await read("__creds__")) ?? initAuthCreds()) as AuthenticationState["creds"];

  const state: AuthenticationState = {
    creds,
    keys: {
      get: async (type, ids) => {
        const data: { [id: string]: SignalDataTypeMap[typeof type] } = {};
        await Promise.all(
          ids.map(async (id) => {
            const val = await read(`${type}:${id}`);
            if (val != null) data[id] = val as SignalDataTypeMap[typeof type];
          }),
        );
        return data;
      },
      set: async (dataMap) => {
        const toDelete: string[] = [];
        const toWrite: Array<[string, unknown]> = [];
        for (const category of Object.keys(dataMap) as (keyof SignalDataTypeMap)[]) {
          for (const [id, value] of Object.entries(dataMap[category] ?? {})) {
            const dbKey = `${String(category)}:${id}`;
            if (value == null) toDelete.push(dbKey);
            else toWrite.push([dbKey, value]);
          }
        }
        await Promise.all([del(toDelete), ...toWrite.map(([k, v]) => write(k, v))]);
      },
    },
  };

  return {
    state,
    saveCreds: () => write("__creds__", creds),
  };
}

export async function getInstancesWithCreds(pool: Pool): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT instance_name FROM whatsapp_baileys_auth WHERE data_key = '__creds__'`,
  );
  return rows.map((r: { instance_name: string }) => r.instance_name);
}

export async function deleteInstanceCreds(pool: Pool, instanceName: string): Promise<void> {
  await pool.query(`DELETE FROM whatsapp_baileys_auth WHERE instance_name = $1`, [instanceName]);
}
