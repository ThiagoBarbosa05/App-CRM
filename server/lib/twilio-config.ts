import { db } from "server/db";
import { systemSettings } from "@shared/schema";
import { inArray } from "drizzle-orm";

type Channel = { label: string; number: string };

async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const rows = await db
    .select()
    .from(systemSettings)
    .where(inArray(systemSettings.key, keys));
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;
  return map;
}

export async function getTwilioConfig() {
  const s = await getSettings([
    "twilio_account_sid",
    "twilio_auth_token",
    "twilio_from_number",
  ]);
  return {
    accountSid:
      s["twilio_account_sid"] || process.env.TWILIO_ACCOUNT_SID || "",
    authToken: s["twilio_auth_token"] || process.env.TWILIO_AUTH_TOKEN || "",
    fromNumber:
      s["twilio_from_number"] || process.env.TWILIO_FROM_NUMBER || "",
  };
}

export async function getTwilioVoiceSdkConfig() {
  const s = await getSettings([
    "twilio_api_key",
    "twilio_api_secret",
    "twilio_twiml_app_sid",
  ]);
  return {
    apiKey: s["twilio_api_key"] || process.env.TWILIO_API_KEY || "",
    apiSecret: s["twilio_api_secret"] || process.env.TWILIO_API_SECRET || "",
    twimlAppSid:
      s["twilio_twiml_app_sid"] || process.env.TWILIO_TWIML_APP_SID || "",
  };
}

export async function getTwilioChannels(): Promise<Channel[]> {
  const s = await getSettings(["twilio_from_numbers", "twilio_from_number"]);
  const json = s["twilio_from_numbers"] || process.env.TWILIO_FROM_NUMBERS;
  if (json) {
    try {
      return JSON.parse(json) as Channel[];
    } catch {
      // fall through to single number
    }
  }
  const single = s["twilio_from_number"] || process.env.TWILIO_FROM_NUMBER;
  if (single) return [{ label: "Principal", number: single }];
  return [];
}

export async function getElevenLabsKey(): Promise<string> {
  const s = await getSettings(["elevenlabs_api_key"]);
  return s["elevenlabs_api_key"] || process.env.ELEVENLABS_API_KEY || "";
}

export async function getElevenLabsVoiceId(): Promise<string | null> {
  const s = await getSettings(["elevenlabs_voice_id"]);
  return s["elevenlabs_voice_id"] || process.env.ELEVENLABS_VOICE_ID || null;
}

export async function isRecordCallsEnabled(): Promise<boolean> {
  const s = await getSettings(["twilio_record_calls"]);
  const val = s["twilio_record_calls"] || process.env.TWILIO_RECORD_CALLS;
  return val === "true";
}

export async function getServerBaseUrl(): Promise<string> {
  const s = await getSettings(["server_base_url"]);
  return (
    s["server_base_url"] ||
    process.env.SERVER_BASE_URL ||
    "http://localhost:5000"
  );
}

export async function getTwilioIntelligenceServiceSid(): Promise<
  string | null
> {
  const s = await getSettings(["twilio_intelligence_service_sid"]);
  return (
    s["twilio_intelligence_service_sid"] ||
    process.env.TWILIO_INTELLIGENCE_SERVICE_SID ||
    null
  );
}

/** Converte número BR (10 ou 11 dígitos) para E.164 (+55...) */
export function toE164Brazil(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  return `+${digits}`;
}
