import { Router, Request, Response } from "express";
import twilio from "twilio";
import { db } from "server/db";
import { calls, systemSettings, smsCampaignMessages, smsIndividualMessages } from "@shared/schema";
import { and, eq, notInArray } from "drizzle-orm";
import {
  getTwilioConfig,
  getTwilioVoiceSdkConfig,
  getTwilioChannels,
  getServerBaseUrl,
  isRecordCallsEnabled,
  toE164Brazil,
  getElevenLabsKey,
} from "../lib/twilio-config";
import { requireAuth } from "../middleware/validation";
import { validateTwilioWebhook as validateTwilioMiddleware } from "../middleware/twilio-webhook";
import { rateLimit } from "../middleware/rate-limit";

/**
 * Versão inline para o handler `/voice` (que precisa retornar TwiML XML, não JSON).
 * Para outras rotas use o middleware `validateTwilioMiddleware` diretamente.
 */
async function validateTwilioWebhookInline(req: Request, res: Response): Promise<boolean> {
  if (process.env.TWILIO_SKIP_WEBHOOK_VERIFY === "true") return true;
  const { accountSid, authToken } = await getTwilioConfig();
  if (!accountSid || !authToken) {
    console.error("[twilio] webhook recebido sem credenciais configuradas — rejeitando");
    res.status(503).send("Twilio não configurado");
    return false;
  }
  const signatureHeader = req.headers["x-twilio-signature"] as string;
  if (!signatureHeader) {
    res.status(401).send("Assinatura ausente");
    return false;
  }
  const baseUrl = await getServerBaseUrl();
  const fullUrl = `${baseUrl}${req.originalUrl}`;
  const valid = twilio.validateRequest(authToken, signatureHeader, fullUrl, req.body);
  if (!valid) { res.status(401).send("Assinatura inválida"); return false; }
  return true;
}

const router = Router();

// ─── Token JWT para Twilio Voice SDK ─────────────────────────────────────────

router.get(
  "/token",
  requireAuth,
  rateLimit({
    windowMs: 60_000,
    max: 10,
    keyFn: (req) => `twilio-token:${req.user?.userId ?? req.ip}`,
  }),
  async (req: Request, res: Response) => {
  try {
    const sdk = await getTwilioVoiceSdkConfig();
    if (!sdk.accountSid || !sdk.apiKey || !sdk.apiSecret || !sdk.twimlAppSid) {
      return res.status(400).json({ message: "Voice SDK não configurado" });
    }
    const userId = req.user!.userId;
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: sdk.twimlAppSid,
      incomingAllow: false,
    });
    const token = new AccessToken(
      sdk.accountSid,
      sdk.apiKey,
      sdk.apiSecret,
      { identity: `operator_${userId}`, ttl: 14400 }
    );
    token.addGrant(voiceGrant);

    // Atualiza a Voice URL do TwiML App usando a URL configurada no banco (ngrok, domínio de produção, etc).
    const [config, serverBaseUrl] = await Promise.all([getTwilioConfig(), getServerBaseUrl()]);
    if (config.accountSid && config.authToken) {
      const mgmtClient = twilio(config.accountSid, config.authToken);
      mgmtClient.applications(sdk.twimlAppSid)
        .update({ voiceUrl: `${serverBaseUrl}/api/twilio/voice`, voiceMethod: "POST" })
        .catch((e) => console.warn("[twilio] Falha ao atualizar Voice URL do TwiML App:", e));
    }

    res.json({ token: token.toJwt(), identity: `operator_${userId}` });
  } catch (e) {
    console.error("[twilio] token error:", e);
    res.status(500).json({ message: "Erro ao gerar token" });
  }
});

// ─── Status do Voice SDK ──────────────────────────────────────────────────────

router.get("/voice-sdk-status", requireAuth, async (_req: Request, res: Response) => {
  try {
    const sdk = await getTwilioVoiceSdkConfig();
    const configured = !!(sdk.apiKey && sdk.apiSecret && sdk.twimlAppSid);
    res.json({ configured });
  } catch (e) {
    res.status(500).json({ message: "Erro ao verificar status" });
  }
});

// ─── Canais de saída ──────────────────────────────────────────────────────────

router.get("/channels", requireAuth, async (_req: Request, res: Response) => {
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
    const isValid = await validateTwilioWebhookInline(req, res);
    if (!isValid) return;

    // Deriva a base URL do próprio host da requisição: como o Twilio está chamando
    // este endpoint, req.headers.host já é o hostname público correto, independente
    // do que estiver configurado em server_base_url.
    const proto = (req.headers["x-forwarded-proto"] as string | undefined) || req.protocol;
    const baseUrl = `${proto}://${req.headers.host}`;
    const { campaignType, agentId, voiceId, callRecordId } = req.query as Record<string, string>;
    const twiml = new twilio.twiml.VoiceResponse();

    if (campaignType === "ia" && agentId) {
      const elevenLabsUrl = "https://api.elevenlabs.io/v1/convai/twilio/register-call";
      const elevenLabsKey = await getElevenLabsKey();
      const callSid = req.body.CallSid as string;

      const elBody = {
        agent_id: agentId,
        from_number: req.body.From as string,
        to_number: req.body.To as string,
        direction: "outbound",
        conversation_initiation_client_data: {
          dynamic_variables: { callSid, conversation_id: callSid },
          conversation_config_override: {
            ...(voiceId ? { tts: { voice_id: voiceId } } : {}),
          },
        },
      };

      console.log("[twilio/voice] Chamando ElevenLabs register-call, agent:", agentId);

      const response = await fetch(elevenLabsUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": elevenLabsKey,
        },
        body: JSON.stringify(elBody),
      });

      const twimlText = await response.text();
      console.log(`[twilio/voice] ElevenLabs register-call status: ${response.status}`);

      if (!response.ok) {
        console.error("[twilio/voice] ElevenLabs error:", twimlText);
        twiml.say({ language: "pt-BR" }, "Erro ao conectar com o agente de IA.");
        res.type("text/xml").send(twiml.toString());
        return;
      }

      // Dois padrões cobrem ambas as ordens de atributos e aspas simples/duplas
      const convIdMatch =
        twimlText.match(/name=["']conversation_id["']\s+value=["']([^"']+)["']/) ||
        twimlText.match(/value=["']([^"']+)["']\s+name=["']conversation_id["']/);

      if (convIdMatch && callSid) {
        // Atualiza via twilioCallSid — callRecordId pode não estar vinculado ainda
        db.update(calls)
          .set({ elevenLabsConversationId: convIdMatch[1] })
          .where(eq(calls.twilioCallSid, callSid))
          .catch((e) => console.error("[twilio/voice] Falha ao salvar conversation_id:", e));
      }

      // Atualizar status do registro de chamada se callRecordId fornecido.
      // Usa notInArray para não sobrescrever um status terminal já gravado pelo
      // status callback do Twilio (race condition: no-answer pode chegar antes desta promise resolver).
      if (callRecordId && callSid) {
        const TERMINAL_STATUSES = ["encerrada", "nao_atendeu", "ocupado", "falhou", "caixa_postal"] as const;
        db.update(calls)
          .set({ twilioCallSid: callSid, status: "em_andamento" })
          .where(and(eq(calls.id, callRecordId), notInArray(calls.status, [...TERMINAL_STATUSES])))
          .catch((e) => console.error("[twilio/voice] Falha ao atualizar callRecord:", e));
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

    // callRecordId pode vir da query (campanhas) ou do body (SDK do browser)
    const humanCallRecordId =
      callRecordId || (req.body.callRecordId as string | undefined);
    const parentCallSid = req.body.CallSid as string;

    console.log(`[twilio/voice] Chamada humana | parentCallSid: ${parentCallSid} | humanCallRecordId: ${humanCallRecordId ?? "(ausente)"} | body keys: ${Object.keys(req.body).join(", ")} | query keys: ${Object.keys(req.query).join(", ")}`);

    // Vincular twilioCallSid ao registro imediatamente (evita race condition)
    if (humanCallRecordId && parentCallSid) {
      db.update(calls)
        .set({ twilioCallSid: parentCallSid, status: "em_andamento" })
        .where(eq(calls.id, humanCallRecordId))
        .catch((e) => console.error("[twilio/voice] Falha ao vincular callSid:", e));
    }

    // Validar callerId contra canais permitidos
    if (callerId) {
      const channels = await getTwilioChannels();
      const allowed = channels.map((c) => c.number);
      if (allowed.length > 0 && !allowed.includes(toE164Brazil(callerId))) {
        twiml.say({ language: "pt-BR" }, "Canal de saída não autorizado.");
        return res.type("text/xml").send(twiml.toString());
      }
    }

    if (!to) {
      twiml.say({ language: "pt-BR" }, "Número de destino não informado.");
      res.type("text/xml").send(twiml.toString());
      return;
    }

    const recordCalls = await isRecordCallsEnabled();

    // Parâmetros de callback incluem callRecordId e parentCallSid para lookup confiável
    const cbParams = new URLSearchParams();
    if (humanCallRecordId) cbParams.set("callRecordId", humanCallRecordId);
    if (parentCallSid) cbParams.set("parentCallSid", parentCallSid);
    const cbQuery = cbParams.toString() ? `?${cbParams.toString()}` : "";

    const dial = twiml.dial({
      callerId,
      action: `${baseUrl}/api/twilio/dial-action${cbQuery}`,
      ...(recordCalls && {
        record: "record-from-answer-dual",
        recordingStatusCallback: `${baseUrl}/api/calls/recording-status${cbQuery}`,
        recordingStatusCallbackMethod: "POST",
      }),
    });
    dial.number(toE164Brazil(to));

    res.type("text/xml").send(twiml.toString());
  } catch (e) {
    console.error("[twilio] voice error:", e);
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ language: "pt-BR" }, "Erro interno.");
    res.type("text/xml").send(twiml.toString());
  }
});

// ─── Dial action — webhook público ────────────────────────────────────────────
// Chamado pelo Twilio quando o <Dial> termina; captura status e duração final

router.post("/dial-action", async (req: Request, res: Response) => {
  try {
    const { callRecordId: crId, parentCallSid } = req.query as Record<string, string>;
    const { DialCallStatus, DialCallDuration } = req.body as Record<string, string>;

    const dialStatusMap: Record<string, string> = {
      completed: "encerrada",
      "no-answer": "nao_atendeu",
      busy: "ocupado",
      failed: "falhou",
      canceled: "encerrada",
    };
    const status = (dialStatusMap[DialCallStatus] ?? "encerrada") as
      "encerrada" | "nao_atendeu" | "ocupado" | "falhou";

    const terminalStatuses = new Set(["encerrada", "nao_atendeu", "ocupado", "falhou"]);
    const update: Record<string, unknown> = { status };
    if (DialCallDuration) update.duration = parseInt(DialCallDuration);
    if (terminalStatuses.has(status)) update.endedAt = new Date();

    if (crId) {
      await db.update(calls).set(update).where(eq(calls.id, crId));
    } else if (parentCallSid) {
      await db.update(calls).set(update).where(eq(calls.twilioCallSid, parentCallSid));
    }

    // Twilio exige resposta TwiML do action URL
    res.type("text/xml").send("<Response></Response>");
  } catch (e) {
    console.error("[twilio] dial-action error:", e);
    res.type("text/xml").send("<Response></Response>");
  }
});

// ─── Iniciar chamada pelo operador ───────────────────────────────────────────

router.post("/outbound-call", requireAuth, async (req: Request, res: Response) => {
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
      statusCallback: config.statusCallbackUrl ?? `${baseUrl}/api/calls/twilio-status`,
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

// ─── Chamada de teste com agente ElevenLabs ──────────────────────────────────

router.post("/test-call", requireAuth, async (req: Request, res: Response) => {
  try {
    const { phone, elevenlabsAgentId, elevenLabsVoiceId, callerId, callRecordId } = req.body as {
      phone: string;
      elevenlabsAgentId: string;
      elevenLabsVoiceId?: string;
      callerId?: string;
      callRecordId?: string;
    };
    if (!phone || !elevenlabsAgentId) {
      return res.status(400).json({ message: "phone e elevenlabsAgentId são obrigatórios" });
    }
    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }
    const baseUrl = await getServerBaseUrl();
    const toNumber = toE164Brazil(phone);

    let fromNumber = config.fromNumber;
    if (callerId) {
      const normalized = toE164Brazil(callerId);
      const channels = await getTwilioChannels();
      if (channels.some((c) => c.number === normalized)) fromNumber = normalized;
    }

    const urlParams = new URLSearchParams({ campaignType: "ia", agentId: elevenlabsAgentId });
    if (elevenLabsVoiceId) urlParams.set("voiceId", elevenLabsVoiceId);
    if (callRecordId) urlParams.set("callRecordId", callRecordId);

    const client = twilio(config.accountSid, config.authToken);
    const call = await client.calls.create({
      to: toNumber,
      from: fromNumber,
      url: `${baseUrl}/api/twilio/voice?${urlParams.toString()}`,
      statusCallback: config.statusCallbackUrl ?? `${baseUrl}/api/calls/twilio-status`,
      statusCallbackMethod: "POST",
    });

    let finalCallRecordId = callRecordId;
    if (callRecordId) {
      await db.update(calls)
        .set({ twilioCallSid: call.sid, status: "iniciando", type: "ia" })
        .where(eq(calls.id, callRecordId));
    } else {
      const [newCall] = await db.insert(calls)
        .values({ operatorId: req.user!.userId, twilioCallSid: call.sid, status: "iniciando", type: "ia" })
        .returning({ id: calls.id });
      finalCallRecordId = newCall.id;
    }

    return res.json({ ok: true, callSid: call.sid, to: toNumber, status: call.status, callRecordId: finalCallRecordId });
  } catch (e: unknown) {
    console.error("[twilio] test-call error:", e);
    const message = e instanceof Error ? e.message : "Erro ao iniciar chamada de teste";
    return res.status(500).json({ message });
  }
});

// ─── Status de chamada de teste ───────────────────────────────────────────────

router.get("/test-call/:callSid/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }
    const client = twilio(config.accountSid, config.authToken);
    const call = await client.calls(req.params.callSid).fetch();
    return res.json({ status: call.status, duration: call.duration, to: call.to, from: call.from });
  } catch (e) {
    console.error("[twilio] test-call status error:", e);
    return res.status(500).json({ message: "Erro ao buscar status" });
  }
});

// ─── Encerrar chamada de teste ────────────────────────────────────────────────

router.delete("/test-call/:callSid", requireAuth, async (req: Request, res: Response) => {
  try {
    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }
    const client = twilio(config.accountSid, config.authToken);
    await client.calls(req.params.callSid).update({ status: "completed" });
    return res.json({ ok: true });
  } catch (e) {
    console.error("[twilio] test-call delete error:", e);
    return res.status(500).json({ message: "Erro ao encerrar chamada" });
  }
});

// ─── Diagnóstico de agente ElevenLabs ────────────────────────────────────────

router.get(
  "/diagnose-elevenlabs/:agentId",
  requireAuth,
  rateLimit({ windowMs: 60_000, max: 10 }),
  async (req: Request, res: Response) => {
  try {
    const { agentId } = req.params;
    const elevenLabsKey = await getElevenLabsKey();
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
      { headers: { "xi-api-key": elevenLabsKey } }
    );
    let body: unknown;
    try { body = await response.json(); } catch { body = await response.text(); }
    return res.json({
      ok: response.ok,
      httpStatus: response.status,
      agentId,
      keyPrefix: elevenLabsKey ? `${elevenLabsKey.slice(0, 8)}...` : "(não configurada)",
      response: body,
    });
  } catch (e: unknown) {
    console.error("[twilio] diagnose-elevenlabs error:", e);
    const message = e instanceof Error ? e.message : "Erro ao diagnosticar ElevenLabs";
    return res.status(500).json({ message });
  }
});

// ─── Polling de status de chamada ─────────────────────────────────────────────

router.get("/calls/:callSid/status", requireAuth, async (req: Request, res: Response) => {
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

router.delete("/calls/:callSid", requireAuth, async (req: Request, res: Response) => {
  try {
    const config = await getTwilioConfig();
    const client = twilio(config.accountSid, config.authToken);
    await client.calls(req.params.callSid).update({ status: "completed" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Erro ao encerrar chamada" });
  }
});

// ─── TwiML Applications ──────────────────────────────────────────────────────

router.get("/applications", requireAuth, async (_req: Request, res: Response) => {
  try {
    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }
    const client = twilio(config.accountSid, config.authToken);
    const apps = await client.applications.list({ limit: 50 });
    return res.json(
      apps.map((a) => ({
        sid: a.sid,
        friendlyName: a.friendlyName,
        voiceUrl: a.voiceUrl,
        voiceMethod: a.voiceMethod,
        statusCallback: a.statusCallback,
        dateUpdated: a.dateUpdated,
      }))
    );
  } catch (e: unknown) {
    console.error("[twilio] list applications error:", e);
    const message = e instanceof Error ? e.message : "Erro ao listar apps";
    return res.status(500).json({ message });
  }
});

router.post("/applications", requireAuth, async (req: Request, res: Response) => {
  try {
    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }
    const baseUrl = await getServerBaseUrl();
    const {
      friendlyName = "CRM Voice App",
      voiceUrl,
      voiceMethod = "POST",
      voiceFallbackUrl,
      voiceFallbackMethod = "POST",
      statusCallback,
      statusCallbackMethod = "POST",
      voiceCallerIdLookup = false,
      publicApplicationConnectEnabled = false,
    } = req.body as {
      friendlyName?: string;
      voiceUrl?: string;
      voiceMethod?: string;
      voiceFallbackUrl?: string;
      voiceFallbackMethod?: string;
      statusCallback?: string;
      statusCallbackMethod?: string;
      voiceCallerIdLookup?: boolean;
      publicApplicationConnectEnabled?: boolean;
    };

    const client = twilio(config.accountSid, config.authToken);
    const app = await client.applications.create({
      friendlyName,
      voiceUrl: voiceUrl || `${baseUrl}/api/twilio/voice`,
      voiceMethod,
      ...(voiceFallbackUrl ? { voiceFallbackUrl, voiceFallbackMethod } : {}),
      statusCallback: statusCallback || `${baseUrl}/api/calls/twilio-status`,
      statusCallbackMethod,
      voiceCallerIdLookup,
      publicApplicationConnectEnabled,
    });
    return res.json({
      sid: app.sid,
      friendlyName: app.friendlyName,
      voiceUrl: app.voiceUrl,
    });
  } catch (e: unknown) {
    console.error("[twilio] create application error:", e);
    const message = e instanceof Error ? e.message : "Erro ao criar app";
    return res.status(500).json({ message });
  }
});

router.post("/applications/:sid/select", requireAuth, async (req: Request, res: Response) => {
  try {
    const { sid } = req.params;
    await db
      .insert(systemSettings)
      .values({ key: "twilio_twiml_app_sid", value: sid })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: sid } });
    return res.json({ ok: true, sid });
  } catch (e: unknown) {
    console.error("[twilio] select application error:", e);
    const message = e instanceof Error ? e.message : "Erro ao selecionar app";
    return res.status(500).json({ message });
  }
});

router.post("/applications/:sid/sync", requireAuth, async (req: Request, res: Response) => {
  try {
    const { sid } = req.params;
    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }
    const baseUrl = (req.body as { baseUrl?: string }).baseUrl?.trim() || await getServerBaseUrl();
    const client = twilio(config.accountSid, config.authToken);
    const app = await client.applications(sid).update({
      voiceUrl: `${baseUrl}/api/twilio/voice`,
      voiceMethod: "POST",
      statusCallback: `${baseUrl}/api/calls/twilio-status`,
      statusCallbackMethod: "POST",
    });
    return res.json({ ok: true, voiceUrl: app.voiceUrl });
  } catch (e: unknown) {
    console.error("[twilio] sync application error:", e);
    const message = e instanceof Error ? e.message : "Erro ao sincronizar app";
    return res.status(500).json({ message });
  }
});

// ─── Verified Caller IDs ──────────────────────────────────────────────────────

router.get("/caller-ids", requireAuth, async (_req: Request, res: Response) => {
  try {
    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }
    const client = twilio(config.accountSid, config.authToken);
    const ids = await client.outgoingCallerIds.list({ limit: 50 });
    return res.json(
      ids.map((id) => ({
        sid: id.sid,
        friendlyName: id.friendlyName,
        phoneNumber: id.phoneNumber,
        dateCreated: id.dateCreated,
      }))
    );
  } catch (e: unknown) {
    console.error("[twilio] list caller-ids error:", e);
    const message = e instanceof Error ? e.message : "Erro ao listar caller IDs";
    return res.status(500).json({ message });
  }
});

router.post("/caller-ids/validate", requireAuth, async (req: Request, res: Response) => {
  try {
    const { phoneNumber, friendlyName } = req.body as {
      phoneNumber: string;
      friendlyName?: string;
    };
    if (!phoneNumber) {
      return res.status(400).json({ message: "phoneNumber é obrigatório" });
    }
    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }
    const client = twilio(config.accountSid, config.authToken);
    const validation = await client.validationRequests.create({
      phoneNumber: toE164Brazil(phoneNumber),
      ...(friendlyName ? { friendlyName } : {}),
    });
    return res.json({
      validationCode: validation.validationCode,
      phoneNumber: validation.phoneNumber,
      friendlyName: validation.friendlyName,
    });
  } catch (e: unknown) {
    console.error("[twilio] validate caller-id error:", e);
    const message = e instanceof Error ? e.message : "Erro ao iniciar validação";
    return res.status(500).json({ message });
  }
});

router.delete("/caller-ids/:sid", requireAuth, async (req: Request, res: Response) => {
  try {
    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }
    const client = twilio(config.accountSid, config.authToken);
    await client.outgoingCallerIds(req.params.sid).remove();
    return res.json({ ok: true });
  } catch (e: unknown) {
    console.error("[twilio] delete caller-id error:", e);
    const message = e instanceof Error ? e.message : "Erro ao remover caller ID";
    return res.status(500).json({ message });
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

    if (!/^https:\/\/api\.twilio\.com\//.test(callRecord.recordingUrl)) {
      return res.status(400).json({ message: "URL de gravação inválida" });
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

// ─── Voice Intelligence Services ─────────────────────────────────────────────

router.get("/intelligence-services", requireAuth, async (_req: Request, res: Response) => {
  try {
    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }
    const client = twilio(config.accountSid, config.authToken);
    const services = await client.intelligence.v2.services.list({ limit: 50 });
    return res.json(
      services.map((s) => ({
        sid: s.sid,
        uniqueName: s.uniqueName,
        friendlyName: s.friendlyName,
        languageCode: s.languageCode,
        autoTranscribe: s.autoTranscribe,
        autoRedaction: s.autoRedaction,
        webhookUrl: s.webhookUrl,
        dateUpdated: s.dateUpdated,
      }))
    );
  } catch (e: unknown) {
    console.error("[twilio] list intelligence-services error:", e);
    const message = e instanceof Error ? e.message : "Erro ao listar serviços";
    return res.status(500).json({ message });
  }
});

router.post("/intelligence-services", requireAuth, async (req: Request, res: Response) => {
  try {
    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }
    const {
      uniqueName,
      friendlyName,
      languageCode = "pt-BR",
      autoTranscribe = true,
      autoRedaction = false,
      webhookUrl,
      webhookHttpMethod = "POST",
    } = req.body as {
      uniqueName: string;
      friendlyName?: string;
      languageCode?: string;
      autoTranscribe?: boolean;
      autoRedaction?: boolean;
      webhookUrl?: string;
      webhookHttpMethod?: string;
    };

    if (!uniqueName) {
      return res.status(400).json({ message: "uniqueName é obrigatório" });
    }

    const baseUrl = await getServerBaseUrl();
    const client = twilio(config.accountSid, config.authToken);
    const service = await client.intelligence.v2.services.create({
      uniqueName,
      ...(friendlyName ? { friendlyName } : {}),
      languageCode,
      autoTranscribe,
      autoRedaction,
      webhookUrl: webhookUrl || `${baseUrl}/api/calls/twilio-transcription`,
      webhookHttpMethod: (webhookHttpMethod || "POST") as "GET" | "POST" | "NULL",
    });
    return res.json({
      sid: service.sid,
      uniqueName: service.uniqueName,
      friendlyName: service.friendlyName,
      languageCode: service.languageCode,
      webhookUrl: service.webhookUrl,
    });
  } catch (e: unknown) {
    console.error("[twilio] create intelligence-service error:", e);
    const message = e instanceof Error ? e.message : "Erro ao criar serviço";
    return res.status(500).json({ message });
  }
});

router.patch("/intelligence-services/:sid", requireAuth, async (req: Request, res: Response) => {
  try {
    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }
    const { sid } = req.params;
    const { friendlyName, autoTranscribe, autoRedaction, webhookUrl, webhookHttpMethod } = req.body as {
      friendlyName?: string;
      autoTranscribe?: boolean;
      autoRedaction?: boolean;
      webhookUrl?: string;
      webhookHttpMethod?: string;
    };
    const client = twilio(config.accountSid, config.authToken);
    const service = await client.intelligence.v2.services(sid).update({
      ...(friendlyName !== undefined ? { friendlyName } : {}),
      ...(autoTranscribe !== undefined ? { autoTranscribe } : {}),
      ...(autoRedaction !== undefined ? { autoRedaction } : {}),
      ...(webhookUrl ? { webhookUrl } : {}),
      ...(webhookHttpMethod ? { webhookHttpMethod: webhookHttpMethod as "GET" | "POST" | "NULL" } : {}),
    });
    return res.json({
      sid: service.sid,
      uniqueName: service.uniqueName,
      friendlyName: service.friendlyName,
      languageCode: service.languageCode,
      autoTranscribe: service.autoTranscribe,
      autoRedaction: service.autoRedaction,
      webhookUrl: service.webhookUrl,
    });
  } catch (e: unknown) {
    console.error("[twilio] update intelligence-service error:", e);
    const message = e instanceof Error ? e.message : "Erro ao atualizar serviço";
    return res.status(500).json({ message });
  }
});

router.get("/intelligence-services/:sid/operators", requireAuth, async (req: Request, res: Response) => {
  try {
    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }
    const { sid } = req.params;
    const client = twilio(config.accountSid, config.authToken);

    const [prebuilt, attachments] = await Promise.all([
      client.intelligence.v2.prebuiltOperators.list({ limit: 100 }),
      client.intelligence.v2.operatorAttachments(sid).fetch(),
    ]);

    const attachedSet = new Set(attachments.operatorSids);

    return res.json(
      prebuilt.map((op) => ({
        sid: op.sid,
        friendlyName: op.friendlyName,
        description: op.description,
        operatorType: op.operatorType,
        availability: op.availability,
        author: op.author,
        attached: attachedSet.has(op.sid),
      }))
    );
  } catch (e: unknown) {
    console.error("[twilio] list operators error:", e);
    const message = e instanceof Error ? e.message : "Erro ao listar operadores";
    return res.status(500).json({ message });
  }
});

router.post("/intelligence-services/:sid/operators/:operatorSid", requireAuth, async (req: Request, res: Response) => {
  try {
    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }
    const { sid, operatorSid } = req.params;
    const client = twilio(config.accountSid, config.authToken);
    await client.intelligence.v2.operatorAttachment(sid, operatorSid).create();
    return res.json({ ok: true });
  } catch (e: unknown) {
    console.error("[twilio] attach operator error:", e);
    const message = e instanceof Error ? e.message : "Erro ao adicionar operador";
    return res.status(500).json({ message });
  }
});

router.delete("/intelligence-services/:sid/operators/:operatorSid", requireAuth, async (req: Request, res: Response) => {
  try {
    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }
    const { sid, operatorSid } = req.params;
    const client = twilio(config.accountSid, config.authToken);
    await client.intelligence.v2.operatorAttachment(sid, operatorSid).remove();
    return res.json({ ok: true });
  } catch (e: unknown) {
    console.error("[twilio] detach operator error:", e);
    const message = e instanceof Error ? e.message : "Erro ao remover operador";
    return res.status(500).json({ message });
  }
});

router.post("/intelligence-services/:sid/select", requireAuth, async (req: Request, res: Response) => {
  try {
    const { sid } = req.params;
    await db
      .insert(systemSettings)
      .values({ key: "twilio_intelligence_service_sid", value: sid })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: sid } });
    return res.json({ ok: true, sid });
  } catch (e: unknown) {
    console.error("[twilio] select intelligence-service error:", e);
    const message = e instanceof Error ? e.message : "Erro ao selecionar serviço";
    return res.status(500).json({ message });
  }
});

// ─── Debugger Webhook — recebe erros/avisos em tempo real do Twilio ──────────

router.post("/debugger-webhook", async (req: Request, res: Response) => {
  const { Sid, Level, Timestamp, PayloadType, Payload } = req.body as {
    Sid?: string;
    Level?: string;
    Timestamp?: string;
    PayloadType?: string;
    Payload?: string;
  };

  let parsed: unknown = null;
  if (Payload && PayloadType === "application/json") {
    try { parsed = JSON.parse(Payload); } catch { /* ignore */ }
  }

  console.warn("[twilio/debugger]", {
    sid: Sid,
    level: Level,
    timestamp: Timestamp,
    payload: parsed ?? Payload,
  });

  return res.status(200).send("OK");
});

// ─── Alertas / Erros do Twilio (Twilio Monitor API) ──────────────────────────

router.get("/alerts", requireAuth, async (req: Request, res: Response) => {
  try {
    const { logLevel, startDate, endDate, pageSize = "50" } = req.query as Record<string, string>;
    const { accountSid, authToken } = await getTwilioConfig();

    if (!accountSid || !authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }

    const url = new URL("https://monitor.twilio.com/v1/Alerts");
    if (logLevel && logLevel !== "all") url.searchParams.set("LogLevel", logLevel);
    if (startDate) url.searchParams.set("StartDate", startDate);
    if (endDate) url.searchParams.set("EndDate", endDate);
    url.searchParams.set("PageSize", String(Math.min(parseInt(pageSize) || 50, 100)));

    const resp = await fetch(url.toString(), {
      headers: {
        Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
      },
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error("[twilio/alerts] erro:", resp.status, body);
      return res.status(resp.status).json({ message: "Erro ao buscar alertas do Twilio" });
    }

    const data = await resp.json();
    return res.json(data);
  } catch (e: unknown) {
    console.error("[twilio/alerts] erro:", e);
    const message = e instanceof Error ? e.message : "Erro interno";
    return res.status(500).json({ message });
  }
});

// ─── Webhook de status de entrega de SMS ─────────────────────────────────────
// Twilio chama este endpoint quando o status de uma mensagem SMS muda.
// Corpo (application/x-www-form-urlencoded): SmsSid, MessageStatus, ErrorCode, ErrorMessage
// Status possíveis: queued → sent → delivered | undelivered | failed

router.post("/sms-status", async (req: Request, res: Response) => {
  try {
    const { SmsSid, MessageStatus, ErrorCode, ErrorMessage } = req.body as {
      SmsSid?: string;
      MessageStatus?: string;
      ErrorCode?: string;
      ErrorMessage?: string;
    };

    if (!SmsSid || !MessageStatus) {
      return res.status(400).send("SmsSid e MessageStatus são obrigatórios");
    }

    const isFinal = ["delivered", "undelivered", "failed"].includes(MessageStatus);
    if (!isFinal) {
      // Status intermediários (queued, sending, sent) — não precisamos persistir
      return res.sendStatus(204);
    }

    const normalized = MessageStatus === "delivered" ? "delivered" : "failed";
    const errorMsg = ErrorMessage
      ? `[${ErrorCode ?? "?"}] ${ErrorMessage}`
      : ErrorCode
        ? `Código de erro: ${ErrorCode}`
        : null;

    // Atualiza mensagem de campanha (se encontrada)
    const campaignUpdate = await db
      .update(smsCampaignMessages)
      .set({
        status: normalized,
        ...(errorMsg ? { errorMessage: errorMsg } : {}),
      })
      .where(eq(smsCampaignMessages.twilioSid, SmsSid));

    // Se não era mensagem de campanha, tenta mensagem avulsa
    if ((campaignUpdate.rowCount ?? 0) === 0) {
      await db
        .update(smsIndividualMessages)
        .set({
          status: normalized,
          ...(errorMsg ? { errorMessage: errorMsg } : {}),
        })
        .where(eq(smsIndividualMessages.twilioSid, SmsSid));
    }

    console.log(`[twilio/sms-status] ${SmsSid} → ${normalized}${errorMsg ? ` | ${errorMsg}` : ""}`);
    res.sendStatus(204);
  } catch (e) {
    console.error("[twilio/sms-status] erro:", e);
    res.sendStatus(500);
  }
});

export default router;
