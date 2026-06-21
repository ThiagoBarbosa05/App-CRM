import { db } from "server/db";
import { whatsappSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

export const WA_KEYS = [
  "wa_phone_number_id",
  "wa_access_token",
  "wa_waba_id",
  "wa_app_id",
  "wa_webhook_verify_token",
  "wa_api_version",
  "wa_enabled",
  "wa_message_delay_ms",
] as const;

export type WaKey = (typeof WA_KEYS)[number];

const SENSITIVE_KEYS = new Set<WaKey>([
  "wa_phone_number_id",
  "wa_access_token",
  "wa_webhook_verify_token",
]);

export const MASK = "••••••••";

function maskValue(key: string, value: string): string {
  if (SENSITIVE_KEYS.has(key as WaKey) && value) return MASK;
  return value;
}

export async function getWhatsappSettingsForClient(): Promise<Record<string, string>> {
  const rows = await db.select().from(whatsappSettings);
  const result: Record<string, string> = Object.fromEntries(WA_KEYS.map((k) => [k, ""]));
  for (const row of rows) {
    result[row.key] = maskValue(row.key, row.value);
  }
  return result;
}

export async function getWhatsappSettingsRaw(): Promise<Record<string, string>> {
  const rows = await db.select().from(whatsappSettings);
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export async function upsertWhatsappSetting(key: string, value: string): Promise<void> {
  if (SENSITIVE_KEYS.has(key as WaKey) && (value === MASK || value.trim() === "")) return;
  await db
    .insert(whatsappSettings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: whatsappSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function getWhatsappStatus(): Promise<{ enabled: boolean; configured: boolean }> {
  const raw = await getWhatsappSettingsRaw();
  const enabled = raw["wa_enabled"] === "true";
  const configured = !!(raw["wa_phone_number_id"] && raw["wa_access_token"] && raw["wa_waba_id"]);
  return { enabled, configured };
}
