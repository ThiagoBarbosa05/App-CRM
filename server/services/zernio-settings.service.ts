import { db } from "server/db";
import { zernioSettings } from "@shared/schema";
import { eq } from "drizzle-orm";

export const ZERNIO_KEYS = ["zernio_api_key", "zernio_webhook_secret"] as const;

export type ZernioKey = (typeof ZERNIO_KEYS)[number];

const SENSITIVE_KEYS = new Set<ZernioKey>(["zernio_api_key", "zernio_webhook_secret"]);

export const MASK = "••••••••";

function maskValue(key: string, value: string): string {
  if (SENSITIVE_KEYS.has(key as ZernioKey) && value) return MASK;
  return value;
}

export async function getZernioSettingsForClient(): Promise<Record<string, string>> {
  const rows = await db.select().from(zernioSettings);
  const result: Record<string, string> = Object.fromEntries(ZERNIO_KEYS.map((k) => [k, ""]));
  for (const row of rows) {
    result[row.key] = maskValue(row.key, row.value);
  }
  return result;
}

export async function getZernioSettingsRaw(): Promise<Record<string, string>> {
  const rows = await db.select().from(zernioSettings);
  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export async function upsertZernioSetting(key: string, value: string): Promise<void> {
  if (SENSITIVE_KEYS.has(key as ZernioKey) && (value === MASK || value.trim() === "")) return;
  await db
    .insert(zernioSettings)
    .values({ key, value, isSensitive: SENSITIVE_KEYS.has(key as ZernioKey) })
    .onConflictDoUpdate({
      target: zernioSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

/** Banco primeiro, com fallback para a env var — quem já configurou via env var continua funcionando. */
export async function getZernioApiKey(): Promise<string> {
  const raw = await getZernioSettingsRaw();
  return raw["zernio_api_key"] || process.env.ZERNIO_API_KEY || "";
}

/** Banco primeiro, com fallback para a env var — quem já configurou via env var continua funcionando. */
export async function getZernioWebhookSecret(): Promise<string> {
  const raw = await getZernioSettingsRaw();
  return raw["zernio_webhook_secret"] || process.env.ZERNIO_WEBHOOK_SECRET || "";
}

export async function getZernioConfigured(): Promise<boolean> {
  const apiKey = await getZernioApiKey();
  return !!apiKey;
}
