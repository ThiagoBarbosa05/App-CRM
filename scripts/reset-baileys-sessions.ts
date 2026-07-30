import "dotenv/config";
import { Pool } from "@neondatabase/serverless";

const CONFIRMATION = "RESET-BAILEYS";
const execute = process.argv.includes("--execute");
const confirmation = process.argv
  .find((arg) => arg.startsWith("--confirm="))
  ?.slice("--confirm=".length);

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL não configurada");
}

if (execute && confirmation !== CONFIRMATION) {
  throw new Error(
    `Execução recusada. Use --execute --confirm=${CONFIRMATION}`,
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  connectionTimeoutMillis: 10_000,
});

interface ChannelRow {
  id: number;
  name: string;
  evolution_instance_name: string;
  qr_backend: string;
  connection_status: string | null;
}

interface GatewayInstance {
  name: string;
}

async function listChannels(): Promise<ChannelRow[]> {
  const { rows } = await pool.query(
    `SELECT id, name, evolution_instance_name, qr_backend, connection_status
       FROM whatsapp_channels
      WHERE provider='evolution' AND evolution_instance_name IS NOT NULL
      ORDER BY id`,
  );
  return rows as ChannelRow[];
}

async function count(table: string): Promise<number> {
  const allowed = new Set([
    "whatsapp_baileys_auth",
    "baileys_gateway_auth",
    "baileys_gateway_instances",
    "baileys_gateway_webhook_outbox",
    "baileys_gateway_idempotency",
    "baileys_gateway_webhook_inbox",
    "whatsapp_channel_connection_events",
  ]);
  if (!allowed.has(table)) throw new Error("Tabela não permitida");
  const { rows } = await pool.query(`SELECT count(*)::int AS count FROM ${table}`);
  return Number((rows[0] as { count?: number } | undefined)?.count ?? 0);
}

async function stopGatewayInstances(): Promise<void> {
  const baseUrl = process.env.GATEWAY_URL?.replace(/\/+$/, "");
  const apiKey = process.env.GATEWAY_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error(
      "GATEWAY_URL e GATEWAY_API_KEY são obrigatórios para encerrar os sockets com segurança",
    );
  }
  const headers = { Authorization: `Bearer ${apiKey}` };
  const response = await fetch(`${baseUrl}/v1/instances`, {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Gateway indisponível: HTTP ${response.status}`);
  }
  const instances = (await response.json()) as GatewayInstance[];
  for (const instance of instances) {
    const logout = await fetch(
      `${baseUrl}/v1/instances/${encodeURIComponent(instance.name)}/logout`,
      {
        method: "POST",
        headers,
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!logout.ok) {
      throw new Error(
        `Falha ao encerrar "${instance.name}" no gateway: HTTP ${logout.status}`,
      );
    }
  }
}

async function notifyEmbeddedShutdown(channels: ChannelRow[]): Promise<void> {
  for (const channel of channels) {
    await pool.query("SELECT pg_notify($1, $2)", [
      "baileys_instance_cmd",
      JSON.stringify({
        instanceName: channel.evolution_instance_name,
        action: "logout",
      }),
    ]);
  }
  await new Promise((resolve) => setTimeout(resolve, 2_000));
}

async function assertInstanceLocksFree(channels: ChannelRow[]): Promise<void> {
  for (const channel of channels) {
    const client = await pool.connect();
    try {
      const result = await client.query(
        "SELECT pg_try_advisory_lock(hashtext($1)) AS locked",
        [channel.evolution_instance_name],
      );
      if (!(result.rows[0] as { locked?: boolean } | undefined)?.locked) {
        throw new Error(
          `A instância "${channel.evolution_instance_name}" ainda está ativa em outro processo. Pare todos os processos CRM/gateway e tente novamente.`,
        );
      }
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [
        channel.evolution_instance_name,
      ]);
    } finally {
      client.release();
    }
  }
}

async function reset(channels: ChannelRow[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const lock = await client.query(
      "SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked",
      ["baileys-reset-all-sessions"],
    );
    if (!(lock.rows[0] as { locked?: boolean } | undefined)?.locked) {
      throw new Error("Outra limpeza de sessões já está em execução");
    }

    await client.query(
      `DELETE FROM whatsapp_channel_connection_events
        WHERE channel_id IN (
          SELECT id FROM whatsapp_channels WHERE provider='evolution'
        )`,
    );
    await client.query("DELETE FROM baileys_gateway_webhook_inbox");
    await client.query("DELETE FROM baileys_gateway_webhook_outbox");
    await client.query("DELETE FROM baileys_gateway_idempotency");
    await client.query("DELETE FROM baileys_gateway_auth");
    await client.query("DELETE FROM whatsapp_baileys_auth");
    await client.query("DELETE FROM baileys_gateway_instances");
    await client.query(
      `INSERT INTO baileys_gateway_instances(
         name, desired_state, observed_state, connected_phone, last_error
       )
       SELECT evolution_instance_name, 'stopped', 'disconnected', NULL, NULL
         FROM whatsapp_channels
        WHERE provider='evolution' AND evolution_instance_name IS NOT NULL
       ON CONFLICT(name) DO UPDATE SET
         desired_state='stopped',
         observed_state='disconnected',
         connected_phone=NULL,
         last_error=NULL,
         updated_at=now()`,
    );
    await client.query(
      `UPDATE whatsapp_channels
          SET qr_backend='gateway', connection_status='disconnected'
        WHERE provider='evolution'`,
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const channels = await listChannels();
  const tables = [
    "whatsapp_baileys_auth",
    "baileys_gateway_auth",
    "baileys_gateway_instances",
    "baileys_gateway_webhook_outbox",
    "baileys_gateway_idempotency",
    "baileys_gateway_webhook_inbox",
    "whatsapp_channel_connection_events",
  ];
  const counts = Object.fromEntries(
    await Promise.all(
      tables.map(async (table) => [table, await count(table)] as const),
    ),
  );

  console.log(
    JSON.stringify(
      {
        mode: execute ? "execute" : "preview",
        channels: channels.map((channel) => ({
          id: channel.id,
          name: channel.name,
          instance: channel.evolution_instance_name,
          currentBackend: channel.qr_backend,
          currentStatus: channel.connection_status,
        })),
        rowsToClear: counts,
        preserved:
          "mensagens, conversas, mídias, contatos, vendedores, setores e configurações dos canais",
      },
      null,
      2,
    ),
  );

  if (!execute) {
    console.log(
      `\nPré-visualização concluída. Para executar: npm run baileys:sessions:reset -- --execute --confirm=${CONFIRMATION}`,
    );
    return;
  }

  await stopGatewayInstances();
  await notifyEmbeddedShutdown(channels);
  await assertInstanceLocksFree(channels);
  await reset(channels);
  console.log(
    `Limpeza concluída: ${channels.length} canal(is) pronto(s) para novo QR pelo gateway.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(
      "Falha ao limpar sessões:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
