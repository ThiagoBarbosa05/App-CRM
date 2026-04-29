import { Router, Request, Response } from "express";
import twilio from "twilio";
import { db } from "server/db";
import { calls, systemSettings } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  getTwilioConfig,
  getTwilioVoiceSdkConfig,
  getTwilioChannels,
  getServerBaseUrl,
  isRecordCallsEnabled,
  toE164Brazil,
} from "../lib/twilio-config";

const router = Router();

// ─── Token JWT para Twilio Voice SDK ─────────────────────────────────────────

router.get("/token", async (req: Request, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    const sdk = await getTwilioVoiceSdkConfig();
    if (!sdk.apiKey || !sdk.apiSecret || !sdk.twimlAppSid) {
      return res.status(400).json({ message: "Voice SDK não configurado" });
    }
    const userId = req.user.userId;
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: sdk.twimlAppSid,
      incomingAllow: false,
    });
    const token = new AccessToken(
      (await getTwilioConfig()).accountSid,
      sdk.apiKey,
      sdk.apiSecret,
      { identity: `operator_${userId}`, ttl: 3600 }
    );
    token.addGrant(voiceGrant);

    res.json({ token: token.toJwt(), identity: `operator_${userId}` });
  } catch (e) {
    console.error("[twilio] token error:", e);
    res.status(500).json({ message: "Erro ao gerar token" });
  }
});

// ─── Status do Voice SDK ──────────────────────────────────────────────────────

router.get("/voice-sdk-status", async (_req: Request, res: Response) => {
  try {
    const sdk = await getTwilioVoiceSdkConfig();
    const configured = !!(sdk.apiKey && sdk.apiSecret && sdk.twimlAppSid);
    res.json({ configured });
  } catch (e) {
    res.status(500).json({ message: "Erro ao verificar status" });
  }
});

// ─── Canais de saída ──────────────────────────────────────────────────────────

router.get("/channels", async (_req: Request, res: Response) => {
  try {
    const channels = await getTwilioChannels();
    res.json(channels);
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar canais" });
  }
});

// ─── TwiML Voice — webhook público ───────────────────────────────────────────
// Registrado como público em index.ts (antes do requireAuth)

router.post("/voice", async (req: Request, res: Response) => {
  try {
    const { accountSid, authToken } = await getTwilioConfig();
    const signatureHeader = req.headers["x-twilio-signature"] as string;
    const baseUrl = await getServerBaseUrl();
    const fullUrl = `${baseUrl}/api/twilio/voice`;

    if (process.env.NODE_ENV === "production" && accountSid && authToken) {
      const valid = twilio.validateRequest(
        authToken,
        signatureHeader,
        fullUrl,
        req.body
      );
      if (!valid) return res.status(403).send("Forbidden");
    }

    const { campaignType, agentId, voiceId, callRecordId } = req.query as Record<string, string>;
    const twiml = new twilio.twiml.VoiceResponse();

    if (campaignType === "ia" && agentId) {
      const elevenLabsUrl =
        "https://api.elevenlabs.io/v1/convai/twilio/inbound_call";
      const body: Record<string, string> = { agent_id: agentId };

      const { fromNumber } = await getTwilioConfig();
      if (fromNumber) body["agent_phone_number_id"] = fromNumber;

      const override: Record<string, unknown> = {};
      if (voiceId) override["tts"] = { voice_id: voiceId };

      if (Object.keys(override).length > 0) {
        body["conversation_config_override"] = JSON.stringify(override);
      }

      const response = await fetch(elevenLabsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        twiml.say({ language: "pt-BR" }, "Serviço indisponível.");
        res.type("text/xml").send(twiml.toString());
        return;
      }

      const twimlText = await response.text();

      // Extrai conversation_id do TwiML retornado pela ElevenLabs
      const match = twimlText.match(/conversation_id=([^&"]+)/);
      if (match && callRecordId) {
        const conversationId = match[1];
        await db
          .update(calls)
          .set({ elevenLabsConversationId: conversationId })
          .where(eq(calls.id, callRecordId));
      }

      res.type("text/xml").send(twimlText);
      return;
    }

    // Chamada humana
    const to = (req.body.To || req.query.to) as string;
    const callerId =
      (req.body.callerId as string) ||
      (req.query.callerId as string) ||
      (await getTwilioConfig()).fromNumber;

    if (!to) {
      twiml.say({ language: "pt-BR" }, "Número de destino não informado.");
      res.type("text/xml").send(twiml.toString());
      return;
    }

    const recordCalls = await isRecordCallsEnabled();
    const dial = twiml.dial({
      callerId,
      ...(recordCalls && {
        record: "record-from-answer-dual",
        recordingStatusCallback: `${baseUrl}/api/calls/recording-status`,
        recordingStatusCallbackMethod: "POST",
      }),
    });
    dial.number(to);

    res.type("text/xml").send(twiml.toString());
  } catch (e) {
    console.error("[twilio] voice error:", e);
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ language: "pt-BR" }, "Erro interno.");
    res.type("text/xml").send(twiml.toString());
  }
});

// ─── Iniciar chamada pelo operador ───────────────────────────────────────────

router.post("/outbound-call", async (req: Request, res: Response) => {
  try {
    const { to, callerId, callRecordId } = req.body as {
      to: string;
      callerId?: string;
      callRecordId?: string;
    };

    if (!to) return res.status(400).json({ message: "Número de destino obrigatório" });

    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }

    const baseUrl = await getServerBaseUrl();
    const from = callerId || config.fromNumber;
    const e164 = toE164Brazil(to);

    const params: Record<string, string> = {};
    if (callRecordId) params.callRecordId = callRecordId;

    const client = twilio(config.accountSid, config.authToken);
    const call = await client.calls.create({
      to: e164,
      from,
      url: `${baseUrl}/api/twilio/voice?${new URLSearchParams(params)}`,
      statusCallback: `${baseUrl}/api/calls/twilio-status`,
      statusCallbackMethod: "POST",
    });

    if (callRecordId) {
      await db
        .update(calls)
        .set({ twilioCallSid: call.sid, status: "iniciando" })
        .where(eq(calls.id, callRecordId));
    }

    res.json({ callSid: call.sid, status: call.status });
  } catch (e: unknown) {
    console.error("[twilio] outbound-call error:", e);
    const message = e instanceof Error ? e.message : "Erro ao iniciar chamada";
    res.status(500).json({ message });
  }
});

// ─── Polling de status de chamada ─────────────────────────────────────────────

router.get("/calls/:callSid/status", async (req: Request, res: Response) => {
  try {
    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }
    const client = twilio(config.accountSid, config.authToken);
    const call = await client.calls(req.params.callSid).fetch();
    res.json({ status: call.status, duration: call.duration });
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar status" });
  }
});

// ─── Encerrar chamada ─────────────────────────────────────────────────────────

router.delete("/calls/:callSid", async (req: Request, res: Response) => {
  try {
    const config = await getTwilioConfig();
    const client = twilio(config.accountSid, config.authToken);
    await client.calls(req.params.callSid).update({ status: "completed" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Erro ao encerrar chamada" });
  }
});

// ─── Proxy de gravação ────────────────────────────────────────────────────────

router.get("/recording/:callId", async (req: Request, res: Response) => {
  try {
    const [callRecord] = await db
      .select()
      .from(calls)
      .where(eq(calls.id, req.params.callId));

    if (!callRecord?.recordingUrl) {
      return res.status(404).json({ message: "Gravação não encontrada" });
    }

    const config = await getTwilioConfig();
    const url = callRecord.recordingUrl.endsWith(".mp3")
      ? callRecord.recordingUrl
      : `${callRecord.recordingUrl}.mp3`;

    const upstream = await fetch(url, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
      },
    });

    res.setHeader("Content-Type", "audio/mpeg");
    const buffer = await upstream.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar gravação" });
  }
});

export default router;
