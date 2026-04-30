import { Router } from "express";
import {
db,
callsTable,
leadsTable,
usersTable,
campaignsTable,
leadInteractionsTable,
} from "@workspace/db";
import type { Call, Lead } from "@workspace/db";
import { eq, sql, and, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import {
getTwilioConfig,
getOpenAiKey,
getElevenLabsKey,
isRecordCallsEnabled,
getServerBaseUrl,
getTwilioIntelligenceServiceSid,
} from "../lib/twilio-config.js";
import twilio from "twilio";

const TWILIO_RECORDING_HOST_PATTERN = /^https:\/\/api\.twilio\.com\//;

type CallStatus = Call["status"];
type CallOutcome = NonNullable<Call["outcome"]>;
type CallSentiment = NonNullable<Call["sentiment"]>;
type LeadStatus = Lead["status"];

function toE164Brazil(phone: string): string {
// Strip everything except digits
const digits = phone.replace(/\D/g, "");
// Already has country code
if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
// 11 digits: DDD + 9-digit mobile (e.g. 11991234567)
if (digits.length === 11) return `+55${digits}`;
// 10 digits: DDD + 8-digit landline (e.g. 1131234567)
if (digits.length === 10) return `+55${digits}`;
// Return as-is with + prefix if nothing matches
return `+${digits}`;
}

const router = Router();

async function triggerTwilioIntelligence(
callId: number,
recordingSid: string,
): Promise<void> {
const intelligenceServiceSid = await getTwilioIntelligenceServiceSid();
if (!intelligenceServiceSid) {
console.log(
"[voice-intelligence] Intelligence Service SID não configurado, pulando.",
);
return;
}

const twilioConfig = await getTwilioConfig();
if (!twilioConfig) return;

const baseUrl = await getServerBaseUrl();
const webhookUrl = baseUrl
? `${baseUrl}/api/calls/twilio-transcription`
: null;

const formParams: Record<string, string> = {
ServiceSid: intelligenceServiceSid,
Channel: JSON.stringify({ media_properties: { source_sid: recordingSid } }),
};
if (webhookUrl) formParams.WebhookUrl = webhookUrl;

const response = await fetch(
"https://intelligence.twilio.com/v2/Transcripts",
{
method: "POST",
headers: {
"Content-Type": "application/x-www-form-urlencoded",
Authorization:
"Basic " +
Buffer.from(
`${twilioConfig.accountSid}:${twilioConfig.authToken}`,
).toString("base64"),
},
body: new URLSearchParams(formParams).toString(),
},
);

if (!response.ok) {
const text = await response.text();
throw new Error(`Voice Intelligence API error ${response.status}: ${text}`);
}

const data = (await response.json()) as { sid?: string };
console.log(
`[voice-intelligence] Transcrição solicitada — Transcript SID: ${data.sid} | Call ID: ${callId}`,
);
}

async function triggerTranscription(callId: number): Promise<void> {
const [call] = await db
.select()
.from(callsTable)
.where(eq(callsTable.id, callId));
if (!call?.recordingUrl) return;

const openaiKey = await getOpenAiKey();
if (!openaiKey) return;

const twilioConfig = await getTwilioConfig();
if (!twilioConfig) return;

const audioResponse = await fetch(call.recordingUrl, {
headers: {
Authorization:
"Basic " +
Buffer.from(
`${twilioConfig.accountSid}:${twilioConfig.authToken}`,
).toString("base64"),
},
});
if (!audioResponse.ok)
throw new Error(`Failed to download recording: ${audioResponse.status}`);

const audioBuffer = await audioResponse.arrayBuffer();
const formData = new FormData();
formData.append(
"file",
new Blob([audioBuffer], { type: "audio/mpeg" }),
"recording.mp3",
);
formData.append("model", "whisper-1");
formData.append("language", "pt");

const whisperResponse = await fetch(
"https://api.openai.com/v1/audio/transcriptions",
{
method: "POST",
headers: { Authorization: `Bearer ${openaiKey}` },
body: formData,
},
);
if (!whisperResponse.ok)
throw new Error(`Whisper API error: ${whisperResponse.status}`);

const { text: transcription } = (await whisperResponse.json()) as {
text: string;
};

const [lead] =
call.leadId != null
? await db.select().from(leadsTable).where(eq(leadsTable.id, call.leadId))
: [undefined];

const summaryPrompt = `Você é um assistente de call center. Com base na transcrição abaixo, forneça:

1. Um resumo conciso da conversa
2. Classificação de sentimento (positivo, neutro, negativo)
3. Próximo passo recomendado

Lead: ${lead?.name || "Desconhecido"} | Empresa: ${lead?.company || "N/A"} | Desfecho: ${call.outcome || "N/A"}

Transcrição:
${transcription}

Responda em JSON com os campos: resumo, sentimento, proximo_passo`;

interface OpenAIResponse {
choices: Array<{ message: { content: string } }>;
}
const sentimentMap: Record<string, CallSentiment> = {
positivo: "positivo",
neutro: "neutro",
negativo: "negativo",
};

let summary: string | null = null;
let sentiment: CallSentiment = "neutro";
let nextStep: string | null = null;

const summaryResponse = await fetch(
"https://api.openai.com/v1/chat/completions",
{
method: "POST",
headers: {
"Content-Type": "application/json",
Authorization: `Bearer ${openaiKey}`,
},
body: JSON.stringify({
model: "gpt-4o-mini",
messages: [{ role: "user", content: summaryPrompt }],
response_format: { type: "json_object" },
}),
},
);

if (summaryResponse.ok) {
const data = (await summaryResponse.json()) as OpenAIResponse;
const parsed = JSON.parse(data.choices[0].message.content) as Record<
string,
string >;
summary = parsed.resumo || null;
sentiment = sentimentMap[parsed.sentimento] || "neutro";
nextStep = parsed.proximo_passo || null;
}

await db
.update(callsTable)
.set({ transcription, summary, sentiment, nextStep })
.where(eq(callsTable.id, callId));
}

router.post("/twilio-status", async (req, res) => {
const config = await getTwilioConfig();
if (config) {
const sig = req.headers["x-twilio-signature"] as string | undefined;
if (!sig) {
if (process.env.NODE_ENV === "production") {
res.status(403).send("Forbidden");
return;
}
} else {
const baseUrl = await getServerBaseUrl();
const url = baseUrl
? `${baseUrl}${req.originalUrl}`
: `${req.protocol}://${req.get("host")}${req.originalUrl}`;
if (!twilio.validateRequest(config.authToken, sig, url, req.body)) {
res.status(403).send("Forbidden");
return;
}
}
}

const { CallSid, CallStatus, CallDuration, RecordingUrl } = req.body;
if (CallSid) {
const updates: any = {};
if (CallStatus === "completed") {
updates.status = "encerrada";
updates.endedAt = new Date();
} else if (CallStatus === "busy") {
updates.status = "ocupado";
} else if (CallStatus === "no-answer") {
updates.status = "nao_atendeu";
} else if (CallStatus === "failed") {
updates.status = "falhou";
}
if (CallDuration) updates.duration = Number(CallDuration);
if (RecordingUrl && TWILIO_RECORDING_HOST_PATTERN.test(RecordingUrl)) {
updates.recordingUrl = RecordingUrl;
}

    if (Object.keys(updates).length > 0) {
      await db
        .update(callsTable)
        .set(updates)
        .where(eq(callsTable.twilioCallSid, CallSid));
    }

}
res.json({ success: true });
});

router.post("/recording-status", async (req, res) => {
const config = await getTwilioConfig();
if (config) {
const sig = req.headers["x-twilio-signature"] as string | undefined;
if (!sig) {
if (process.env.NODE_ENV === "production") {
res.status(403).send("Forbidden");
return;
}
} else {
const baseUrl = await getServerBaseUrl();
const url = baseUrl
? `${baseUrl}${req.originalUrl}`
: `${req.protocol}://${req.get("host")}${req.originalUrl}`;
if (!twilio.validateRequest(config.authToken, sig, url, req.body)) {
res.status(403).send("Forbidden");
return;
}
}
}

const callSid = req.body.CallSid as string | undefined;
const recordingUrl = req.body.RecordingUrl as string | undefined;
const recordingSid = req.body.RecordingSid as string | undefined;
const recordingStatus = req.body.RecordingStatus as string | undefined;

if (callSid && recordingUrl && recordingStatus === "completed") {
if (!TWILIO_RECORDING_HOST_PATTERN.test(recordingUrl)) {
console.warn("Rejected recording URL from untrusted host:", recordingUrl);
res.status(400).send("Invalid recording URL");
return;
}

    const mp3Url = `${recordingUrl}.mp3`;
    try {
      await db
        .update(callsTable)
        .set({
          recordingUrl: mp3Url,
          ...(recordingSid ? { recordingSid } : {}),
        })
        .where(eq(callsTable.twilioCallSid, callSid));

      const [callRow] = await db
        .select({ id: callsTable.id })
        .from(callsTable)
        .where(eq(callsTable.twilioCallSid, callSid));

      // Trigger Twilio Voice Intelligence — transcription arrives via /twilio-transcription webhook
      if (callRow && recordingSid) {
        triggerTwilioIntelligence(callRow.id, recordingSid).catch((e) =>
          console.warn(
            "[recording-status] Falha ao acionar Voice Intelligence:",
            e,
          ),
        );
      }
    } catch (e) {
      console.warn("Failed to save recording URL:", e);
    }

}

res.status(204).send();
});

// ── Twilio Voice Intelligence webhook ────────────────────────────────────────
// Twilio posts here when the Intelligence transcription completes.
// Configure this URL in the Twilio Console under Voice Intelligence → Services.
router.post("/twilio-transcription", async (req, res) => {
// Twilio Voice Intelligence sends a JSON payload (not form-encoded)
const body = req.body as {
transcript_sid?: string;
status?: string;
channel?: {
media_properties?: { source_sid?: string };
participants?: Array<{
media_properties?: { media_channel_label?: string };
}>;
};
sentences?: Array<{
media_channel?: number;
transcript?: string;
start_time?: number;
}>;
};

// Only process completed transcriptions
if (body.status !== "completed") {
res.status(204).send();
return;
}

const recordingSid = body.channel?.media_properties?.source_sid;
if (!recordingSid) {
console.warn("[twilio-transcription] Sem source_sid no payload");
res.status(204).send();
return;
}

// Format sentences into readable text
const sentences = body.sentences || [];
const transcriptionText = sentences
.map((s) => s.transcript || "")
.filter(Boolean)
.join(" ")
.trim();

if (!transcriptionText) {
console.warn(
"[twilio-transcription] Transcrição vazia para RecordingSid:",
recordingSid,
);
res.status(204).send();
return;
}

try {
const [callRow] = await db
.select({ id: callsTable.id })
.from(callsTable)
.where(eq(callsTable.recordingSid, recordingSid));

    if (!callRow) {
      console.warn(
        "[twilio-transcription] Nenhuma chamada encontrada para RecordingSid:",
        recordingSid,
      );
      res.status(204).send();
      return;
    }

    await db
      .update(callsTable)
      .set({ twilioTranscription: transcriptionText })
      .where(eq(callsTable.id, callRow.id));

    console.log(
      `[twilio-transcription] Transcrição salva — Call ID: ${callRow.id} | TranscriptSid: ${body.transcript_sid}`,
    );

} catch (e) {
console.error("[twilio-transcription] Erro ao salvar transcrição:", e);
}

res.status(204).send();
});

router.use(requireAuth);

async function enrichCall(call: any) {
const [lead] = await db
.select()
.from(leadsTable)
.where(eq(leadsTable.id, call.leadId));
const [operator] = await db
.select()
.from(usersTable)
.where(eq(usersTable.id, call.operatorId));
const [campaign] = await db
.select()
.from(campaignsTable)
.where(eq(campaignsTable.id, call.campaignId));
const { password: \_, ...operatorWithoutPassword } = operator || {};
return {
...call,
lead: lead || null,
operator: operator ? operatorWithoutPassword : null,
campaign: campaign || null,
};
}

router.get("/", async (req, res) => {
const page = Number(req.query.page) || 1;
const limit = Number(req.query.limit) || 20;
const offset = (page - 1) \* limit;
const status = req.query.status as string | undefined;
const campaignId = req.query.campaignId
? Number(req.query.campaignId)
: undefined;
const operatorId = req.query.operatorId
? Number(req.query.operatorId)
: undefined;
const leadId = req.query.leadId ? Number(req.query.leadId) : undefined;

const conditions = [];
if (status) conditions.push(eq(callsTable.status, status as CallStatus));
if (campaignId) conditions.push(eq(callsTable.campaignId, campaignId));
if (operatorId) conditions.push(eq(callsTable.operatorId, operatorId));
if (leadId) conditions.push(eq(callsTable.leadId, leadId));

const where = conditions.length > 0 ? and(...conditions) : undefined;

const [countResult] = await db
.select({ count: sql<number>`count(*)` })
.from(callsTable)
.where(where);
const total = Number(countResult.count);

const calls = await db
.select()
.from(callsTable)
.where(where)
.limit(limit)
.offset(offset)
.orderBy(desc(callsTable.createdAt));

const enriched = await Promise.all(calls.map(enrichCall));

res.json({
data: enriched,
meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
});
});

router.post("/", async (req, res) => {
const { leadId, campaignId, operatorId, browserSdk } = req.body;
if (!leadId || !campaignId || !operatorId) {
res.status(400).json({
error: "bad_request",
message: "leadId, campaignId e operatorId são obrigatórios",
});
return;
}

const [lead] = await db
.select()
.from(leadsTable)
.where(eq(leadsTable.id, leadId));
if (!lead) {
res
.status(404)
.json({ error: "not_found", message: "Lead não encontrado" });
return;
}

let twilioCallSid: string | null = null;
let callStatus: CallStatus = "iniciando";
let usedTwilio = false;

if (browserSdk) {
callStatus = "iniciando";
usedTwilio = true;
} else {
const twilioConfig = await getTwilioConfig();

    if (twilioConfig) {
      try {
        const recordEnabled = await isRecordCallsEnabled();
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioConfig.accountSid}/Calls.json`;
        const params = new URLSearchParams({
          To: toE164Brazil(lead.phone),
          From: twilioConfig.fromNumber,
          Twiml:
            '<Response><Say language="pt-BR">Aguarde, conectando com o atendente.</Say><Pause length="30"/></Response>',
          ...(twilioConfig.statusCallbackUrl
            ? {
                StatusCallback: twilioConfig.statusCallbackUrl,
                StatusCallbackMethod: "POST",
              }
            : {}),
          ...(recordEnabled
            ? {
                Record: "true",
                RecordingChannels: "dual",
                RecordingStatusCallback: `${req.protocol}://${req.get("host")}/api/calls/recording-status`,
                RecordingStatusCallbackMethod: "POST",
              }
            : {}),
        });

        const response = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization:
              "Basic " +
              Buffer.from(
                `${twilioConfig.accountSid}:${twilioConfig.authToken}`,
              ).toString("base64"),
          },
          body: params.toString(),
        });

        if (response.ok) {
          const data = (await response.json()) as Record<string, string>;
          twilioCallSid = data.sid;
          callStatus = "em_andamento";
          usedTwilio = true;
        } else {
          console.warn("Twilio error:", await response.text());
        }
      } catch (e) {
        console.warn("Twilio error:", e);
      }
    }

}

const [call] = await db
.insert(callsTable)
.values({
leadId,
campaignId,
operatorId,
twilioCallSid,
status: callStatus,
startedAt: new Date(),
})
.returning();

await db
.update(leadsTable)
.set({ status: "contactado", updatedAt: new Date() })
.where(eq(leadsTable.id, leadId));

await db.insert(leadInteractionsTable).values({
leadId,
type: "chamada",
description: `Chamada iniciada`,
userId: operatorId,
});

const enriched = await enrichCall(call);
const responsePayload = {
...enriched,
usedTwilio,
e164Phone: toE164Brazil(lead.phone),
};
res.status(201).json(responsePayload);
});

router.get("/:id", async (req, res) => {
const id = Number(req.params.id);
const [call] = await db
.select()
.from(callsTable)
.where(eq(callsTable.id, id));
if (!call) {
res
.status(404)
.json({ error: "not_found", message: "Chamada não encontrada" });
return;
}
const enriched = await enrichCall(call);
res.json(enriched);
});

router.put("/:id", async (req, res) => {
const id = Number(req.params.id);
const { status, outcome, notes, duration } = req.body;

const updates: any = {};
if (status !== undefined) updates.status = status;
if (outcome !== undefined) updates.outcome = outcome;
if (notes !== undefined) updates.notes = notes;
if (duration !== undefined) updates.duration = duration;

const [call] = await db
.update(callsTable)
.set(updates)
.where(eq(callsTable.id, id))
.returning();
if (!call) {
res
.status(404)
.json({ error: "not_found", message: "Chamada não encontrada" });
return;
}

const enriched = await enrichCall(call);
res.json(enriched);
});

router.post("/:id/end", async (req, res) => {
const id = Number(req.params.id);
const { outcome, notes, duration } = req.body;

if (!outcome) {
res
.status(400)
.json({ error: "bad_request", message: "Desfecho é obrigatório" });
return;
}

const statusMap: Record<string, CallStatus> = {
atendeu: "encerrada",
nao_atendeu: "nao_atendeu",
ocupado: "ocupado",
caixa_postal: "caixa_postal",
numero_invalido: "falhou",
convertido: "encerrada",
reagendado: "encerrada",
};

const [call] = await db
.update(callsTable)
.set({
status: statusMap[outcome] || ("encerrada" as CallStatus),
outcome: outcome as CallOutcome,
notes: notes || null,
duration: duration || null,
endedAt: new Date(),
})
.where(eq(callsTable.id, id))
.returning();

if (!call) {
res
.status(404)
.json({ error: "not_found", message: "Chamada não encontrada" });
return;
}

const leadStatusMap: Record<string, LeadStatus> = {
atendeu: "contactado",
nao_atendeu: "nao_atendeu",
ocupado: "ocupado",
caixa_postal: "caixa_postal",
numero_invalido: "desqualificado",
convertido: "convertido",
reagendado: "contactado",
};
const newLeadStatus: LeadStatus = leadStatusMap[outcome] || "contactado";
if (call.leadId != null) {
await db
.update(leadsTable)
.set({ status: newLeadStatus, updatedAt: new Date() })
.where(eq(leadsTable.id, call.leadId));
}

// Log interaction
if (call.leadId != null)
await db.insert(leadInteractionsTable).values({
leadId: call.leadId,
type: "chamada",
description: `Chamada encerrada. Desfecho: ${outcome}. Duração: ${duration || 0}s`,
userId: call.operatorId,
});

const enriched = await enrichCall(call);
res.json(enriched);
});

// Fetch transcription from ElevenLabs API when the webhook didn't arrive
const TWILIO_SID_PATTERN = /^CA[a-f0-9]{32}$/i;

router.post("/:id/sync-transcript", requireAuth, async (req, res) => {
const id = Number(req.params.id);
const [call] = await db
.select()
.from(callsTable)
.where(eq(callsTable.id, id));
if (!call) {
res.status(404).json({ error: "not_found", message: "Chamada não encontrada" });
return;
}

// Already have ElevenLabs transcription — nothing to do
if (call.transcription) {
res.json(await enrichCall(call));
return;
}

const convId = call.elevenLabsConversationId;
if (convId && !TWILIO_SID_PATTERN.test(convId)) {
const elevenLabsKey = await getElevenLabsKey();
if (elevenLabsKey) {
try {
const elResp = await fetch(
`https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(convId)}`,
{ headers: { "xi-api-key": elevenLabsKey } },
);
if (elResp.ok) {
const data = (await elResp.json()) as {
transcript?: Array<{ role: string; message?: string | null }>;
analysis?: { transcript_summary?: string };
status?: string;
metadata?: { duration?: number };
};

          const transcriptText = (data.transcript ?? [])
            .filter((t) => t.message?.trim())
            .map((t) => `${t.role === "agent" ? "Agent" : "Cliente"}: ${t.message}`)
            .join("\n");

          const updates: Record<string, unknown> = {};
          if (transcriptText) updates.transcription = transcriptText;
          if (data.analysis?.transcript_summary) updates.summary = data.analysis.transcript_summary;
          if (data.metadata?.duration) updates.duration = data.metadata.duration;
          if (data.status === "done" || data.status === "completed") {
            updates.status = "encerrada";
            updates.endedAt = new Date();
          }
          if (Object.keys(updates).length > 0) {
            await db.update(callsTable).set(updates).where(eq(callsTable.id, id));
          }
          console.log(`[sync-transcript] Transcrição sincronizada do ElevenLabs — Call ID: ${id}`);
        } else {
          const body = await elResp.text();
          console.warn(`[sync-transcript] ElevenLabs retornou ${elResp.status}:`, body);
        }
      } catch (e) {
        console.warn("[sync-transcript] Falha ao buscar do ElevenLabs:", e);
      }
    }

}

const [updated] = await db.select().from(callsTable).where(eq(callsTable.id, id));
res.json(await enrichCall(updated ?? call));
});

router.post("/:id/transcribe", async (req, res) => {
const id = Number(req.params.id);
const [call] = await db
.select()
.from(callsTable)
.where(eq(callsTable.id, id));
if (!call) {
res
.status(404)
.json({ error: "not_found", message: "Chamada não encontrada" });
return;
}
if (!call.recordingUrl) {
res.status(400).json({
error: "no_recording",
message: "Esta chamada não possui gravação disponível para transcrição",
});
return;
}

const openaiKey = await getOpenAiKey();
if (!openaiKey) {
res.json({
callId: id,
transcription: call.transcription,
summary: call.summary,
sentiment: call.sentiment,
nextStep: call.nextStep,
});
return;
}

try {
await triggerTranscription(id);
const [updated] = await db
.select()
.from(callsTable)
.where(eq(callsTable.id, id));
res.json({
callId: id,
transcription: updated?.transcription,
summary: updated?.summary,
sentiment: updated?.sentiment,
nextStep: updated?.nextStep,
});
} catch (e) {
console.error("Transcription error:", e);
res.status(500).json({
error: "transcription_failed",
message: "Falha ao transcrever a chamada",
});
}
});

export default router;
