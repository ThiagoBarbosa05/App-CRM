import { Router } from "express";
import {
db,
callsTable,
leadsTable,
campaignTriggersTable,
notificationsTable,
campaignOperatorsTable,
leadInteractionsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { getElevenLabsKey } from "../lib/twilio-config.js";

const router = Router();

router.post("/decision", async (req, res) => {
const body = req.body as Record<string, string | undefined>;
// ElevenLabs pode enviar "decisao" (pt) ou "decision" (en) dependendo da tool configurada
const decision = body.decision ?? body.decisao;
const callSid = body.callSid;
const context = body.context;
const conversationId = body.conversationId;

if (!decision || !["sim", "nao", "sem_resposta"].includes(decision)) {
res.status(400).json({
error: "invalid_decision",
message: "decision deve ser sim|nao|sem_resposta",
});
return;
}
if (!callSid) {
res.status(400).json({
error: "callSid_required",
message:
"callSid é obrigatório — adicione o parâmetro callSid com variável dinâmica {{callSid}} na tool do ElevenLabs",
});
return;
}

const [call] = await db
.select()
.from(callsTable)
.where(eq(callsTable.twilioCallSid, callSid));
if (!call) {
// Retorna 200 para o ElevenLabs não retentar
console.warn(
"ElevenLabs /decision: chamada não encontrada para callSid:",
callSid,
);
res.status(200).json({ ok: true, warning: "call_not_found" });
return;
}

const outcomeMap = {
sim: "convertido",
nao: "atendeu",
sem_resposta: "atendeu",
} as const;
const leadStatusMap = {
sim: "convite_aceito",
nao: "convite_recusado",
sem_resposta: "contactado",
} as const;
const key = decision as keyof typeof outcomeMap;

// Never update elevenLabsConversationId here: the tool sends back the
// callSid (used as a placeholder for {{conversation_id}}), not the real
// ElevenLabs conversation ID. The real ID is captured from the TwiML or
// the post-call webhook.
await db
.update(callsTable)
.set({
aiDecision: key,
outcome: outcomeMap[key],
})
.where(eq(callsTable.id, call.id));

if (call.leadId) {
await db
.update(leadsTable)
.set({ status: leadStatusMap[key], updatedAt: new Date() })
.where(eq(leadsTable.id, call.leadId));

    await db.insert(leadInteractionsTable).values({
      leadId: call.leadId,
      type: "decisao_ia",
      description: `Decisão IA: ${decision}${context ? `. Contexto: ${context}` : ""}`,
      userId: call.operatorId,
    });

}

if (call.campaignId) {
const [lead] = call.leadId
? await db
.select({ name: leadsTable.name })
.from(leadsTable)
.where(eq(leadsTable.id, call.leadId))
: [null];

    const label =
      decision === "sim"
        ? "SIM (interessado)"
        : decision === "nao"
          ? "NÃO (não interessado)"
          : "sem resposta";
    const message = `Lead "${lead?.name ?? "Desconhecido"}" respondeu ${label} ao convite.`;

    const operators = await db
      .select({ userId: campaignOperatorsTable.userId })
      .from(campaignOperatorsTable)
      .where(eq(campaignOperatorsTable.campaignId, call.campaignId));

    const recipientIds = [
      ...new Set([...operators.map((o) => o.userId), call.operatorId]),
    ];
    for (const userId of recipientIds) {
      await db.insert(notificationsTable).values({
        userId,
        callId: call.id,
        leadId: call.leadId ?? undefined,
        message,
      });
    }

}

res.status(200).json({ ok: true, decision, callSid });
});

router.post("/webhook", async (req, res) => {
const body = req.body as Record<string, any>;

// ElevenLabs post-call webhook wraps everything in a "data" field
// Format: { type: "post_call_transcription", data: { conversation_id, status, transcript, analysis } }
const data: Record<string, any> = body.type ? (body.data ?? {}) : body;

const conversationId = data.conversation_id as string | undefined;
const status = data.status as string | undefined;

// transcript can be an array of turns (ElevenLabs format) or a plain string (legacy)
const rawTranscript = data.transcript;
let transcript: string | undefined;
if (Array.isArray(rawTranscript)) {
transcript = rawTranscript
.filter((t: { role: string; message?: string | null }) => t.message?.trim())
.map((t: { role: string; message: string }) => {
const prefix = t.role === "agent" ? "Agent" : "Cliente";
return `${prefix}: ${t.message}`;
})
.join("\n");
} else if (typeof rawTranscript === "string") {
transcript = rawTranscript;
}

const analysis = data.analysis as Record<string, any> | undefined;

if (!conversationId) {
res.status(400).json({ error: "conversation_id required" });
return;
}

const [call] = await db
.select()
.from(callsTable)
.where(eq(callsTable.elevenLabsConversationId, conversationId));

if (!call) {
console.warn(
"ElevenLabs webhook: call not found for conversation_id:",
conversationId,
);
res.status(200).json({ ok: true });
return;
}

const updates: Record<string, any> = {};
if (transcript) updates.transcription = transcript;
if (analysis?.transcript_summary)
updates.summary = analysis.transcript_summary;
else if (analysis?.summary) updates.summary = analysis.summary;
if (status === "done" || status === "completed") {
updates.status = "encerrada";
updates.endedAt = new Date();
}

if (Object.keys(updates).length > 0) {
await db.update(callsTable).set(updates).where(eq(callsTable.id, call.id));
}

// Only fall back to "contactado" if no aiDecision was already captured by the
// /decision endpoint — that handler sets the correct status (convite_aceito /
// convite_recusado / contactado) and must not be overwritten here.
if (call.leadId && !call.aiDecision) {
await db
.update(leadsTable)
.set({ status: "contactado", updatedAt: new Date() })
.where(eq(leadsTable.id, call.leadId));
}

if (transcript && call.campaignId) {
const triggers = await db
.select()
.from(campaignTriggersTable)
.where(eq(campaignTriggersTable.campaignId, call.campaignId));

    const lowerTranscript = transcript.toLowerCase();

    for (const trigger of triggers) {
      if (lowerTranscript.includes(trigger.keyword.toLowerCase())) {
        const excerptIndex = lowerTranscript.indexOf(
          trigger.keyword.toLowerCase(),
        );
        const start = Math.max(0, excerptIndex - 60);
        const end = Math.min(
          transcript.length,
          excerptIndex + trigger.keyword.length + 60,
        );
        const excerpt =
          (start > 0 ? "..." : "") +
          transcript.slice(start, end) +
          (end < transcript.length ? "..." : "");

        const [lead] = call.leadId
          ? await db
              .select({ name: leadsTable.name })
              .from(leadsTable)
              .where(eq(leadsTable.id, call.leadId))
          : [null];

        const message = trigger.instruction
          ? `Lead "${lead?.name || "Desconhecido"}" disse "${trigger.keyword}". Ação: ${trigger.instruction}`
          : `Lead "${lead?.name || "Desconhecido"}" disse "${trigger.keyword}" durante ligação IA.`;

        const operators = await db
          .select({ userId: campaignOperatorsTable.userId })
          .from(campaignOperatorsTable)
          .where(eq(campaignOperatorsTable.campaignId, call.campaignId));

        const recipientIds = operators.map((o) => o.userId);
        if (!recipientIds.includes(call.operatorId)) {
          recipientIds.push(call.operatorId);
        }

        for (const userId of recipientIds) {
          await db.insert(notificationsTable).values({
            userId,
            callId: call.id,
            leadId: call.leadId || undefined,
            triggerId: trigger.id,
            message,
            excerpt,
          });
        }
      }
    }

}

res.status(200).json({ ok: true });
});

// Busca transcrição e áudio de uma conversa ElevenLabs on-demand
router.get(
"/conversation/:conversationId/fetch",
requireAuth,
async (req, res) => {
const conversationId = req.params.conversationId as string;
const elevenLabsKey = await getElevenLabsKey();

    if (!elevenLabsKey) {
      res.status(500).json({
        error: "elevenlabs_key_missing",
        message: "API key do ElevenLabs não configurada",
      });
      return;
    }

    try {
      const elResp = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}`,
        { headers: { "xi-api-key": elevenLabsKey } },
      );

      if (!elResp.ok) {
        const body = await elResp.text();
        res
          .status(elResp.status)
          .json({ error: "elevenlabs_error", message: body });
        return;
      }

      const data = (await elResp.json()) as {
        conversation_id: string;
        status: string;
        transcript?: Array<{
          role: string;
          message: string;
          time_in_call_secs?: number;
        }>;
        metadata?: { duration?: number };
        analysis?: { transcript_summary?: string };
        has_audio?: boolean;
      };

      // Format transcript as "Agent: ...\nCliente: ..." for TranscriptModal
      // Filter out tool-call turns that have no speech content (message is null/empty)
      const transcriptText = (data.transcript ?? [])
        .filter((t) => t.message?.trim())
        .map((t) => {
          const prefix = t.role === "agent" ? "Agent" : "Cliente";
          return `${prefix}: ${t.message}`;
        })
        .join("\n");

      const summary = data.analysis?.transcript_summary ?? null;

      // Persist to DB if call exists
      const [call] = await db
        .select()
        .from(callsTable)
        .where(eq(callsTable.elevenLabsConversationId, conversationId));

      if (call) {
        const updates: Record<string, unknown> = {};
        if (transcriptText) updates.transcription = transcriptText;
        if (summary) updates.summary = summary;
        if (data.metadata?.duration) updates.duration = data.metadata.duration;
        if (data.status === "done" || data.status === "completed") {
          updates.status = "encerrada";
        }
        if (Object.keys(updates).length > 0) {
          await db
            .update(callsTable)
            .set(updates)
            .where(eq(callsTable.id, call.id));
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
      console.error("[ElevenLabs] fetch-conversation error:", e);
      res.status(500).json({ error: "fetch_failed", message: String(e) });
    }

},
);

export default router;
