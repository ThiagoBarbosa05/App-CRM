import { pool } from "server/db";
import { toMetaWhatsAppId } from "@shared/phone";

const LOCK_NAMESPACE = "whatsapp-bot-session";

/**
 * Serializa transições de uma sessão de bot por contato em todas as réplicas.
 * O lock é mantido na mesma conexão PostgreSQL até a transição terminar.
 */
export async function withWhatsappBotSessionLock<T>(
  phone: string,
  operation: () => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  const normalizedPhone = toMetaWhatsAppId(phone);

  try {
    await client.query(
      "SELECT pg_advisory_lock(hashtext($1), hashtext($2))",
      [LOCK_NAMESPACE, normalizedPhone],
    );
    return await operation();
  } finally {
    await client
      .query(
        "SELECT pg_advisory_unlock(hashtext($1), hashtext($2))",
        [LOCK_NAMESPACE, normalizedPhone],
      )
      .catch((error: unknown) => console.error("[WaBot] Falha ao liberar lock da sessão:", error));
    client.release();
  }
}
