import { Router, Request, Response } from "express";
import { db } from "server/db";
import { calls, campaignClients, callNotifications, campaignTriggers } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getElevenLabsKey } from "../lib/twilio-config";

const router = Router();

// ─── Webhook: decisão do agente IA ────────────────────────────────────────────
// Chamado pela tool "decisao" configurada no agente ElevenLabs

router.post("/decision", async (req: Request, res: Response) => {
  try {
    const { conversation_id, decision, reason } = req.body as {
      conversation_id: string;
      decision: "sim" | "nao" | "sem_resposta";
      reason?: string;
    };

    if (!conversation_id || !decision) {
      return res.status(400).json({ message: "conversation_id e decision são obrigatórios" });
    }

    const [call] = await db
      .select()
      .from(calls)
      .where(eq(calls.elevenLabsConversationId, conversation_id));

    if (!call) {
      return res.status(404).json({ message: "Chamada não encontrada" });
    }

    const outcomeMap: Record<string, "convertido" | "nao_atendeu" | "nao_atendeu"> = {
      sim: "convertido",
      nao: "nao_atendeu",
      sem_resposta: "nao_atendeu",
    };

    const campaignClientStatusMap: Record<
      string,
      "convite_aceito" | "convite_recusado" | "nao_atendeu"
    > = {
      sim: "convite_aceito",
      nao: "convite_recusado",
      sem_resposta: "nao_atendeu",
    };

    await db
      .update(calls)
      .set({
        aiDecision: decision,
        outcome: outcomeMap[decision],
        ...(reason && { notes: reason }),
      })
      .where(eq(calls.id, call.id));

    if (call.campaignId && call.clientId) {
      await db
        .update(campaignClients)
        .set({ status: campaignClientStatusMap[decision] })
        .where(
          and(
            eq(campaignClients.campaignId, call.campaignId),
            eq(campaignClients.clientId, call.clientId)
          )
        );
    }

    res.json({ ok: true });
  } catch (e) {
    console.error("[elevenlabs] decision error:", e);
    res.status(500).json({ message: "Erro ao processar decisão" });
  }
});

// ─── Webhook: pós-chamada ─────────────────────────────────────────────────────
// Recebe transcript + analysis quando a conversa encerra no ElevenLabs

router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const { conversation_id, transcript, analysis, status } = req.body as {
      conversation_id: string;
      transcript?: Array<{ role: string; message: string }>;
      analysis?: { summary?: string; sentiment?: string };
      status?: string;
    };

    if (!conversation_id) return res.status(400).json({ message: "conversation_id obrigatório" });

    const [call] = await db
      .select()
      .from(calls)
      .where(eq(calls.elevenLabsConversationId, conversation_id));

    if (!call) return res.sendStatus(204);

    const transcriptText = transcript
      ?.map((t) => `${t.role}: ${t.message}`)
      .join("\n") ?? null;

    const sentiment = (
      analysis?.sentiment === "positive"
        ? "positivo"
        : analysis?.sentiment === "negative"
        ? "negativo"
        : analysis?.sentiment
        ? "neutro"
        : null
    ) as "positivo" | "neutro" | "negativo" | null | undefined;

    await db
      .update(calls)
      .set({
        transcription: transcriptText,
        summary: analysis?.summary ?? null,
        ...(sentiment && { sentiment }),
      })
      .where(eq(calls.id, call.id));

    // Varrer triggers da campanha
    if (call.campaignId && transcriptText) {
      const triggers = await db
        .select()
        .from(campaignTriggers)
        .where(eq(campaignTriggers.campaignId, call.campaignId));

      for (const trigger of triggers) {
        const idx = transcriptText
          .toLowerCase()
          .indexOf(trigger.keyword.toLowerCase());
        if (idx === -1) continue;

        const excerptStart = Math.max(0, idx - 50);
        const excerptEnd = Math.min(transcriptText.length, idx + trigger.keyword.length + 50);
        const excerpt = transcriptText.slice(excerptStart, excerptEnd);

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

    res.sendStatus(204);
  } catch (e) {
    console.error("[elevenlabs] webhook error:", e);
    res.sendStatus(500);
  }
});

// ─── Buscar e sincronizar conversa ────────────────────────────────────────────

router.get("/conversation/:id", async (req: Request, res: Response) => {
  try {
    const apiKey = await getElevenLabsKey();
    if (!apiKey) return res.status(400).json({ message: "ElevenLabs não configurado" });

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversations/${req.params.id}`,
      { headers: { "xi-api-key": apiKey } }
    );

    if (!response.ok) {
      return res.status(502).json({ message: "Erro ao buscar conversa no ElevenLabs" });
    }

    const data = await response.json() as {
      transcript?: Array<{ role: string; message: string }>;
      analysis?: { summary?: string; sentiment?: string };
    };

    const [call] = await db
      .select()
      .from(calls)
      .where(eq(calls.elevenLabsConversationId, req.params.id));

    if (call) {
      const transcriptText = data.transcript
        ?.map((t) => `${t.role}: ${t.message}`)
        .join("\n") ?? null;

      const sentiment = (
        data.analysis?.sentiment === "positive"
          ? "positivo"
          : data.analysis?.sentiment === "negative"
          ? "negativo"
          : "neutro"
      ) as "positivo" | "neutro" | "negativo";

      await db
        .update(calls)
        .set({
          transcription: transcriptText,
          summary: data.analysis?.summary ?? null,
          sentiment,
        })
        .where(eq(calls.id, call.id));
    }

    res.json(data);
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar conversa" });
  }
});

export default router;
