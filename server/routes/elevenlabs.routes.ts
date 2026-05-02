import { Router, Request, Response } from "express";
import { db } from "server/db";
import { calls, campaignClients, callNotifications, campaignTriggers } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getElevenLabsKey } from "../lib/twilio-config";
import { requireAuth } from "../middleware/validation";

const router = Router();

// ─── Webhook: decisão do agente IA ────────────────────────────────────────────
// Chamado pelas tools "confirmar_interesse" / "recusar_convite" do agente ElevenLabs
// Body esperado: { callSid, conversationId, decision | decisao }

router.post("/decision", async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, string | undefined>;
    const callSid = body.callSid;
    const conversationId = body.conversationId ?? body.conversation_id;
    const decision = body.decision ?? body.decisao;
    // Motivo/contexto da resposta do cliente (campo opcional nas tools do ElevenLabs)
    const reason = body.reason ?? body.context ?? body.motivo;

    if (!decision || !["sim", "nao", "sem_resposta"].includes(decision)) {
      res.status(400).json({ message: "decision deve ser sim|nao|sem_resposta" });
      return;
    }

    // Lookup por callSid primeiro (disponível durante a chamada),
    // depois por conversationId como fallback
    let call = callSid
      ? (await db.select().from(calls).where(eq(calls.twilioCallSid, callSid)))[0]
      : undefined;
    if (!call && conversationId) {
      call = (
        await db.select().from(calls).where(eq(calls.elevenLabsConversationId, conversationId))
      )[0];
    }
    if (!call) {
      res.status(200).json({ ok: true, warning: "call_not_found" });
      return;
    }

    const outcomeMap: Record<string, "convertido" | "atendeu"> = {
      sim: "convertido",
      nao: "atendeu",
      sem_resposta: "atendeu",
    };

    const campaignClientStatusMap: Record<
      string,
      "convite_aceito" | "convite_recusado" | "contactado"
    > = {
      sim: "convite_aceito",
      nao: "convite_recusado",
      sem_resposta: "contactado",
    };

    await db
      .update(calls)
      .set({
        aiDecision: decision as "sim" | "nao" | "sem_resposta",
        outcome: outcomeMap[decision],
        ...(reason ? { notes: reason } : {}),
      })
      .where(eq(calls.id, call.id));

    if (call.campaignId && call.clientId) {
      await db
        .update(campaignClients)
        .set({ status: campaignClientStatusMap[decision] })
        .where(
          and(
            eq(campaignClients.campaignId, call.campaignId),
            eq(campaignClients.clientId, call.clientId),
          ),
        );
    }

    const decisionLabel =
      decision === "sim"
        ? "SIM (interessado)"
        : decision === "nao"
          ? "NÃO (não interessado)"
          : "sem resposta";

    await db.insert(callNotifications).values({
      userId: call.operatorId,
      callId: call.id,
      clientId: call.clientId ?? undefined,
      message: `IA decidiu: ${decisionLabel}`,
    });

    res.status(200).json({ ok: true, decision, callSid });
  } catch (e) {
    console.error("[elevenlabs] decision error:", e);
    res.status(500).json({ message: "Erro ao processar decisão" });
  }
});

// ─── Webhook: pós-chamada ─────────────────────────────────────────────────────
// ElevenLabs envia { type: "post_call_transcription", data: { conversation_id, status, transcript[], analysis } }

router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const raw = req.body as Record<string, unknown>;
    // Desembrulhar o envelope "data" enviado pelo ElevenLabs
    const data: Record<string, unknown> = raw.type
      ? ((raw.data ?? {}) as Record<string, unknown>)
      : raw;

    const conversationId = data.conversation_id as string | undefined;
    const status = data.status as string | undefined;

    if (!conversationId) {
      res.status(400).json({ message: "conversation_id obrigatório" });
      return;
    }

    // Lookup por elevenLabsConversationId primeiro; fallback pelo callSid enviado
    // como dynamic variable (disponível no payload pós-chamada)
    let call = (
      await db.select().from(calls).where(eq(calls.elevenLabsConversationId, conversationId))
    )[0];

    if (!call) {
      const dynVars = (data.conversation_initiation_client_data as Record<string, unknown> | undefined)
        ?.dynamic_variables as Record<string, string> | undefined;
      const callSid = dynVars?.callSid;
      if (callSid) {
        call = (await db.select().from(calls).where(eq(calls.twilioCallSid, callSid)))[0];
        // Aproveita para gravar o conversationId se ainda não estiver salvo
        if (call && !call.elevenLabsConversationId) {
          await db
            .update(calls)
            .set({ elevenLabsConversationId: conversationId })
            .where(eq(calls.id, call.id));
        }
      }
    }

    if (!call) {
      res.status(200).json({ ok: true });
      return;
    }

    // Formatar transcript array → "Agent: ...\nCliente: ..."
    const rawTranscript = data.transcript;
    let transcriptText: string | null = null;
    if (Array.isArray(rawTranscript)) {
      const turns = (rawTranscript as Array<{ role: string; message?: string | null }>).filter(
        (t) => t.message?.trim(),
      );
      if (turns.length > 0) {
        transcriptText = turns
          .map((t) => `${t.role === "agent" ? "Agent" : "Cliente"}: ${t.message}`)
          .join("\n");
      }
    } else if (typeof rawTranscript === "string" && rawTranscript.trim()) {
      transcriptText = rawTranscript;
    }

    const analysis = data.analysis as Record<string, unknown> | undefined;

    const updates: Record<string, unknown> = {};
    if (transcriptText) updates.transcription = transcriptText;
    if (analysis?.transcript_summary) updates.summary = analysis.transcript_summary;
    else if (analysis?.summary) updates.summary = analysis.summary;
    if (status === "done" || status === "completed") {
      updates.status = "encerrada";
      updates.endedAt = new Date();
    }

    if (Object.keys(updates).length > 0) {
      await db.update(calls).set(updates).where(eq(calls.id, call.id));
    }

    // Só atualizar campaignClients se /decision ainda não gravou a decisão
    if (call.clientId && call.campaignId && !call.aiDecision) {
      await db
        .update(campaignClients)
        .set({ status: "contactado" })
        .where(
          and(
            eq(campaignClients.campaignId, call.campaignId),
            eq(campaignClients.clientId, call.clientId),
          ),
        );
    }

    // Varrer triggers da campanha no transcript
    if (call.campaignId && transcriptText) {
      const triggers = await db
        .select()
        .from(campaignTriggers)
        .where(eq(campaignTriggers.campaignId, call.campaignId));

      const lowerTranscript = transcriptText.toLowerCase();

      for (const trigger of triggers) {
        const idx = lowerTranscript.indexOf(trigger.keyword.toLowerCase());
        if (idx === -1) continue;

        const excerptStart = Math.max(0, idx - 60);
        const excerptEnd = Math.min(transcriptText.length, idx + trigger.keyword.length + 60);
        const excerpt =
          (excerptStart > 0 ? "..." : "") +
          transcriptText.slice(excerptStart, excerptEnd) +
          (excerptEnd < transcriptText.length ? "..." : "");

        await db.insert(callNotifications).values({
          userId: call.operatorId,
          callId: call.id,
          clientId: call.clientId ?? undefined,
          triggerId: trigger.id,
          message: trigger.instruction ?? `Palavra-chave detectada: "${trigger.keyword}"`,
          excerpt,
        });
      }
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error("[elevenlabs] webhook error:", e);
    res.sendStatus(500);
  }
});

// ─── Buscar e sincronizar conversa sob demanda ────────────────────────────────

router.get("/conversation/:id", async (req: Request, res: Response) => {
  try {
    const apiKey = await getElevenLabsKey();
    if (!apiKey) return res.status(400).json({ message: "ElevenLabs não configurado" });

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(req.params.id)}`,
      { headers: { "xi-api-key": apiKey } },
    );

    if (!response.ok) {
      const body = await response.text();
      return res.status(response.status).json({ message: body });
    }

    const data = (await response.json()) as {
      conversation_id: string;
      status: string;
      transcript?: Array<{ role: string; message: string; time_in_call_secs?: number }>;
      metadata?: { duration?: number };
      analysis?: { transcript_summary?: string; summary?: string };
      has_audio?: boolean;
    };

    const transcriptText = (data.transcript ?? [])
      .filter((t) => t.message?.trim())
      .map((t) => `${t.role === "agent" ? "Agent" : "Cliente"}: ${t.message}`)
      .join("\n");

    const summary = data.analysis?.transcript_summary ?? data.analysis?.summary ?? null;

    const [call] = await db
      .select()
      .from(calls)
      .where(eq(calls.elevenLabsConversationId, req.params.id));

    if (call) {
      const updates: Record<string, unknown> = {};
      if (transcriptText) updates.transcription = transcriptText;
      if (summary) updates.summary = summary;
      if (data.metadata?.duration) updates.duration = data.metadata.duration;
      if (data.status === "done" || data.status === "completed") {
        updates.status = "encerrada";
        updates.endedAt = new Date();
      }
      if (Object.keys(updates).length > 0) {
        await db.update(calls).set(updates).where(eq(calls.id, call.id));
      }
    }

    res.json({
      conversationId: data.conversation_id,
      status: data.status,
      transcript: transcriptText,
      summary,
      hasAudio: data.has_audio ?? false,
      duration: data.metadata?.duration ?? null,
    });
  } catch (e) {
    console.error("[elevenlabs] fetch-conversation error:", e);
    res.status(500).json({ message: "Erro ao buscar conversa" });
  }
});

// ─── Proxy de áudio da conversa ElevenLabs ───────────────────────────────────
// Busca o áudio MP3 da conversa no ElevenLabs e faz stream para o cliente.
// Necessário pois o frontend não tem a xi-api-key.

router.get("/audio/:callId", requireAuth, async (req: Request, res: Response) => {
  try {
    const [call] = await db.select().from(calls).where(eq(calls.id, req.params.callId));
    if (!call) return res.status(404).json({ message: "Chamada não encontrada" });
    if (!call.elevenLabsConversationId) {
      return res.status(404).json({ message: "Sem conversa ElevenLabs vinculada" });
    }

    const apiKey = await getElevenLabsKey();
    if (!apiKey) return res.status(400).json({ message: "ElevenLabs não configurado" });

    const audioRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(call.elevenLabsConversationId)}/audio`,
      { headers: { "xi-api-key": apiKey } },
    );

    if (!audioRes.ok) {
      return res.status(audioRes.status).json({ message: "Áudio não disponível no ElevenLabs" });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "private, max-age=3600");
    const buffer = await audioRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (e) {
    console.error("[elevenlabs] audio proxy error:", e);
    res.status(500).json({ message: "Erro ao buscar áudio" });
  }
});

export default router;
