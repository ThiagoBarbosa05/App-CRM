import { db } from "server/db";
import { systemSettings } from "@shared/schema";
import { inArray } from "drizzle-orm";

async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await db
    .select()
    .from(systemSettings)
    .where(inArray(systemSettings.key, keys));
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export async function getSendGridConfig() {
  // Lê tanto as chaves novas quanto as antigas (legadas) para compatibilidade
  const s = await getSettings([
    "sendgrid_api_key",
    "sendgrid_from_email",
    "sendgrid_from_name",
    "marketing_sendgrid_api_key",
    "marketing_sendgrid_from_email",
    "marketing_sendgrid_from_name",
  ]);
  return {
    apiKey:
      s["sendgrid_api_key"] ||
      s["marketing_sendgrid_api_key"] ||
      process.env.SENDGRID_API_KEY ||
      "",
    fromEmail:
      s["sendgrid_from_email"] ||
      s["marketing_sendgrid_from_email"] ||
      process.env.SENDGRID_FROM_EMAIL ||
      "",
    fromName:
      s["sendgrid_from_name"] ||
      s["marketing_sendgrid_from_name"] ||
      process.env.SENDGRID_FROM_NAME ||
      "Marketing",
  };
}
