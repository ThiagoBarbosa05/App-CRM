import { Router } from "express";
import { db } from "server/db";
import { systemSettings } from "@shared/schema";
import { inArray } from "drizzle-orm";
import twilio from "twilio";

const router = Router();

const TELEPHONY_KEYS = [
  "twilio_account_sid",
  "twilio_auth_token",
  "twilio_from_number",
  "twilio_api_key",
  "twilio_api_secret",
  "twilio_twiml_app_sid",
  "twilio_status_callback_url",
  "twilio_record_calls",
  "twilio_from_numbers",
  "twilio_intelligence_service_sid",
  "elevenlabs_api_key",
  "elevenlabs_voice_id",
  "server_base_url",
] as const;

const SENSITIVE_KEYS = new Set([
  "twilio_auth_token",
  "twilio_api_key",
  "twilio_api_secret",
  "elevenlabs_api_key",
]);

const MASK = "••••••••";

function maskValue(key: string, value: string): string {
  if (SENSITIVE_KEYS.has(key) && value) return MASK;
  return value;
}

router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(systemSettings)
      .where(inArray(systemSettings.key, [...TELEPHONY_KEYS]));

    const result: Record<string, string> = {};
    for (const key of TELEPHONY_KEYS) {
      result[key] = "";
    }
    for (const row of rows) {
      result[row.key] = maskValue(row.key, row.value);
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar configurações de telefonia" });
  }
});

router.get("/status", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(systemSettings)
      .where(inArray(systemSettings.key, [...TELEPHONY_KEYS]));

    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;

    const twilio = !!(
      map["twilio_account_sid"] &&
      map["twilio_auth_token"] &&
      map["twilio_from_number"]
    );
    const elevenlabs = !!map["elevenlabs_api_key"];
    const voiceSdk = !!(
      map["twilio_api_key"] &&
      map["twilio_api_secret"] &&
      map["twilio_twiml_app_sid"]
    );

    res.json({ twilio, elevenlabs, voiceSdk });
  } catch (e) {
    res.status(500).json({ message: "Erro ao verificar status das integrações" });
  }
});

router.put("/", async (req, res) => {
  try {
    const body = req.body as Record<string, string>;
    const updates: Array<{ key: string; value: string }> = [];

    for (const key of TELEPHONY_KEYS) {
      const incoming = body[key];
      if (incoming === undefined || incoming === null) continue;
      if (SENSITIVE_KEYS.has(key) && incoming === MASK) continue;
      updates.push({ key, value: String(incoming) });
    }

    if (updates.length === 0) {
      return res.json({ updated: 0 });
    }

    await Promise.all(
      updates.map(({ key, value }) =>
        db
          .insert(systemSettings)
          .values({ key, value })
          .onConflictDoUpdate({
            target: systemSettings.key,
            set: { value },
          })
      )
    );

    res.json({ updated: updates.length });
  } catch (e) {
    res.status(500).json({ message: "Erro ao salvar configurações de telefonia" });
  }
});

router.post("/configure-voice-url", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(systemSettings)
      .where(
        inArray(systemSettings.key, [
          "twilio_account_sid",
          "twilio_auth_token",
          "twilio_twiml_app_sid",
          "server_base_url",
        ])
      );

    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;

    const { twilio_account_sid, twilio_auth_token, twilio_twiml_app_sid, server_base_url } = map;

    if (!twilio_account_sid || !twilio_auth_token || !twilio_twiml_app_sid || !server_base_url) {
      return res.status(400).json({
        message: "Preencha Account SID, Auth Token, TwiML App SID e Server Base URL antes de configurar.",
      });
    }

    const voiceUrl = `${server_base_url}/api/twilio/voice`;
    const client = twilio(twilio_account_sid, twilio_auth_token);
    await client.applications(twilio_twiml_app_sid).update({ voiceUrl });

    res.json({ success: true, voiceUrl });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro ao configurar Voice URL no Twilio";
    res.status(500).json({ message });
  }
});

export default router;
