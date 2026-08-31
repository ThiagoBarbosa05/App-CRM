import cron from "node-cron";
import { pool } from "../db";

export async function runWhatsappMessageAuditRetention(retentionDays = Number(process.env.WHATSAPP_AUDIT_RETENTION_DAYS) || 30): Promise<{ statuses: number; decryption: number }> {
  const startedAt = Date.now();
  const statuses = await pool.query("DELETE FROM whatsapp_status_audit WHERE created_at < now() - ($1::text || ' days')::interval", [retentionDays]);
  const decryption = await pool.query("DELETE FROM whatsapp_decryption_incidents WHERE created_at < now() - ($1::text || ' days')::interval", [retentionDays]);
  console.info(`[Baileys Audit] Retenção concluída: statuses=${statuses.rowCount ?? 0}, decryption=${decryption.rowCount ?? 0}, durationMs=${Date.now() - startedAt}`);
  return { statuses: statuses.rowCount ?? 0, decryption: decryption.rowCount ?? 0 };
}

cron.schedule("15 3 * * *", () => runWhatsappMessageAuditRetention().catch((error) => console.error("[Baileys Audit] Falha na retenção:", error)));
