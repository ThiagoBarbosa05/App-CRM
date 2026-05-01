import { Router, Request, Response } from "express";
import { db } from "server/db";
import { calls, campaignClients, callNotifications, campaignTriggers, clients } from "@shared/schema";
import { eq, and, desc, inArray, isNull, gt, sql } from "drizzle-orm";
import { getElevenLabsKey, getTwilioConfig, getTwilioIntelligenceServiceSid, getServerBaseUrl } from "../lib/twilio-config";
import { requireAuth } from "../middleware/validation";
import twilio from "twilio";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TERMINAL_STATUSES = new Set([
  "encerrada",
  "nao_atendeu",
  "ocupado",
  "falhou",
  "caixa_postal",
]);

function mapTwilioStatus(
  twilioStatus: string
): "iniciando" | "em_andamento" | "encerrada" | "nao_atendeu" | "ocupado" | "falhou" | "caixa_postal" {
  const map: Record<string, "iniciando" | "em_andamento" | "encerrada" | "nao_atendeu" | "ocupado" | "falhou" | "caixa_postal"> = {
    queued: "iniciando",
    initiated: "iniciando",
    ringing: "iniciando",
    "in-progress": "em_andamento",
    completed: "encerrada",
    "no-answer": "nao_atendeu",
    busy: "ocupado",
    failed: "falhou",
    canceled: "encerrada",
  };
  return map[twilioStatus] ?? "falhou";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function triggerTwilioIntelligence(callId: string, recordingSid: string): Promise<void> {
  const intelligenceServiceSid = await getTwilioIntelligenceServiceSid();
  if (!intelligenceServiceSid) {
    console.warn(`[voice-intelligence] twilio_intelligence_service_sid não configurado — transcrição ignorada para Call ID: ${callId}`);
    return;
  }

  const twilioConfig = await getTwilioConfig();
  if (!twilioConfig?.accountSid || !twilioConfig?.authToken) {
    console.warn("[voice-intelligence] Credenciais Twilio ausentes — transcrição ignorada");
    return;
  }

  const baseUrl = await getServerBaseUrl();
  if (!baseUrl) {
    console.warn("[voice-intelligence] server_base_url não configurado — webhook de transcrição não pode ser registrado");
    return;
  }
  const webhookUrl = `${baseUrl}/api/calls/twilio-transcription?callId=${encodeURIComponent(callId)}`;
  console.log(`[voice-intelligence] Solicitando transcrição | RecordingSid: ${recordingSid} | Call ID: ${callId} | Webhook: ${webhookUrl}`);

  const formParams: Record<string, string> = {
    ServiceSid: intelligenceServiceSid,
    Channel: JSON.stringify({ media_properties: { source_sid: recordingSid } }),
    WebhookUrl: webhookUrl,
  };

  const response = await fetch("https://intelligence.twilio.com/v2/Transcripts", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + Buffer.from(`${twilioConfig.accountSid}:${twilioConfig.authToken}`).toString("base64"),
    },
    body: new URLSearchParams(formParams).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[voice-intelligence] Erro ${response.status}: ${text}`);
    return;
  }
  const data = await response.json() as { sid?: string };
  console.log(`[voice-intelligence] Transcrição solicitada — Transcript SID: ${data.sid} | Call ID: ${callId}`);
}

// ─── Webhook: transcrição Voice Intelligence (público) ────────────────────────
// O Twilio Voice Intelligence envia apenas o transcript_sid como notificação.
// As sentences precisam ser buscadas via API separada.

router.post("/twilio-transcription", async (req: Request, res: Response) => {
  // Responde 204 imediatamente para o Twilio não ficar retentando
  res.status(204).send();

  try {
    // callId é passado como query param por triggerTwilioIntelligence
    const callId = (req.query as Record<string, string>).callId;

    const body = req.body as {
      transcript_sid?: string;
      TranscriptSid?: string;
    };

    const transcriptSid = body.transcript_sid ?? body.TranscriptSid;

    console.log(`[twilio-transcription] Webhook recebido | transcript_sid: ${transcriptSid} | callId: ${callId ?? "(ausente)"}`);

    if (!transcriptSid) {
      console.warn("[twilio-transcription] transcript_sid ausente — ignorando");
      return;
    }

    if (!callId) {
      // Fallback: sem callId na query string (webhook estático do Twilio).
      // Tenta recuperar o recordingSid do transcript via API do Voice Intelligence
      // e depois busca o call_sid do recording para encontrar a chamada no banco.
      console.warn("[twilio-transcription] callId ausente — tentando fallback via Recordings API");

      if (!transcriptSid) {
        console.warn("[twilio-transcription] transcript_sid também ausente — ignorando");
        return;
      }

      const twilioConfigFallback = await getTwilioConfig();
      if (!twilioConfigFallback?.accountSid || !twilioConfigFallback?.authToken) {
        console.warn("[twilio-transcription] Credenciais ausentes no fallback — ignorando");
        return;
      }

      const authHeaderFallback = "Basic " + Buffer.from(`${twilioConfigFallback.accountSid}:${twilioConfigFallback.authToken}`).toString("base64");

      // 1) Busca o transcript para obter o source_sid (recordingSid)
      const transcriptFallbackRes = await fetch(
        `https://intelligence.twilio.com/v2/Transcripts/${transcriptSid}`,
        { headers: { Authorization: authHeaderFallback } }
      );
      if (!transcriptFallbackRes.ok) {
        console.error(`[twilio-transcription] Fallback: erro ao buscar transcript ${transcriptSid}: ${transcriptFallbackRes.status}`);
        return;
      }
      const transcriptFallback = await transcriptFallbackRes.json() as {
        status?: string;
        channel?: { media_properties?: { source_sid?: string } };
      };

      const recordingSidFallback = transcriptFallback.channel?.media_properties?.source_sid;
      console.log(`[twilio-transcription] Fallback | transcript status: ${transcriptFallback.status} | recordingSid: ${recordingSidFallback ?? "(ausente)"}`);

      if (transcriptFallback.status !== "completed") {
        console.log(`[twilio-transcription] Fallback: transcript ainda não completo — aguardando`);
        return;
      }

      if (!recordingSidFallback) {
        console.warn("[twilio-transcription] Fallback: source_sid ausente no transcript — ignorando");
        return;
      }

      // 2) Busca a chamada no banco pelo recordingSid salvo pelo recording-status
      const [callByRecording] = await db
        .select({ id: calls.id })
        .from(calls)
        .where(eq(calls.recordingSid, recordingSidFallback))
        .limit(1);

      if (!callByRecording) {
        console.warn(`[twilio-transcription] Fallback: nenhuma chamada com recordingSid ${recordingSidFallback}`);
        return;
      }

      // Reutiliza o mesmo fluxo abaixo definindo callId
      // (simplesmente reprocessa com o callId encontrado)
      const resolvedCallId = callByRecording.id;
      console.log(`[twilio-transcription] Fallback resolvido | callId: ${resolvedCallId}`);

      // Busca sentences
      const sentencesFallbackRes = await fetch(
        `https://intelligence.twilio.com/v2/Transcripts/${transcriptSid}/Sentences`,
        { headers: { Authorization: authHeaderFallback } }
      );
      if (!sentencesFallbackRes.ok) {
        console.error(`[twilio-transcription] Fallback: erro ao buscar sentences: ${sentencesFallbackRes.status}`);
        return;
      }
      const sentencesFallbackData = await sentencesFallbackRes.json() as {
        sentences?: Array<{ transcript?: string; speaker?: string | number }>;
      };
      const fallbackText = (sentencesFallbackData.sentences ?? [])
        .map((s) => {
          const speaker = s.speaker !== undefined ? `[${s.speaker}]` : "";
          return `${speaker} ${s.transcript ?? ""}`.trim();
        })
        .filter(Boolean)
        .join("\n")
        .trim();

      if (!fallbackText) {
        console.warn(`[twilio-transcription] Fallback: texto vazio para callId: ${resolvedCallId}`);
        return;
      }

      const [updatedFallback] = await db
        .update(calls)
        .set({ twilioTranscription: fallbackText })
        .where(eq(calls.id, resolvedCallId))
        .returning({ id: calls.id });

      if (updatedFallback) {
        console.log(`[twilio-transcription] Fallback: transcrição salva | callId: ${resolvedCallId} | ${sentencesFallbackData.sentences?.length ?? 0} sentences`);
      } else {
        console.warn(`[twilio-transcription] Fallback: update não afetou nenhuma linha para callId: ${resolvedCallId}`);
      }
      return;
    }

    // Busca credenciais Twilio
    const twilioConfig = await getTwilioConfig();
    if (!twilioConfig?.accountSid || !twilioConfig?.authToken) {
      console.warn("[twilio-transcription] Credenciais Twilio ausentes — não é possível buscar sentences");
      return;
    }

    const authHeader = "Basic " + Buffer.from(`${twilioConfig.accountSid}:${twilioConfig.authToken}`).toString("base64");

    // 1) Busca o Transcript para confirmar status completed
    const transcriptRes = await fetch(
      `https://intelligence.twilio.com/v2/Transcripts/${transcriptSid}`,
      { headers: { Authorization: authHeader } }
    );

    if (!transcriptRes.ok) {
      console.error(`[twilio-transcription] Erro ao buscar Transcript ${transcriptSid}: ${transcriptRes.status}`);
      return;
    }

    const transcript = await transcriptRes.json() as { status?: string };

    console.log(`[twilio-transcription] Transcript status: ${transcript.status}`);

    if (transcript.status !== "completed") {
      console.log(`[twilio-transcription] Transcript ainda não completo (${transcript.status}) — aguardando próximo webhook`);
      return;
    }

    // 2) Busca as sentences do Transcript
    const sentencesRes = await fetch(
      `https://intelligence.twilio.com/v2/Transcripts/${transcriptSid}/Sentences`,
      { headers: { Authorization: authHeader } }
    );

    if (!sentencesRes.ok) {
      console.error(`[twilio-transcription] Erro ao buscar sentences: ${sentencesRes.status}`);
      return;
    }

    const sentencesData = await sentencesRes.json() as {
      sentences?: Array<{ transcript?: string; speaker?: string | number }>;
    };

    const transcriptionText = (sentencesData.sentences ?? [])
      .map((s) => {
        const speaker = s.speaker !== undefined ? `[${s.speaker}]` : "";
        return `${speaker} ${s.transcript ?? ""}`.trim();
      })
      .filter(Boolean)
      .join("\n")
      .trim();

    if (!transcriptionText) {
      console.warn(`[twilio-transcription] Texto de transcrição vazio para Call ID: ${callId}`);
      return;
    }

    // 3) Salva a transcrição diretamente pelo callId (sem precisar buscar por recordingSid)
    const [updated] = await db
      .update(calls)
      .set({ twilioTranscription: transcriptionText })
      .where(eq(calls.id, callId))
      .returning({ id: calls.id });

    if (!updated) {
      console.warn(`[twilio-transcription] Nenhuma chamada encontrada com ID: ${callId}`);
      return;
    }

    console.log(`[twilio-transcription] Transcrição salva com sucesso | Call ID: ${callId} | ${sentencesData.sentences?.length ?? 0} sentences`);
  } catch (e) {
    console.error("[twilio-transcription] Erro interno:", e);
  }
});

// ─── Listar chamadas ──────────────────────────────────────────────────────────

router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { campaignId, clientId, status, page = "1", pageSize = "20" } = req.query as Record<string, string>;
    const limit = Math.min(parseInt(pageSize) || 20, 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

    const conditions = [];
    if (campaignId) conditions.push(eq(calls.campaignId, campaignId));
    if (clientId) conditions.push(eq(calls.clientId, clientId));
    if (status) conditions.push(eq(calls.status, status as "iniciando" | "em_andamento" | "encerrada" | "nao_atendeu" | "ocupado" | "falhou" | "caixa_postal"));

    if (req.user?.role === "vendedor") {
      conditions.push(eq(calls.operatorId, req.user.userId));
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: calls.id,
          clientId: calls.clientId,
          operatorId: calls.operatorId,
          campaignId: calls.campaignId,
          twilioCallSid: calls.twilioCallSid,
          elevenLabsConversationId: calls.elevenLabsConversationId,
          status: calls.status,
          outcome: calls.outcome,
          duration: calls.duration,
          recordingUrl: calls.recordingUrl,
          recordingSid: calls.recordingSid,
          twilioTranscription: calls.twilioTranscription,
          transcription: calls.transcription,
          summary: calls.summary,
          aiDecision: calls.aiDecision,
          sentiment: calls.sentiment,
          notes: calls.notes,
          nextStep: calls.nextStep,
          toPhone: calls.toPhone,
          contactName: calls.contactName,
          startedAt: calls.startedAt,
          endedAt: calls.endedAt,
          createdAt: calls.createdAt,
          clientName: clients.name,
          clientPhone: clients.phone,
        })
        .from(calls)
        .leftJoin(clients, eq(calls.clientId, clients.id))
        .where(whereClause)
        .orderBy(desc(calls.createdAt))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(calls)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;

    res.json({
      data: rows,
      page: parseInt(page),
      pageSize: limit,
      total,
      hasMore: rows.length === limit,
    });
  } catch (e) {
    console.error("[calls] GET / error:", e);
    res.status(500).json({ message: "Erro ao buscar chamadas" });
  }
});

// ─── Criar chamada ────────────────────────────────────────────────────────────

router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;

    const { clientId, campaignId, twilioCallSid, toPhone, contactName } = req.body as {
      clientId?: string;
      campaignId?: string;
      twilioCallSid?: string;
      toPhone?: string;
      contactName?: string;
    };

    const [call] = await db
      .insert(calls)
      .values({
        operatorId: userId,
        clientId,
        campaignId,
        twilioCallSid,
        toPhone,
        contactName,
        status: "iniciando",
        startedAt: new Date(),
      })
      .returning();

    res.status(201).json(call);
  } catch (e) {
    console.error("[calls] POST / error:", e);
    res.status(500).json({ message: "Erro ao criar chamada" });
  }
});

// ─── Buscar chamada ───────────────────────────────────────────────────────────

router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const [call] = await db
      .select()
      .from(calls)
      .where(eq(calls.id, req.params.id));
    if (!call) return res.status(404).json({ message: "Chamada não encontrada" });
    res.json(call);
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar chamada" });
  }
});

// ─── Atualizar chamada ────────────────────────────────────────────────────────

router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { notes, outcome, nextStep, twilioCallSid, status } = req.body as {
      notes?: string;
      outcome?: string;
      nextStep?: string;
      twilioCallSid?: string;
      status?: string;
    };

    const isTerminal = status && TERMINAL_STATUSES.has(status);

    const [call] = await db
      .update(calls)
      .set({
        ...(notes !== undefined && { notes }),
        ...(outcome !== undefined && { outcome: outcome as "atendeu" | "nao_atendeu" | "ocupado" | "caixa_postal" | "numero_invalido" | "convertido" | "reagendado" }),
        ...(nextStep !== undefined && { nextStep }),
        ...(twilioCallSid !== undefined && { twilioCallSid }),
        ...(status !== undefined && { status: status as "iniciando" | "em_andamento" | "encerrada" | "nao_atendeu" | "ocupado" | "falhou" | "caixa_postal" }),
        // Se o novo status é terminal e a chamada ainda não tem endedAt, registra agora
        ...(isTerminal && { endedAt: new Date() }),
      })
      .where(eq(calls.id, req.params.id))
      .returning();
    if (!call) return res.status(404).json({ message: "Chamada não encontrada" });
    res.json(call);
  } catch (e) {
    res.status(500).json({ message: "Erro ao atualizar chamada" });
  }
});

// ─── Encerrar chamada manualmente ────────────────────────────────────────────

router.post("/:id/end", requireAuth, async (req: Request, res: Response) => {
  try {
    const [call] = await db
      .update(calls)
      .set({ status: "encerrada", endedAt: new Date() })
      .where(eq(calls.id, req.params.id))
      .returning();
    if (!call) return res.status(404).json({ message: "Chamada não encontrada" });
    res.json(call);
  } catch (e) {
    res.status(500).json({ message: "Erro ao encerrar chamada" });
  }
});

// ─── Sincronizar transcrição via ElevenLabs ────────────────────────────────────

router.post("/:id/sync-transcript", requireAuth, async (req: Request, res: Response) => {
  try {
    const [call] = await db
      .select()
      .from(calls)
      .where(eq(calls.id, req.params.id));

    if (!call) return res.status(404).json({ message: "Chamada não encontrada" });
    if (!call.elevenLabsConversationId) {
      return res.status(400).json({ message: "Sem conversation_id ElevenLabs" });
    }

    const apiKey = await getElevenLabsKey();
    if (!apiKey) return res.status(400).json({ message: "ElevenLabs não configurado" });

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${call.elevenLabsConversationId}`,
      { headers: { "xi-api-key": apiKey } }
    );

    if (!response.ok) {
      return res.status(502).json({ message: "Erro ao buscar transcrição na ElevenLabs" });
    }

    const data = await response.json() as {
      transcript?: Array<{ role: string; message: string }>;
      analysis?: { summary?: string; sentiment?: string };
      status?: string;
    };

    const transcript = data.transcript
      ?.map((t) => `${t.role}: ${t.message}`)
      .join("\n") ?? null;

    const sentiment = (
      data.analysis?.sentiment === "positive"
        ? "positivo"
        : data.analysis?.sentiment === "negative"
        ? "negativo"
        : "neutro"
    ) as "positivo" | "neutro" | "negativo" | undefined;

    const [updated] = await db
      .update(calls)
      .set({
        transcription: transcript,
        summary: data.analysis?.summary ?? null,
        sentiment,
      })
      .where(eq(calls.id, req.params.id))
      .returning();

    res.json(updated);
  } catch (e) {
    console.error("[calls] sync-transcript error:", e);
    res.status(500).json({ message: "Erro ao sincronizar transcrição" });
  }
});

// ─── Sincronizar gravação via Twilio API ──────────────────────────────────────

router.post("/:id/sync-recording", requireAuth, async (req: Request, res: Response) => {
  try {
    const [call] = await db.select().from(calls).where(eq(calls.id, req.params.id));
    if (!call) return res.status(404).json({ message: "Chamada não encontrada" });
    if (!call.twilioCallSid) {
      return res.status(400).json({ message: "Chamada sem Twilio Call SID" });
    }

    const twilioConfig = await getTwilioConfig();
    if (!twilioConfig?.accountSid || !twilioConfig?.authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }

    const client = twilio(twilioConfig.accountSid, twilioConfig.authToken);
    const recordings = await client.recordings.list({ callSid: call.twilioCallSid, limit: 1 });

    if (recordings.length === 0) {
      return res.status(404).json({ message: "Nenhuma gravação encontrada no Twilio para esta chamada" });
    }

    const rec = recordings[0];
    const recordingUrl = `https://api.twilio.com${rec.uri.replace(".json", "")}`;

    const [updated] = await db
      .update(calls)
      .set({ recordingSid: rec.sid, recordingUrl })
      .where(eq(calls.id, req.params.id))
      .returning();

    // Acionar Voice Intelligence se ainda não houver transcrição
    if (!call.twilioTranscription) {
      triggerTwilioIntelligence(call.id, rec.sid).catch((e) =>
        console.warn("[sync-recording] Falha ao acionar Voice Intelligence:", e)
      );
    }

    res.json(updated);
  } catch (e) {
    console.error("[calls] sync-recording error:", e);
    res.status(500).json({ message: "Erro ao sincronizar gravação" });
  }
});

// ─── Sincronizar transcrição Twilio Voice Intelligence ────────────────────────

router.post("/:id/sync-twilio-transcript", requireAuth, async (req: Request, res: Response) => {
  try {
    const [call] = await db.select().from(calls).where(eq(calls.id, req.params.id));
    if (!call) return res.status(404).json({ message: "Chamada não encontrada" });
    if (!call.recordingSid) {
      return res.status(400).json({ message: "Chamada sem Recording SID — sincronize a gravação primeiro" });
    }

    await triggerTwilioIntelligence(call.id, call.recordingSid);
    res.json({ message: "Transcrição solicitada ao Twilio Voice Intelligence. Aguarde o webhook de retorno." });
  } catch (e) {
    console.error("[calls] sync-twilio-transcript error:", e);
    res.status(500).json({ message: "Erro ao solicitar transcrição" });
  }
});

// ─── Webhook: status de chamada (público) ─────────────────────────────────────

router.post("/twilio-status", async (req: Request, res: Response) => {
  try {
    const { CallSid, CallStatus, CallDuration, RecordingUrl } = req.body as Record<string, string>;

    if (!CallSid) return res.sendStatus(400);

    const status = mapTwilioStatus(CallStatus);
    const update: Partial<typeof calls.$inferSelect> = { status };
    if (CallDuration) update.duration = parseInt(CallDuration);
    if (RecordingUrl) update.recordingUrl = RecordingUrl;
    if (TERMINAL_STATUSES.has(status)) update.endedAt = new Date();

    await db.update(calls).set(update).where(eq(calls.twilioCallSid, CallSid));

    res.sendStatus(204);
  } catch (e) {
    console.error("[calls] twilio-status error:", e);
    res.sendStatus(500);
  }
});

// ─── Webhook: status de gravação (público) ────────────────────────────────────

router.post("/recording-status", async (req: Request, res: Response) => {
  try {
    const { CallSid, RecordingSid, RecordingUrl } = req.body as Record<string, string>;
    // callRecordId e parentCallSid passados como query params pelo voice webhook
    const { callRecordId: crId, parentCallSid } = req.query as Record<string, string>;

    console.log(`[recording-status] Recebido | RecordingSid: ${RecordingSid} | CallSid: ${CallSid} | crId: ${crId ?? "(ausente)"} | parentCallSid: ${parentCallSid ?? "(ausente)"}`);

    if (!RecordingSid) return res.sendStatus(400);

    const update = { recordingSid: RecordingSid, recordingUrl: RecordingUrl };

    let callRow: { id: string } | undefined;

    if (crId) {
      const [updated] = await db.update(calls).set(update).where(eq(calls.id, crId)).returning({ id: calls.id });
      if (updated) {
        callRow = updated;
      } else {
        console.warn(`[recording-status] crId ${crId} não encontrou nenhuma linha — recording-status ignorado`);
      }
    } else if (parentCallSid) {
      const [updated] = await db.update(calls).set(update).where(eq(calls.twilioCallSid, parentCallSid)).returning({ id: calls.id });
      callRow = updated;
      if (!updated) {
        console.warn(`[recording-status] parentCallSid ${parentCallSid} não encontrou nenhuma linha`);
        // Fallback: tentar pelo CallSid direto (em alguns fluxos Twilio usa CallSid = parentCallSid)
        if (CallSid && CallSid !== parentCallSid) {
          const [byCallSid] = await db.update(calls).set(update).where(eq(calls.twilioCallSid, CallSid)).returning({ id: calls.id });
          callRow = byCallSid;
          if (byCallSid) console.log(`[recording-status] Encontrado via CallSid ${CallSid}`);
        }
      }
    } else if (CallSid) {
      const [updated] = await db.update(calls).set(update).where(eq(calls.twilioCallSid, CallSid)).returning({ id: calls.id });
      callRow = updated;
      if (!updated) console.warn(`[recording-status] CallSid ${CallSid} não encontrou nenhuma linha`);
    }

    if (callRow && RecordingSid) {
      triggerTwilioIntelligence(callRow.id, RecordingSid).catch((e) =>
        console.warn("[recording-status] Falha ao acionar Voice Intelligence:", e)
      );
    }

    // Último recurso: se nenhum lookup encontrou a chamada, tenta encontrar a
    // chamada mais recente criada nos últimos 5 minutos que ainda não tem
    // recordingSid nem twilioCallSid vinculados.
    if (!callRow && CallSid) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const [candidate] = await db
        .select({ id: calls.id })
        .from(calls)
        .where(and(
          isNull(calls.recordingSid),
          isNull(calls.twilioCallSid),
          inArray(calls.status, ["iniciando", "em_andamento"] as const),
          gt(calls.createdAt, fiveMinutesAgo)
        ))
        .orderBy(desc(calls.createdAt))
        .limit(1);

      if (candidate) {
        const [linked] = await db
          .update(calls)
          .set({ ...update, twilioCallSid: CallSid })
          .where(eq(calls.id, candidate.id))
          .returning({ id: calls.id });

        if (linked) {
          callRow = linked;
          console.log(`[recording-status] Linked via fallback recente | callId: ${linked.id} ← CallSid: ${CallSid}`);
          triggerTwilioIntelligence(linked.id, RecordingSid).catch((e) =>
            console.warn("[recording-status] Falha ao acionar Voice Intelligence (fallback):", e)
          );
        }
      } else {
        console.warn(`[recording-status] Nenhuma chamada recente sem vínculo encontrada para CallSid: ${CallSid}`);
      }
    }

    res.sendStatus(204);
  } catch (e) {
    console.error("[calls] recording-status error:", e);
    res.sendStatus(500);
  }
});

export default router;
