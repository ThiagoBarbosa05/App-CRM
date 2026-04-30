import { db, settingsTable } from "@workspace/db";

export function toE164Brazil(phone: string): string {
const digits = phone.replace(/\D/g, "");
if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
if (digits.length === 11) return `+55${digits}`;
if (digits.length === 10) return `+55${digits}`;
return `+${digits}`;
}

export interface TwilioConfig {
accountSid: string;
authToken: string;
fromNumber: string;
statusCallbackUrl: string | null;
}

export interface TwilioVoiceSdkConfig {
accountSid: string;
apiKey: string;
apiSecret: string;
twimlAppSid: string;
fromNumber: string;
}

export interface TwilioChannel {
label: string;
number: string;
}

async function getSettingsMap(): Promise<Record<string, string | null>> {
const rows = await db.select().from(settingsTable);
const map: Record<string, string | null> = {};
for (const row of rows) {
map[row.key] = row.value;
}
return map;
}

export async function getTwilioConfig(): Promise<TwilioConfig | null> {
const settings = await getSettingsMap();
const get = (key: string) => settings[key] || null;

const accountSid =
get("twilio_account_sid") || process.env.TWILIO_ACCOUNT_SID || null;
const authToken =
get("twilio_auth_token") || process.env.TWILIO_AUTH_TOKEN || null;
const fromNumber =
get("twilio_from_number") || process.env.TWILIO_FROM_NUMBER || null;
const statusCallbackUrl =
get("twilio_status_callback_url") ||
process.env.TWILIO_STATUS_CALLBACK_URL ||
null;

if (!accountSid || !authToken || !fromNumber) return null;
return { accountSid, authToken, fromNumber, statusCallbackUrl };
}

export async function getTwilioVoiceSdkConfig(): Promise<TwilioVoiceSdkConfig | null> {
const settings = await getSettingsMap();
const get = (key: string) => settings[key] || null;

const accountSid =
get("twilio_account_sid") || process.env.TWILIO_ACCOUNT_SID || null;
const apiKey = get("twilio_api_key") || process.env.TWILIO_API_KEY || null;
const apiSecret =
get("twilio_api_secret") || process.env.TWILIO_API_SECRET || null;
const twimlAppSid =
get("twilio_twiml_app_sid") || process.env.TWILIO_TWIML_APP_SID || null;
const fromNumber =
get("twilio_from_number") || process.env.TWILIO_FROM_NUMBER || null;

if (!accountSid || !apiKey || !apiSecret || !twimlAppSid || !fromNumber)
return null;
return { accountSid, apiKey, apiSecret, twimlAppSid, fromNumber };
}

export async function getTwilioChannels(): Promise<TwilioChannel[]> {
const settings = await getSettingsMap();
const raw = settings["twilio_from_numbers"];
const channels: TwilioChannel[] = [];

if (raw) {
try {
const parsed = JSON.parse(raw);
if (Array.isArray(parsed)) {
for (const item of parsed) {
const label =
typeof item?.label === "string" ? item.label.trim() : "";
const number =
typeof item?.number === "string" ? item.number.trim() : "";
if (label && number)
channels.push({ label, number: toE164Brazil(number) });
}
}
} catch (\_) {
// fall through to default
}
}

if (channels.length === 0) {
const fallback =
settings["twilio_from_number"] || process.env.TWILIO_FROM_NUMBER || null;
if (fallback)
channels.push({ label: "Padrão", number: toE164Brazil(fallback) });
}

return channels;
}

export async function isRecordCallsEnabled(): Promise<boolean> {
const settings = await getSettingsMap();
const value = settings["twilio_record_calls"] || "";
return value === "true" || value === "1";
}

export async function getOpenAiKey(): Promise<string | null> {
const settings = await getSettingsMap();
return settings["openai_api_key"] || process.env.OPENAI_API_KEY || null;
}

export async function getElevenLabsKey(): Promise<string | null> {
const settings = await getSettingsMap();
return (
settings["elevenlabs_api_key"] || process.env.ELEVENLABS_API_KEY || null
);
}

export async function getElevenLabsVoiceId(): Promise<string | null> {
const settings = await getSettingsMap();
return (
settings["elevenlabs_voice_id"] || process.env.ELEVENLABS_VOICE_ID || null
);
}

export async function getServerBaseUrl(): Promise<string | null> {
const settings = await getSettingsMap();
return settings["server_base_url"] || process.env.SERVER_BASE_URL || null;
}

export async function getTwilioIntelligenceServiceSid(): Promise<
string | null

> {
> const settings = await getSettingsMap();
> return settings["twilio_intelligence_service_sid"] || null;
> }
