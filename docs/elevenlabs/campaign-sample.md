import { Router } from "express";
import { db, campaignsTable, campaignOperatorsTable, leadsTable, usersTable, callsTable, campaignTriggersTable, leadInteractionsTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth.js";
import { getTwilioConfig, isRecordCallsEnabled, getServerBaseUrl, getTwilioChannels } from "../lib/twilio-config.js";

const router = Router();
router.use(requireAuth);

interface AuthenticatedRequest extends Express.Request {
user: { id: number; username: string; role: string };
}

function toE164Brazil(phone: string): string {
const digits = phone.replace(/\D/g, "");
if (digits.startsWith("55") && digits.length >= 12) return `+${digits}`;
if (digits.length === 11) return `+55${digits}`;
if (digits.length === 10) return `+55${digits}`;
return `+${digits}`;
}

router.get("/", async (req, res) => {
const page = Number(req.query.page) || 1;
const limit = Number(req.query.limit) || 20;
const offset = (page - 1) \* limit;
const status = req.query.status as string | undefined;

let query = db.select().from(campaignsTable).$dynamic();
if (status) query = query.where(eq(campaignsTable.status, status as any));

const total = await db
.select({ count: sql<number>`count(*)` })
.from(campaignsTable)
.then(r => Number(r[0].count));

const campaigns = await query.limit(limit).offset(offset).orderBy(campaignsTable.createdAt);

const enriched = await Promise.all(campaigns.map(async (c) => {
const [totalLeads] = await db
.select({ count: sql<number>`count(*)` })
.from(leadsTable)
.where(eq(leadsTable.campaignId, c.id));
const [contactedLeads] = await db
.select({ count: sql<number>`count(*)` })
.from(leadsTable)
.where(and(
eq(leadsTable.campaignId, c.id),
sql`${leadsTable.status} != 'novo'`
));
const [simResult] = await db
.select({ count: sql<number>`count(*)` })
.from(callsTable)
.where(and(eq(callsTable.campaignId, c.id), eq(callsTable.aiDecision, "sim")));
const [naoResult] = await db
.select({ count: sql<number>`count(*)` })
.from(callsTable)
.where(and(eq(callsTable.campaignId, c.id), eq(callsTable.aiDecision, "nao")));
return {
...c,
totalLeads: Number(totalLeads?.count || 0),
contactedLeads: Number(contactedLeads?.count || 0),
simCount: Number(simResult?.count || 0),
naoCount: Number(naoResult?.count || 0),
};
}));

res.json({
data: enriched,
meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
});
});

router.post("/", async (req, res) => {
const { name, description, startDate, endDate, operatorIds, type, elevenLabsAgentId, elevenLabsVoiceId } = req.body;
if (!name) {
res.status(400).json({ error: "bad_request", message: "Nome é obrigatório" });
return;
}

const [campaign] = await db.insert(campaignsTable).values({
name,
description: description || null,
type: type || "humano",
elevenLabsAgentId: elevenLabsAgentId || null,
elevenLabsVoiceId: elevenLabsVoiceId || null,
startDate: startDate ? new Date(startDate) : null,
endDate: endDate ? new Date(endDate) : null,
}).returning();

if (operatorIds?.length) {
await db.insert(campaignOperatorsTable).values(
operatorIds.map((uid: number) => ({ campaignId: campaign.id, userId: uid }))
);
}

res.status(201).json({ ...campaign, totalLeads: 0, contactedLeads: 0 });
});

router.get("/:id/next-lead", async (req, res) => {
const campaignId = Number(req.params.id);
const [lead] = await db
.select()
.from(leadsTable)
.where(and(
eq(leadsTable.campaignId, campaignId),
eq(leadsTable.status, "novo")
))
.limit(1);

const [hasMore] = await db
.select({ count: sql<number>`count(*)` })
.from(leadsTable)
.where(and(
eq(leadsTable.campaignId, campaignId),
eq(leadsTable.status, "novo")
));

res.json({
lead: lead || null,
hasMore: Number(hasMore?.count || 0) > 1,
});
});

router.post("/:id/dispatch", async (req, res) => {
const user = (req as unknown as AuthenticatedRequest).user;
if (user.role !== "administrador" && user.role !== "supervisor") {
res.status(403).json({ error: "forbidden", message: "Apenas administradores e supervisores podem disparar campanhas" });
return;
}

const campaignId = Number(req.params.id);
const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, campaignId));
if (!campaign) {
res.status(404).json({ error: "not_found", message: "Campanha não encontrada" });
return;
}
if (campaign.type !== "ia") {
res.status(400).json({ error: "bad_request", message: "Apenas campanhas do tipo IA podem ser disparadas automaticamente" });
return;
}
if (campaign.status !== "ativa") {
res.status(400).json({ error: "bad_request", message: "Campanha precisa estar ativa para ser disparada" });
return;
}
if (!campaign.elevenLabsAgentId) {
res.status(400).json({ error: "bad_request", message: "Agent ID do ElevenLabs não configurado na campanha" });
return;
}

const twilioConfig = await getTwilioConfig();
if (!twilioConfig) {
res.status(503).json({ error: "twilio_not_configured", message: "Twilio não está configurado" });
return;
}

const { callerId } = req.body as { callerId?: string };
let fromNumber = twilioConfig.fromNumber;
if (callerId) {
const channels = await getTwilioChannels();
const normalized = toE164Brazil(callerId);
if (channels.some((c) => c.number === normalized)) {
fromNumber = normalized;
}
}

const leads = await db
.select()
.from(leadsTable)
.where(and(
eq(leadsTable.campaignId, campaignId),
eq(leadsTable.status, "novo")
));

if (leads.length === 0) {
res.json({ dispatched: 0, message: "Nenhum lead disponível para discagem" });
return;
}

const recordEnabled = await isRecordCallsEnabled();
let dispatched = 0;
const errors: string[] = [];
const dispatchedCalls: Array<{
leadId: number;
leadName: string;
callRecordId: number;
callSid: string;
status: string;
}> = [];

for (const lead of leads) {
try {
const serverBaseUrl = await getServerBaseUrl();
const twimlUrl = `${serverBaseUrl || `${req.protocol}://${req.get("host")}`}/api/twilio/voice`;

      const [callRecord] = await db.insert(callsTable).values({
        leadId: lead.id,
        campaignId,
        operatorId: user.id,
        status: "iniciando",
        startedAt: new Date(),
      }).returning();

      const params = new URLSearchParams({
        To: toE164Brazil(lead.phone),
        From: fromNumber,
        Url: `${twimlUrl}?callRecordId=${callRecord.id}&elevenlabsAgentId=${encodeURIComponent(campaign.elevenLabsAgentId!)}&campaignType=ia&elevenLabsVoiceId=${encodeURIComponent(campaign.elevenLabsVoiceId || "")}`,
        ...(twilioConfig.statusCallbackUrl ? { StatusCallback: twilioConfig.statusCallbackUrl, StatusCallbackMethod: "POST" } : {}),
        ...(recordEnabled ? {
          Record: "true",
          RecordingChannels: "dual",
          RecordingStatusCallback: `${serverBaseUrl || `${req.protocol}://${req.get("host")}`}/api/calls/recording-status`,
          RecordingStatusCallbackMethod: "POST",
        } : {}),
      });

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twilioConfig.accountSid}/Calls.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: "Basic " + Buffer.from(`${twilioConfig.accountSid}:${twilioConfig.authToken}`).toString("base64"),
          },
          body: params.toString(),
        }
      );

      if (response.ok) {
        const data = await response.json() as Record<string, string>;
        await db.update(callsTable)
          .set({ twilioCallSid: data.sid, status: "em_andamento" })
          .where(eq(callsTable.id, callRecord.id));
        await db.update(leadsTable)
          .set({ status: "contactado", updatedAt: new Date() })
          .where(eq(leadsTable.id, lead.id));
        await db.insert(leadInteractionsTable).values({
          leadId: lead.id,
          type: "chamada",
          description: "Chamada IA disparada automaticamente",
          userId: user.id,
        });
        dispatchedCalls.push({
          leadId: lead.id,
          leadName: lead.name,
          callRecordId: callRecord.id,
          callSid: data.sid,
          status: "iniciando",
        });
        dispatched++;
      } else {
        const errText = await response.text();
        errors.push(`Lead ${lead.id}: ${errText}`);
        await db.update(callsTable).set({ status: "falhou" }).where(eq(callsTable.id, callRecord.id));
      }

      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      errors.push(`Lead ${lead.id}: ${e instanceof Error ? e.message : String(e)}`);
    }

}

res.json({
dispatched,
total: leads.length,
errors: errors.length > 0 ? errors : undefined,
message: `${dispatched} de ${leads.length} ligações disparadas com sucesso`,
calls: dispatchedCalls,
});
});

router.get("/:id/triggers", async (req, res) => {
const campaignId = Number(req.params.id);
const triggers = await db
.select()
.from(campaignTriggersTable)
.where(eq(campaignTriggersTable.campaignId, campaignId))
.orderBy(campaignTriggersTable.createdAt);
res.json(triggers);
});

router.post("/:id/triggers", async (req, res) => {
const user = (req as unknown as AuthenticatedRequest).user;
if (user.role !== "administrador" && user.role !== "supervisor") {
res.status(403).json({ error: "forbidden" });
return;
}
const campaignId = Number(req.params.id);
const { keyword, instruction } = req.body;
if (!keyword?.trim()) {
res.status(400).json({ error: "bad_request", message: "Palavra-chave é obrigatória" });
return;
}
const [trigger] = await db.insert(campaignTriggersTable).values({
campaignId,
keyword: keyword.trim().toLowerCase(),
instruction: instruction?.trim() || null,
}).returning();
res.status(201).json(trigger);
});

router.delete("/:id/triggers/:triggerId", async (req, res) => {
const user = (req as unknown as AuthenticatedRequest).user;
if (user.role !== "administrador" && user.role !== "supervisor") {
res.status(403).json({ error: "forbidden" });
return;
}
const triggerId = Number(req.params.triggerId);
await db.delete(campaignTriggersTable).where(eq(campaignTriggersTable.id, triggerId));
res.status(204).send();
});

router.get("/:id", async (req, res) => {
const id = Number(req.params.id);
const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
if (!campaign) {
res.status(404).json({ error: "not_found", message: "Campanha não encontrada" });
return;
}

const operators = await db
.select({ user: usersTable })
.from(campaignOperatorsTable)
.innerJoin(usersTable, eq(campaignOperatorsTable.userId, usersTable.id))
.where(eq(campaignOperatorsTable.campaignId, id));

const leads = await db.select().from(leadsTable).where(eq(leadsTable.campaignId, id));

const [totalLeads] = await db
.select({ count: sql<number>`count(*)` })
.from(leadsTable)
.where(eq(leadsTable.campaignId, id));
const [contactedLeads] = await db
.select({ count: sql<number>`count(*)` })
.from(leadsTable)
.where(and(eq(leadsTable.campaignId, id), sql`${leadsTable.status} != 'novo'`));
const [simResult] = await db
.select({ count: sql<number>`count(*)` })
.from(callsTable)
.where(and(eq(callsTable.campaignId, id), eq(callsTable.aiDecision, "sim")));
const [naoResult] = await db
.select({ count: sql<number>`count(*)` })
.from(callsTable)
.where(and(eq(callsTable.campaignId, id), eq(callsTable.aiDecision, "nao")));

res.json({
...campaign,
totalLeads: Number(totalLeads?.count || 0),
contactedLeads: Number(contactedLeads?.count || 0),
simCount: Number(simResult?.count || 0),
naoCount: Number(naoResult?.count || 0),
operators: operators.map(o => {
const { password: \_, ...u } = o.user;
return u;
}),
leads,
});
});

router.put("/:id", async (req, res) => {
const id = Number(req.params.id);
const { name, description, status, startDate, endDate, operatorIds, type, elevenLabsAgentId, elevenLabsVoiceId } = req.body;

const updates: any = { updatedAt: new Date() };
if (name !== undefined) updates.name = name;
if (description !== undefined) updates.description = description;
if (status !== undefined) updates.status = status;
if (startDate !== undefined) updates.startDate = startDate ? new Date(startDate) : null;
if (endDate !== undefined) updates.endDate = endDate ? new Date(endDate) : null;
if (type !== undefined) updates.type = type;
if (elevenLabsAgentId !== undefined) updates.elevenLabsAgentId = elevenLabsAgentId || null;
if (elevenLabsVoiceId !== undefined) updates.elevenLabsVoiceId = elevenLabsVoiceId || null;

const [campaign] = await db.update(campaignsTable).set(updates).where(eq(campaignsTable.id, id)).returning();
if (!campaign) {
res.status(404).json({ error: "not_found", message: "Campanha não encontrada" });
return;
}

if (operatorIds !== undefined) {
await db.delete(campaignOperatorsTable).where(eq(campaignOperatorsTable.campaignId, id));
if (operatorIds.length) {
await db.insert(campaignOperatorsTable).values(
operatorIds.map((uid: number) => ({ campaignId: id, userId: uid }))
);
}
}

const [totalLeads] = await db
.select({ count: sql<number>`count(*)` })
.from(leadsTable).where(eq(leadsTable.campaignId, id));
const [contactedLeads] = await db
.select({ count: sql<number>`count(*)` })
.from(leadsTable)
.where(and(eq(leadsTable.campaignId, id), sql`${leadsTable.status} != 'novo'`));
const [simResult] = await db
.select({ count: sql<number>`count(*)` })
.from(callsTable)
.where(and(eq(callsTable.campaignId, id), eq(callsTable.aiDecision, "sim")));
const [naoResult] = await db
.select({ count: sql<number>`count(*)` })
.from(callsTable)
.where(and(eq(callsTable.campaignId, id), eq(callsTable.aiDecision, "nao")));

res.json({
...campaign,
totalLeads: Number(totalLeads?.count || 0),
contactedLeads: Number(contactedLeads?.count || 0),
simCount: Number(simResult?.count || 0),
naoCount: Number(naoResult?.count || 0),
});
});

router.delete("/:id", async (req, res) => {
const id = Number(req.params.id);
const [existing] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, id));
if (!existing) {
res.status(404).json({ error: "not_found", message: "Campanha não encontrada" });
return;
}
await db.update(leadsTable).set({ campaignId: null }).where(eq(leadsTable.campaignId, id));
await db.delete(campaignOperatorsTable).where(eq(campaignOperatorsTable.campaignId, id));
await db.delete(campaignTriggersTable).where(eq(campaignTriggersTable.campaignId, id));
await db.delete(campaignsTable).where(eq(campaignsTable.id, id));
res.status(204).send();
});

export default router;
