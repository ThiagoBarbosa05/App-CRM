import { Router, Request, Response } from "express";
import { db } from "server/db";
import { calls, campaignClients, callNotifications, campaignTriggers } from "@shared/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { getElevenLabsKey, getTwilioConfig } from "../lib/twilio-config";
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

// ─── Listar chamadas ──────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  try {
    const { campaignId, clientId, status, page = "1", pageSize = "20" } = req.query as Record<string, string>;
    const limit = Math.min(parseInt(pageSize) || 20, 100);
    const offset = (Math.max(parseInt(page) || 1, 1) - 1) * limit;

    const conditions = [];
    if (campaignId) conditions.push(eq(calls.campaignId, campaignId));
    if (clientId) conditions.push(eq(calls.clientId, clientId));
    if (status) conditions.push(eq(calls.status, status as "iniciando" | "em_andamento" | "encerrada" | "nao_atendeu" | "ocupado" | "falhou" | "caixa_postal"));

    const rows = await db
      .select()
      .from(calls)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(calls.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ data: rows, page: parseInt(page), pageSize: limit });
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar chamadas" });
  }
});

// ─── Criar chamada ────────────────────────────────────────────────────────────

router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Não autenticado" });

    const { clientId, campaignId, twilioCallSid } = req.body as {
      clientId?: string;
      campaignId?: string;
      twilioCallSid?: string;
    };

    const [call] = await db
      .insert(calls)
      .values({
        operatorId: userId,
        clientId,
        campaignId,
        twilioCallSid,
        status: "iniciando",
        startedAt: new Date(),
      })
      .returning();

    res.status(201).json(call);
  } catch (e) {
    res.status(500).json({ message: "Erro ao criar chamada" });
  }
});

// ─── Buscar chamada ───────────────────────────────────────────────────────────

router.get("/:id", async (req: Request, res: Response) => {
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

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { notes, outcome, nextStep } = req.body as {
      notes?: string;
      outcome?: string;
      nextStep?: string;
    };
    const [call] = await db
      .update(calls)
      .set({
        ...(notes !== undefined && { notes }),
        ...(outcome !== undefined && { outcome: outcome as "atendeu" | "nao_atendeu" | "ocupado" | "caixa_postal" | "numero_invalido" | "convertido" | "reagendado" }),
        ...(nextStep !== undefined && { nextStep }),
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

router.post("/:id/end", async (req: Request, res: Response) => {
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

router.post("/:id/sync-transcript", async (req: Request, res: Response) => {
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

    if (!CallSid || !RecordingSid) return res.sendStatus(400);

    await db
      .update(calls)
      .set({ recordingSid: RecordingSid, recordingUrl: RecordingUrl })
      .where(eq(calls.twilioCallSid, CallSid));

    res.sendStatus(204);
  } catch (e) {
    console.error("[calls] recording-status error:", e);
    res.sendStatus(500);
  }
});

export default router;
