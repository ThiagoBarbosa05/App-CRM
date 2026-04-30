import { Router, Request, Response } from "express";
import \* as https from "https";
import { requireAuth } from "../lib/auth.js";
import {
getTwilioVoiceSdkConfig,
getTwilioConfig,
isRecordCallsEnabled,
getTwilioChannels,
getElevenLabsVoiceId,
getElevenLabsKey,
getServerBaseUrl,
toE164Brazil,
} from "../lib/twilio-config.js";
import {
db,
callsTable,
campaignsTable,
leadsTable,
leadInteractionsTable,
} from "@workspace/db";
import type { Call } from "@workspace/db";
import { eq } from "drizzle-orm";
import twilio from "twilio";

type CallStatus = Call["status"];

const router = Router();

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

interface AuthenticatedRequest extends Express.Request {
user: { id: number; username: string; role: string };
}

const TWILIO_RECORDING_HOST_PATTERN = /^https:\/\/api\.twilio\.com\//;

async function validateTwilioWebhook(
req: Request,
res: Response,
): Promise<boolean> {
const config = await getTwilioConfig();
if (!config) {
res.status(503).send("Twilio not configured");
return false;
}

const twilioSignature = req.headers["x-twilio-signature"] as
| string
| undefined;
if (!twilioSignature) {
if (process.env.NODE_ENV === "production") {
console.warn("Missing Twilio signature on webhook request");
res.status(403).send("Forbidden");
return false;
}
return true;
}

const baseUrl = await getServerBaseUrl();
const url = baseUrl
? `${baseUrl}${req.originalUrl}`
: `${req.protocol}://${req.get("host")}${req.originalUrl}`;
const valid = twilio.validateRequest(
config.authToken,
twilioSignature,
url,
req.body,
);
if (!valid) {
console.warn("Invalid Twilio signature on webhook request");
res.status(403).send("Forbidden");
return false;
}

return true;
}

router.get("/token", requireAuth, async (req, res) => {
const user = (req as unknown as AuthenticatedRequest).user;
const sdkConfig = await getTwilioVoiceSdkConfig();

if (!sdkConfig) {
res.status(503).json({
error: "voice_sdk_not_configured",
message:
"Twilio Voice SDK não está configurado. Configure API Key, API Secret e TwiML App SID nas configurações.",
});
return;
}

const identity = `operator_${user.id}`;
const token = new AccessToken(
sdkConfig.accountSid,
sdkConfig.apiKey,
sdkConfig.apiSecret,
{ identity, ttl: 3600 },
);

const voiceGrant = new VoiceGrant({
outgoingApplicationSid: sdkConfig.twimlAppSid,
incomingAllow: false,
});
token.addGrant(voiceGrant);

res.json({
token: token.toJwt(),
identity,
});
});

router.get("/voice-sdk-status", requireAuth, async (\_req, res) => {
const sdkConfig = await getTwilioVoiceSdkConfig();
res.json({ configured: !!sdkConfig });
});

router.get("/channels", requireAuth, async (\_req, res) => {
const channels = await getTwilioChannels();
res.json({ channels });
});

router.post("/configure-voice-url", requireAuth, async (\_req, res) => {
const config = await getTwilioConfig();
const sdkConfig = await getTwilioVoiceSdkConfig();
const baseUrl = await getServerBaseUrl();

if (!config || !sdkConfig) {
res.status(400).json({
error: "Configure Account SID, Auth Token e TwiML App SID primeiro",
});
return;
}
if (!baseUrl) {
res
.status(400)
.json({ error: "Configure a URL pública do servidor primeiro" });
return;
}

const voiceUrl = `${baseUrl}/api/twilio/voice`;
const response = await fetch(
`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Applications/${sdkConfig.twimlAppSid}.json`,
{
method: "POST",
headers: {
"Content-Type": "application/x-www-form-urlencoded",
Authorization:
"Basic " +
Buffer.from(`${config.accountSid}:${config.authToken}`).toString(
"base64",
),
},
body: new URLSearchParams({
VoiceUrl: voiceUrl,
VoiceMethod: "POST",
}).toString(),
},
);

if (!response.ok) {
const err = await response.text();
res.status(500).json({ error: `Twilio API error: ${err}` });
return;
}
res.json({ ok: true, voiceUrl });
});

router.post("/voice", async (req, res) => {
const valid = await validateTwilioWebhook(req, res);
if (!valid) return;

const config = await getTwilioConfig();
const to = (req.body.To || req.query.To) as string | undefined;
const callRecordId = (req.body.callRecordId || req.query.callRecordId) as
| string
| undefined;
const campaignType = (req.body.campaignType || req.query.campaignType) as
| string
| undefined;
const elevenlabsAgentId = (req.body.elevenlabsAgentId ||
req.query.elevenlabsAgentId) as string | undefined;
const elevenLabsVoiceId = (req.body.elevenLabsVoiceId ||
req.query.elevenLabsVoiceId) as string | undefined;

const defaultFromNumber = config?.fromNumber
? toE164Brazil(config.fromNumber)
: null;
const requestedCallerId = (req.body.callerId || req.query.callerId) as
| string
| undefined;
let fromNumber = defaultFromNumber;
if (requestedCallerId) {
const normalizedRequested = toE164Brazil(requestedCallerId);
const channels = await getTwilioChannels();
const allowed = channels.some((c) => c.number === normalizedRequested);
if (allowed) {
fromNumber = normalizedRequested;
} else {
console.warn(
"Rejected unknown callerId on /voice:",
requestedCallerId,
"(normalized:",
normalizedRequested,
")",
);
}
}
const recordEnabled = await isRecordCallsEnabled();
const twiml = new twilio.twiml.VoiceResponse();

if (!fromNumber) {
twiml.say({ language: "pt-BR" }, "Número de origem não configurado.");
res.type("text/xml").send(twiml.toString());
return;
}

if (callRecordId) {
const id = Number(callRecordId);
const callSid = req.body.CallSid as string | undefined;
if (callSid && !isNaN(id) && id > 0) {
try {
const [existing] = await db
.select({ id: callsTable.id })
.from(callsTable)
.where(eq(callsTable.id, id));
if (existing) {
const newStatus: CallStatus = "em_andamento";
await db
.update(callsTable)
.set({ twilioCallSid: callSid, status: newStatus })
.where(eq(callsTable.id, id));
}
} catch (e) {
console.warn("Failed to update call record with SID:", e);
}
}
}

if (campaignType === "ia" && elevenlabsAgentId) {
const callSidForAgent = req.body.CallSid as string | undefined;
const fromNumber2 = req.body.From as string | undefined;
const toNumber2 = req.body.To as string | undefined;

    const effectiveVoiceId =
      elevenLabsVoiceId || (await getElevenLabsVoiceId());
    const elevenLabsKey = await getElevenLabsKey();

    const dynamicVars: Record<string, string> = {};
    if (callSidForAgent) {
      dynamicVars.callSid = callSidForAgent;
      // ElevenLabs tools may require {{conversation_id}} as a dynamic variable.
      // We don't have the real ElevenLabs conversation_id yet (assigned by register-call),
      // so we seed it with callSid as a stable identifier. The real conversation_id
      // is extracted from the TwiML response and stored in the DB separately.
      dynamicVars.conversation_id = callSidForAgent;
    }

    const configOverride: Record<string, unknown> = {};
    if (effectiveVoiceId) configOverride.tts = { voice_id: effectiveVoiceId };

    console.log("[TwiML /voice] Chamando ElevenLabs register-call:");
    console.log("  agent_id    :", elevenlabsAgentId);
    console.log("  from        :", fromNumber2);
    console.log("  to          :", toNumber2);
    console.log(
      "  xi-api-key  :",
      elevenLabsKey ? `${elevenLabsKey.slice(0, 8)}...` : "❌ NÃO CONFIGURADA",
    );
    console.log("  dynamic_vars:", JSON.stringify(dynamicVars));

    try {
      const requestBody: Record<string, unknown> = {
        agent_id: elevenlabsAgentId,
        from_number: fromNumber2 ?? "",
        to_number: toNumber2 ?? "",
        direction: "outbound",
        conversation_initiation_client_data: {
          dynamic_variables: dynamicVars,
          ...(Object.keys(configOverride).length > 0
            ? { conversation_config_override: configOverride }
            : {}),
        },
      };

      const elResp = await fetch(
        "https://api.elevenlabs.io/v1/convai/twilio/register-call",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(elevenLabsKey ? { "xi-api-key": elevenLabsKey } : {}),
          },
          body: JSON.stringify(requestBody),
        },
      );

      const twimlXml = await elResp.text();
      console.log(
        `[TwiML /voice] ElevenLabs register-call status: ${elResp.status}`,
      );
      console.log("[TwiML /voice] TwiML recebido do ElevenLabs:\n", twimlXml);

      if (!elResp.ok) {
        throw new Error(
          `ElevenLabs register-call error ${elResp.status}: ${twimlXml}`,
        );
      }

      // Extract and persist the real ElevenLabs conversation_id from the TwiML.
      // The <Parameter> element may have attributes in any order and use
      // single or double quotes, so we check both orderings.
      const convIdMatch =
        twimlXml.match(
          /name=["']conversation_id["']\s+value=["']([^"']+)["']/,
        ) ??
        twimlXml.match(/value=["']([^"']+)["']\s+name=["']conversation_id["']/);
      if (convIdMatch && callSidForAgent) {
        const elevenLabsConversationId = convIdMatch[1];
        console.log(
          "[TwiML /voice] ElevenLabs conversation_id:",
          elevenLabsConversationId,
        );
        db.update(callsTable)
          .set({ elevenLabsConversationId })
          .where(eq(callsTable.twilioCallSid, callSidForAgent))
          .catch((e) =>
            console.error("[TwiML /voice] Failed to store conversation_id:", e),
          );
      } else {
        console.warn(
          "[TwiML /voice] conversation_id não encontrado no TwiML — transcrição on-demand indisponível para este CallSid:",
          callSidForAgent,
        );
      }

      res.type("text/xml").send(twimlXml);
    } catch (e) {
      console.error("[TwiML /voice] Erro ao chamar register-call:", e);
      const fallback = new twilio.twiml.VoiceResponse();
      fallback.say(
        { language: "pt-BR" },
        "Erro ao conectar com o agente de IA.",
      );
      res.type("text/xml").send(fallback.toString());
    }
    return;

} else if (to) {
const dialAttrs: Record<string, string> = { callerId: fromNumber };

    if (recordEnabled) {
      dialAttrs.record = "record-from-answer";
      const host = req.get("host") || "";
      const protocol = req.protocol || "https";
      dialAttrs.recordingStatusCallback = `${protocol}://${host}/api/calls/recording-status`;
      dialAttrs.recordingStatusCallbackMethod = "POST";
    }

    const dial = twiml.dial(dialAttrs);
    dial.number(to);

} else {
twiml.say({ language: "pt-BR" }, "Nenhum número de destino informado.");
}

res.type("text/xml");
const twimlXml = twiml.toString();
console.log("[TwiML /voice] XML enviado ao Twilio:\n", twimlXml);
res.send(twimlXml);
});

router.post("/test-call", requireAuth, async (req, res) => {
const config = await getTwilioConfig();
const baseUrl = await getServerBaseUrl();

if (!config) {
res.status(400).json({ error: "Twilio não configurado" });
return;
}
if (!baseUrl) {
res
.status(400)
.json({ error: "Configure a URL pública do servidor primeiro" });
return;
}

let { phone } = req.body as { phone?: string };
const { elevenlabsAgentId, elevenLabsVoiceId, callerId, leadId } =
req.body as {
elevenlabsAgentId?: string;
elevenLabsVoiceId?: string;
callerId?: string;
leadId?: number;
};

if (!elevenlabsAgentId) {
res.status(400).json({ error: "ElevenLabs Agent ID obrigatório" });
return;
}

let resolvedLeadId: number | undefined;
let resolvedCampaignId: number | undefined;

if (leadId) {
const [lead] = await db
.select()
.from(leadsTable)
.where(eq(leadsTable.id, leadId));
if (!lead) {
res.status(400).json({ error: "Lead não encontrado" });
return;
}
resolvedLeadId = lead.id;
resolvedCampaignId = lead.campaignId ?? undefined;
if (!phone) phone = lead.phone;
}

if (!phone) {
res.status(400).json({ error: "Número de telefone obrigatório" });
return;
}

let fromNumber = config.fromNumber;
if (callerId) {
const normalizedCallerId = toE164Brazil(callerId);
const channels = await getTwilioChannels();
if (channels.some((c) => c.number === normalizedCallerId)) {
fromNumber = normalizedCallerId;
}
}

const to = toE164Brazil(phone);
const twimlUrl = `${baseUrl}/api/twilio/voice?campaignType=ia&elevenlabsAgentId=${encodeURIComponent(elevenlabsAgentId)}${elevenLabsVoiceId ? `&elevenLabsVoiceId=${encodeURIComponent(elevenLabsVoiceId)}` : ""}`;

const params = new URLSearchParams({
To: to,
From: fromNumber,
Url: twimlUrl,
Record: "true",
RecordingStatusCallback: `${baseUrl}/api/calls/recording-status`,
RecordingStatusCallbackMethod: "POST",
...(config.statusCallbackUrl
? {
StatusCallback: config.statusCallbackUrl,
StatusCallbackMethod: "POST",
}
: {}),
});

console.log("[test-call] Iniciando chamada via Twilio API:");
console.log(" To :", to);
console.log(" From :", fromNumber);
console.log(" TwiML URL :", twimlUrl);
console.log(
" StatusCallback :",
config.statusCallbackUrl || "(não configurado)",
);
console.log(" AccountSid :", config.accountSid);
console.log(" elevenlabsAgent :", elevenlabsAgentId);
console.log(" elevenLabsVoice :", elevenLabsVoiceId || "(não informado)");

const response = await fetch(
`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json`,
{
method: "POST",
headers: {
"Content-Type": "application/x-www-form-urlencoded",
Authorization:
"Basic " +
Buffer.from(`${config.accountSid}:${config.authToken}`).toString(
"base64",
),
},
body: params.toString(),
},
);

if (!response.ok) {
const err = await response.text();
console.error("[test-call] Twilio API retornou erro:", err);
res.status(500).json({ error: `Twilio API error: ${err}` });
return;
}

const data = (await response.json()) as Record<string, string>;
console.log(
"[test-call] Chamada criada com sucesso — SID:",
data.sid,
"| status:",
data.status,
);

// Insert a call record so it appears in /chamadas
const user = (req as unknown as AuthenticatedRequest).user;
let callRecordId: number | undefined;
try {
const [inserted] = await db
.insert(callsTable)
.values({
operatorId: user.id,
leadId: resolvedLeadId,
campaignId: resolvedCampaignId,
twilioCallSid: data.sid,
status: "iniciando",
startedAt: new Date(),
})
.returning({ id: callsTable.id });
callRecordId = inserted?.id;
console.log("[test-call] Registro criado no banco — id:", callRecordId);

    if (resolvedLeadId) {
      await db.insert(leadInteractionsTable).values({
        leadId: resolvedLeadId,
        type: "chamada",
        description: `Teste ElevenLabs iniciado — agent: ${elevenlabsAgentId}`,
        userId: user.id,
      });
    }

} catch (e) {
console.error("[test-call] Falha ao inserir registro no banco:", e);
}

res.json({
ok: true,
callSid: data.sid,
to,
status: data.status,
callRecordId,
});
});

// Rota de diagnóstico: testa se o agente ElevenLabs é acessível com a key configurada
router.get("/diagnose-elevenlabs/:agentId", async (req, res) => {
const { agentId } = req.params;
const elevenLabsKey = await getElevenLabsKey();

if (!elevenLabsKey) {
res.json({ ok: false, error: "ELEVENLABS_API_KEY não configurada" });
return;
}

try {
const response = await fetch(
`https://api.elevenlabs.io/v1/convai/agents/${agentId}`,
{ headers: { "xi-api-key": elevenLabsKey } },
);
const body = (await response.json()) as Record<string, unknown>;
res.json({
ok: response.ok,
httpStatus: response.status,
agentId,
keyPrefix: elevenLabsKey.slice(0, 8) + "...",
response: body,
});
} catch (e) {
res.json({ ok: false, error: (e as Error).message });
}
});

// Rota de diagnóstico: testa handshake WebSocket com ElevenLabs
router.get("/diagnose-elevenlabs-ws/:agentId", async (req, res) => {
const { agentId } = req.params;
const elevenLabsKey = await getElevenLabsKey();

const wsUrl = new URL(`https://api.elevenlabs.io/v1/convai/twilio`);
wsUrl.searchParams.set("agent_id", agentId);
if (elevenLabsKey) wsUrl.searchParams.set("xi-api-key", elevenLabsKey);

const result = await new Promise<{
status: number;
statusText: string;
headers: Record<string, string | string[] | undefined>;
body: string;
}>((resolve, reject) => {
const reqOpts: https.RequestOptions = {
hostname: "api.elevenlabs.io",
path: `/v1/convai/twilio?${wsUrl.searchParams.toString()}`,
method: "GET",
headers: {
Upgrade: "websocket",
Connection: "Upgrade",
"Sec-WebSocket-Key": Buffer.from("elevenlabs-diag-test-key").toString(
"base64",
),
"Sec-WebSocket-Version": "13",
Host: "api.elevenlabs.io",
},
};
const r = https.request(reqOpts, (resp) => {
let body = "";
resp.on("data", (chunk: Buffer) => {
body += chunk.toString();
});
resp.on("end", () => {
console.log("[diagnose-ws] ElevenLabs response body:", body);
resolve({
status: resp.statusCode ?? 0,
statusText: resp.statusMessage ?? "",
headers: resp.headers as Record<
string,
string | string[] | undefined >,
body,
});
});
});
r.on("upgrade", (\_resp, \_socket, \_head) => {
resolve({
status: 101,
statusText: "Switching Protocols",
headers: {},
body: "",
});
});
r.on("error", (e: Error) => reject(e));
r.end();
}).catch((e: Error) => ({
status: 0,
statusText: e.message,
headers: {},
body: "",
}));

console.log("[diagnose-ws] ElevenLabs WebSocket handshake result:", result);
res.json({
agentId,
wsUrl: wsUrl.toString().replace(elevenLabsKey ?? "", "<key>"),
...result,
});
});

router.get("/test-call/:callSid/status", requireAuth, async (req, res) => {
const config = await getTwilioConfig();
if (!config) {
res.status(400).json({ error: "Twilio não configurado" });
return;
}

const { callSid } = req.params;
const response = await fetch(
`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls/${callSid}.json`,
{
headers: {
Authorization:
"Basic " +
Buffer.from(`${config.accountSid}:${config.authToken}`).toString(
"base64",
),
},
},
);

if (!response.ok) {
res.status(response.status).json({ error: "Chamada não encontrada" });
return;
}

const data = (await response.json()) as Record<string, string>;
res.json({
status: data.status,
duration: data.duration,
to: data.to,
from: data.from,
});
});

router.delete("/test-call/:callSid", requireAuth, async (req, res) => {
const config = await getTwilioConfig();
if (!config) {
res.status(400).json({ error: "Twilio não configurado" });
return;
}

const { callSid } = req.params;
const response = await fetch(
`https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls/${callSid}.json`,
{
method: "POST",
headers: {
"Content-Type": "application/x-www-form-urlencoded",
Authorization:
"Basic " +
Buffer.from(`${config.accountSid}:${config.authToken}`).toString(
"base64",
),
},
body: new URLSearchParams({ Status: "completed" }).toString(),
},
);

if (!response.ok) {
const err = await response.text();
res.status(500).json({ error: `Twilio API error: ${err}` });
return;
}

res.json({ ok: true });
});

router.get("/recording/:callId", async (req, res) => {
const queryToken = req.query.token as string | undefined;
if (queryToken && !req.headers.authorization) {
req.headers.authorization = `Bearer ${queryToken}`;
}
await new Promise<void>((resolve) => requireAuth(req, res, () => resolve()));
if (res.headersSent) return;

const callId = Number(req.params.callId);
if (isNaN(callId) || callId <= 0) {
res.status(400).json({ error: "Invalid call ID" });
return;
}

const [call] = await db
.select({ recordingUrl: callsTable.recordingUrl })
.from(callsTable)
.where(eq(callsTable.id, callId));

if (!call?.recordingUrl) {
res.status(404).json({ error: "Recording not found" });
return;
}

if (!TWILIO_RECORDING_HOST_PATTERN.test(call.recordingUrl)) {
console.warn(
"Blocked proxy to untrusted recording URL:",
call.recordingUrl,
);
res.status(400).json({ error: "Invalid recording URL" });
return;
}

const config = await getTwilioConfig();
if (!config) {
res.status(503).json({ error: "Twilio not configured" });
return;
}

try {
const response = await fetch(call.recordingUrl, {
headers: {
Authorization:
"Basic " +
Buffer.from(`${config.accountSid}:${config.authToken}`).toString(
"base64",
),
},
});

    if (!response.ok) {
      res.status(response.status).json({ error: "Failed to fetch recording" });
      return;
    }

    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "audio/mpeg",
    );
    res.setHeader(
      "Content-Disposition",
      `inline; filename="recording-${callId}.mp3"`,
    );

    const buffer = Buffer.from(await response.arrayBuffer());
    res.send(buffer);

} catch (e) {
console.warn("Failed to proxy recording:", e);
res.status(500).json({ error: "Failed to fetch recording" });
}
});

export default router;
