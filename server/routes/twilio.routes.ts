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
  getElevenLabsKey,
} from "../lib/twilio-config";
import { requireAuth } from "../middleware/validation";

async function validateTwilioWebhook(req: Request, res: Response): Promise<boolean> {
  const { accountSid, authToken } = await getTwilioConfig();
  if (process.env.NODE_ENV !== "production" || !accountSid || !authToken) return true;
  const signatureHeader = req.headers["x-twilio-signature"] as string;
  const baseUrl = await getServerBaseUrl();
  // req.originalUrl inclui query string — necessário para assinatura correta
  const fullUrl = `${baseUrl}${req.originalUrl}`;
  const valid = twilio.validateRequest(authToken, signatureHeader, fullUrl, req.body);
  if (!valid) { res.status(403).send("Forbidden"); return false; }
  return true;
}

const router = Router();

// ─── Token JWT para Twilio Voice SDK ─────────────────────────────────────────

router.get("/token", requireAuth, async (req: Request, res: Response) => {
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
      { identity: `operator_${userId}`, ttl: 3600 }
    );
    token.addGrant(voiceGrant);

    // Atualiza a Voice URL do TwiML App para apontar para a URL atual do servidor.
    // Isso garante que o discador funcione independente da URL (ngrok, Replit, etc).
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
    const requestBaseUrl = `${proto}://${req.headers.host}`;
    const config = await getTwilioConfig();
    if (config.accountSid && config.authToken) {
      const mgmtClient = twilio(config.accountSid, config.authToken);
      mgmtClient.applications(sdk.twimlAppSid)
        .update({ voiceUrl: `${requestBaseUrl}/api/twilio/voice`, voiceMethod: "POST" })
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
    const isValid = await validateTwilioWebhook(req, res);
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

      // Atualizar status do registro de chamada se callRecordId fornecido
      if (callRecordId && callSid) {
        db.update(calls)
          .set({ twilioCallSid: callSid, status: "em_andamento" })
          .where(eq(calls.id, callRecordId))
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
        .set({ twilioCallSid: call.sid, status: "iniciando" })
        .where(eq(calls.id, callRecordId));
    } else {
      const [newCall] = await db.insert(calls)
        .values({ operatorId: req.user!.userId, twilioCallSid: call.sid, status: "iniciando" })
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

router.get("/diagnose-elevenlabs/:agentId", async (req: Request, res: Response) => {
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

export default router;
