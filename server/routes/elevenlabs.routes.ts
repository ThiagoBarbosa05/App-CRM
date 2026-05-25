import { Router, Request, Response } from "express";
import { db } from "server/db";
import {
  calls,
  campaignClients,
  callNotifications,
  campaignTriggers,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getElevenLabsKey } from "../lib/twilio-config";
import { requireAuth } from "../middleware/validation";
import { sendPostCallMessage } from "../services/umbler-post-call.service";
import { onCallTerminal } from "../services/call-interaction.service";
import { validateElevenLabsSignature } from "../middleware/elevenlabs-webhook";
import { recordWebhookEvent } from "../lib/webhook-idempotency";
import { rateLimit } from "../middleware/rate-limit";
import multer from "multer";
import OpenAI from "openai";

const router = Router();

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "audio/mpeg",
      "audio/mp3",
      "audio/wav",
      "audio/wave",
      "audio/x-wav",
      "audio/ogg",
      "audio/opus",
      "audio/webm",
      "audio/mp4",
      "audio/x-m4a",
    ];
    cb(
      null,
      allowed.includes(file.mimetype) || file.mimetype.startsWith("audio/"),
    );
  },
});

// ─── Webhook: decisão do agente IA ────────────────────────────────────────────
// Chamado pelas tools "confirmar_interesse" / "recusar_convite" do agente ElevenLabs
// Body esperado: { callSid, conversationId, decision | decisao }

router.post("/decision", validateElevenLabsSignature, async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, string | undefined>;
    const callSid = body.callSid;
    const conversationId = body.conversationId ?? body.conversation_id;
    const decision = body.decision ?? body.decisao;
    // Motivo/contexto da resposta do cliente (campo opcional nas tools do ElevenLabs)
    const reason = body.reason ?? body.context ?? body.motivo;

    if (!decision || !["sim", "nao", "sem_resposta"].includes(decision)) {
      res
        .status(400)
        .json({ message: "decision deve ser sim|nao|sem_resposta" });
      return;
    }

    // Idempotência: dedup por (callSid|conversationId)+decision
    const dedupKey = `decision:${callSid ?? conversationId ?? "unknown"}:${decision}`;
    const isFirst = await recordWebhookEvent("elevenlabs", dedupKey, body);
    if (!isFirst) {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }

    // Lookup por callSid primeiro (disponível durante a chamada),
    // depois por conversationId como fallback
    let call = callSid
      ? (
          await db.select().from(calls).where(eq(calls.twilioCallSid, callSid))
        )[0]
      : undefined;
    if (!call && conversationId) {
      call = (
        await db
          .select()
          .from(calls)
          .where(eq(calls.elevenLabsConversationId, conversationId))
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

    if (call.campaignId) {
      sendPostCallMessage(
        call.campaignId,
        call.clientId ?? null,
        decision as "sim" | "nao" | "sem_resposta",
        call.id,
      ).catch((err) => console.error("[UmblerPostCall] Erro:", err));
    }

    // CRM sync: decisão da IA dispara integração (especialmente para convertido)
    onCallTerminal(call.id).catch((e) =>
      console.warn("[onCallTerminal] erro:", e),
    );

    res.status(200).json({ ok: true, decision, callSid });
  } catch (e) {
    console.error("[elevenlabs] decision error:", e);
    res.status(500).json({ message: "Erro ao processar decisão" });
  }
});

// ─── Webhook: pós-chamada ─────────────────────────────────────────────────────
// ElevenLabs envia { type: "post_call_transcription", data: { conversation_id, status, transcript[], analysis } }

router.post("/webhook", validateElevenLabsSignature, async (req: Request, res: Response) => {
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

    // Idempotência: dedup por conversation_id + status
    const dedupKey = `webhook:${conversationId}:${status ?? "unknown"}`;
    const isFirst = await recordWebhookEvent("elevenlabs", dedupKey);
    if (!isFirst) {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }

    // Lookup por elevenLabsConversationId primeiro; fallback pelo callSid enviado
    // como dynamic variable (disponível no payload pós-chamada)
    let call = (
      await db
        .select()
        .from(calls)
        .where(eq(calls.elevenLabsConversationId, conversationId))
    )[0];

    if (!call) {
      const dynVars = (
        data.conversation_initiation_client_data as
          | Record<string, unknown>
          | undefined
      )?.dynamic_variables as Record<string, string> | undefined;
      const callSid = dynVars?.callSid;
      if (callSid) {
        call = (
          await db.select().from(calls).where(eq(calls.twilioCallSid, callSid))
        )[0];
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
      const turns = (
        rawTranscript as Array<{ role: string; message?: string | null }>
      ).filter((t) => t.message?.trim());
      if (turns.length > 0) {
        transcriptText = turns
          .map(
            (t) =>
              `${t.role === "agent" ? "Agent" : "Cliente"}: ${(t.message ?? "").replace(/\n/g, " ")}`,
          )
          .join("\n");
      }
    } else if (typeof rawTranscript === "string" && rawTranscript.trim()) {
      transcriptText = rawTranscript;
    }

    // Limita tamanho de transcript para evitar DoS / abuso de armazenamento
    const MAX_TRANSCRIPT_CHARS = 100_000;
    if (transcriptText && transcriptText.length > MAX_TRANSCRIPT_CHARS) {
      transcriptText = transcriptText.slice(0, MAX_TRANSCRIPT_CHARS) + "\n[...truncado...]";
    }

    const analysis = data.analysis as Record<string, unknown> | undefined;

    const TERMINAL_STATUSES = new Set([
      "encerrada",
      "nao_atendeu",
      "ocupado",
      "falhou",
      "caixa_postal",
    ]);

    const updates: Record<string, unknown> = {};
    if (transcriptText) updates.transcription = transcriptText;
    if (analysis?.transcript_summary)
      updates.summary = analysis.transcript_summary;
    else if (analysis?.summary) updates.summary = analysis.summary;
    // Só sobrescreve o status se a chamada ainda não está em um estado terminal
    // (ex: nao_atendeu gravado pelo Twilio não deve ser sobrescrito por "encerrada")
    if (
      (status === "done" || status === "completed") &&
      !TERMINAL_STATUSES.has(call.status)
    ) {
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
        const excerptEnd = Math.min(
          transcriptText.length,
          idx + trigger.keyword.length + 60,
        );
        const excerpt =
          (excerptStart > 0 ? "..." : "") +
          transcriptText.slice(excerptStart, excerptEnd) +
          (excerptEnd < transcriptText.length ? "..." : "");

        await db.insert(callNotifications).values({
          userId: call.operatorId,
          callId: call.id,
          clientId: call.clientId ?? undefined,
          triggerId: trigger.id,
          message:
            trigger.instruction ??
            `Palavra-chave detectada: "${trigger.keyword}"`,
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
    if (!apiKey)
      return res.status(400).json({ message: "ElevenLabs não configurado" });

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
      transcript?: Array<{
        role: string;
        message: string;
        time_in_call_secs?: number;
      }>;
      metadata?: { duration?: number };
      analysis?: { transcript_summary?: string; summary?: string };
      has_audio?: boolean;
    };

    const transcriptText = (data.transcript ?? [])
      .filter((t) => t.message?.trim())
      .map(
        (t) =>
          `${t.role === "agent" ? "Agent" : "Cliente"}: ${t.message.replace(/\n/g, " ")}`,
      )
      .join("\n");

    const summary =
      data.analysis?.transcript_summary ?? data.analysis?.summary ?? null;

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

router.get(
  "/audio/:callId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const [call] = await db
        .select()
        .from(calls)
        .where(eq(calls.id, req.params.callId));
      if (!call)
        return res.status(404).json({ message: "Chamada não encontrada" });
      if (!call.elevenLabsConversationId) {
        return res
          .status(404)
          .json({ message: "Sem conversa ElevenLabs vinculada" });
      }

      const apiKey = await getElevenLabsKey();
      if (!apiKey)
        return res.status(400).json({ message: "ElevenLabs não configurado" });

      const audioRes = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(call.elevenLabsConversationId)}/audio`,
        { headers: { "xi-api-key": apiKey } },
      );

      if (!audioRes.ok) {
        return res
          .status(audioRes.status)
          .json({ message: "Áudio não disponível no ElevenLabs" });
      }

      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "private, max-age=3600");
      const buffer = await audioRes.arrayBuffer();
      res.send(Buffer.from(buffer));
    } catch (e) {
      console.error("[elevenlabs] audio proxy error:", e);
      res.status(500).json({ message: "Erro ao buscar áudio" });
    }
  },
);

// ─── Listar agentes da workspace ─────────────────────────────────────────────

router.get("/agents", requireAuth, async (req: Request, res: Response) => {
  try {
    const apiKey = await getElevenLabsKey();
    if (!apiKey)
      return res.status(400).json({ message: "ElevenLabs não configurado" });

    const response = await fetch("https://api.elevenlabs.io/v1/convai/agents", {
      headers: { "xi-api-key": apiKey },
    });

    if (!response.ok) {
      const body = await response.text();
      return res.status(response.status).json({ message: body });
    }

    const data = (await response.json()) as {
      agents: Array<{ agent_id: string; name: string }>;
    };

    res.json({
      agents: (data.agents ?? []).map((a) => ({
        agentId: a.agent_id,
        name: a.name,
      })),
    });
  } catch (e) {
    console.error("[elevenlabs] list-agents error:", e);
    res.status(500).json({ message: "Erro ao listar agentes" });
  }
});

// ─── Buscar configuração do agente ───────────────────────────────────────────

router.get(
  "/agents/:agentId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const apiKey = await getElevenLabsKey();
      if (!apiKey)
        return res.status(400).json({ message: "ElevenLabs não configurado" });

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(req.params.agentId)}`,
        { headers: { "xi-api-key": apiKey } },
      );

      if (!response.ok) {
        const body = await response.text();
        return res.status(response.status).json({ message: body });
      }

      // Retorna o payload completo + campos normalizados usados pelo agent-tools-modal
      const data = (await response.json()) as Record<string, unknown>;
      const cc = (data.conversation_config ?? {}) as Record<string, unknown>;
      const agentCfg = (cc.agent ?? {}) as Record<string, unknown>;
      const promptCfg = (agentCfg.prompt ?? {}) as Record<string, unknown>;

      res.json({
        ...data,
        // Campos normalizados para compatibilidade com agent-tools-modal
        toolIds: (promptCfg.tool_ids as string[]) ?? [],
        tools: (promptCfg.tools as unknown[]) ?? [],
        builtInTools:
          (promptCfg.built_in_tools as Record<string, unknown>) ?? {},
      });
    } catch (e) {
      console.error("[elevenlabs] get-agent error:", e);
      res.status(500).json({ message: "Erro ao buscar agente" });
    }
  },
);

// ─── Listar ferramentas da workspace ─────────────────────────────────────────

router.get("/tools", requireAuth, async (req: Request, res: Response) => {
  try {
    const apiKey = await getElevenLabsKey();
    if (!apiKey)
      return res.status(400).json({ message: "ElevenLabs não configurado" });

    const response = await fetch("https://api.elevenlabs.io/v1/convai/tools", {
      headers: { "xi-api-key": apiKey },
    });

    if (!response.ok) {
      const body = await response.text();
      return res.status(response.status).json({ message: body });
    }

    const data = (await response.json()) as {
      tools: Array<{
        id?: string;
        tool_id?: string;
        name?: string;
        description?: string;
        type?: string;
        api_schema?: {
          url?: string;
          method?: string;
          request_body_schema?: unknown;
        };
        tool_config?: {
          type?: string;
          name?: string;
          description?: string;
          api_schema?: {
            url?: string;
            method?: string;
            request_body_schema?: unknown;
          };
          base_api_schema?: {
            url?: string;
            method?: string;
            request_body_schema?: unknown;
          };
        };
      }>;
    };

    const normalized = (data.tools ?? []).map((t) => ({
      tool_id: t.id ?? t.tool_id ?? "",
      name: t.name ?? t.tool_config?.name ?? "",
      description: t.description ?? t.tool_config?.description ?? "",
      type: t.type ?? t.tool_config?.type,
      api_schema:
        t.api_schema ??
        t.tool_config?.api_schema ??
        t.tool_config?.base_api_schema,
    }));

    res.json({ tools: normalized });
  } catch (e) {
    console.error("[elevenlabs] list-tools error:", e);
    res.status(500).json({ message: "Erro ao listar ferramentas" });
  }
});

// ─── Criar ferramenta no workspace ───────────────────────────────────────────

router.post("/tools", requireAuth, async (req: Request, res: Response) => {
  try {
    const apiKey = await getElevenLabsKey();
    if (!apiKey)
      return res.status(400).json({ message: "ElevenLabs não configurado" });

    const {
      name,
      description,
      url,
      method,
      requestBodySchema,
      requestHeaders,
      expectsResponse,
      responseTimeoutSecs,
      mocks,
    } = req.body as {
      name: string;
      description?: string;
      url: string;
      method?: string;
      requestBodySchema?: unknown;
      requestHeaders?: Record<string, string>;
      expectsResponse?: boolean;
      responseTimeoutSecs?: number;
      mocks?: Array<{ response_body: string }>;
    };

    if (!name?.trim())
      return res.status(400).json({ message: "Nome é obrigatório" });
    if (!url?.trim())
      return res.status(400).json({ message: "URL é obrigatória" });

    const toolConfig: Record<string, unknown> = {
      type: "webhook",
      name,
      description: description ?? "",
      api_schema: {
        url,
        method: method ?? "POST",
        content_type: "application/json",
        ...(requestBodySchema
          ? { request_body_schema: requestBodySchema }
          : {}),
        ...(requestHeaders && Object.keys(requestHeaders).length > 0
          ? { request_headers: requestHeaders }
          : {}),
      },
      ...(expectsResponse !== undefined
        ? { expects_response: expectsResponse }
        : {}),
      ...(responseTimeoutSecs !== undefined
        ? { response_timeout_secs: responseTimeoutSecs }
        : {}),
      ...(mocks?.length ? { mocks } : {}),
    };

    const response = await fetch("https://api.elevenlabs.io/v1/convai/tools", {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ tool_config: toolConfig }),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ message: text });
    }

    const data = (await response.json()) as { tool_id?: string; id?: string };
    res.status(201).json({ toolId: data.tool_id ?? data.id });
  } catch (e) {
    console.error("[elevenlabs] create-tool error:", e);
    res.status(500).json({ message: "Erro ao criar ferramenta" });
  }
});

// ─── Atualizar ferramenta do workspace ────────────────────────────────────────

router.patch(
  "/tools/:toolId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const apiKey = await getElevenLabsKey();
      if (!apiKey)
        return res.status(400).json({ message: "ElevenLabs não configurado" });

      const {
        name,
        description,
        url,
        method,
        requestBodySchema,
        requestHeaders,
        expectsResponse,
        responseTimeoutSecs,
        mocks,
      } = req.body as {
        name?: string;
        description?: string;
        url?: string;
        method?: string;
        requestBodySchema?: unknown;
        requestHeaders?: Record<string, string>;
        expectsResponse?: boolean;
        responseTimeoutSecs?: number;
        mocks?: Array<{ response_body: string }>;
      };

      const toolConfig: Record<string, unknown> = { type: "webhook" };
      if (name !== undefined) toolConfig.name = name;
      if (description !== undefined) toolConfig.description = description;
      if (
        url !== undefined ||
        method !== undefined ||
        requestBodySchema !== undefined ||
        requestHeaders !== undefined
      ) {
        toolConfig.api_schema = {
          ...(url ? { url } : {}),
          ...(method ? { method } : {}),
          content_type: "application/json",
          ...(requestBodySchema
            ? { request_body_schema: requestBodySchema }
            : {}),
          ...(requestHeaders && Object.keys(requestHeaders).length > 0
            ? { request_headers: requestHeaders }
            : {}),
        };
      }
      if (expectsResponse !== undefined)
        toolConfig.expects_response = expectsResponse;
      if (responseTimeoutSecs !== undefined)
        toolConfig.response_timeout_secs = responseTimeoutSecs;
      if (mocks !== undefined) toolConfig.mocks = mocks;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/tools/${encodeURIComponent(req.params.toolId)}`,
        {
          method: "PATCH",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ tool_config: toolConfig }),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ message: text });
      }

      res.json({ ok: true });
    } catch (e) {
      console.error("[elevenlabs] update-tool error:", e);
      res.status(500).json({ message: "Erro ao atualizar ferramenta" });
    }
  },
);

// ─── Deletar ferramenta do workspace ─────────────────────────────────────────

router.delete(
  "/tools/:toolId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const apiKey = await getElevenLabsKey();
      if (!apiKey)
        return res.status(400).json({ message: "ElevenLabs não configurado" });

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/tools/${encodeURIComponent(req.params.toolId)}`,
        { method: "DELETE", headers: { "xi-api-key": apiKey } },
      );

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ message: text });
      }

      res.json({ ok: true });
    } catch (e) {
      console.error("[elevenlabs] delete-tool error:", e);
      res.status(500).json({ message: "Erro ao deletar ferramenta" });
    }
  },
);

// ─── Listar vozes disponíveis ─────────────────────────────────────────────────

router.get("/voices", requireAuth, async (req: Request, res: Response) => {
  try {
    const apiKey = await getElevenLabsKey();
    if (!apiKey)
      return res.status(400).json({ message: "ElevenLabs não configurado" });

    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    const url = new URL("https://api.elevenlabs.io/v1/voices");
    if (search) url.searchParams.set("search", search);

    const response = await fetch(url.toString(), {
      headers: { "xi-api-key": apiKey },
    });

    if (!response.ok) {
      const body = await response.text();
      return res.status(response.status).json({ message: body });
    }

    const data = (await response.json()) as {
      voices: Array<{
        voice_id: string;
        name: string;
        category?: string;
        labels?: Record<string, string>;
        preview_url?: string;
      }>;
    };

    let voices = (data.voices ?? []).map((v) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category ?? "",
      labels: v.labels ?? {},
      preview_url: v.preview_url ?? "",
    }));

    // Filtro server-side como fallback (caso a API do ElevenLabs não suporte ?search)
    if (search) {
      const lower = search.toLowerCase();
      voices = voices.filter(
        (v) =>
          v.name.toLowerCase().includes(lower) ||
          v.category.toLowerCase().includes(lower),
      );
    }

    res.json({ voices });
  } catch (e) {
    console.error("[elevenlabs] list-voices error:", e);
    res.status(500).json({ message: "Erro ao listar vozes" });
  }
});

// ─── Criar novo agente ───────────────────────────────────────────────────────

router.post("/agents", requireAuth, async (req: Request, res: Response) => {
  try {
    const apiKey = await getElevenLabsKey();
    if (!apiKey)
      return res.status(400).json({ message: "ElevenLabs não configurado" });

    const { name, conversationConfig, platformSettings } = req.body as {
      name: string;
      conversationConfig?: Record<string, unknown>;
      platformSettings?: Record<string, unknown>;
    };

    if (!name?.trim()) {
      return res.status(400).json({ message: "Nome do agente é obrigatório" });
    }

    const body: Record<string, unknown> = { name };
    if (conversationConfig) body.conversation_config = conversationConfig;
    if (platformSettings) body.platform_settings = platformSettings;

    const response = await fetch(
      "https://api.elevenlabs.io/v1/convai/agents/create",
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ message: text });
    }

    const data = (await response.json()) as { agent_id: string };
    res.status(201).json({ agentId: data.agent_id });
  } catch (e) {
    console.error("[elevenlabs] create-agent error:", e);
    res.status(500).json({ message: "Erro ao criar agente" });
  }
});

// ─── Atualizar configuração do agente ─────────────────────────────────────────

router.patch(
  "/agents/:agentId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const apiKey = await getElevenLabsKey();
      if (!apiKey)
        return res.status(400).json({ message: "ElevenLabs não configurado" });

      // Aceita tanto o formato completo (conversationConfig + platformSettings) quanto
      // o formato legado usado pelo agent-tools-modal (toolIds, builtInTools, tools).
      const {
        name,
        conversationConfig,
        platformSettings,
        toolIds,
        builtInTools,
        tools,
      } = req.body as {
        name?: string;
        conversationConfig?: Record<string, unknown>;
        platformSettings?: Record<string, unknown>;
        // Campos legados do agent-tools-modal
        toolIds?: string[];
        builtInTools?: Record<string, unknown>;
        tools?: unknown[];
      };

      const body: Record<string, unknown> = {};
      if (name) body.name = name;

      if (conversationConfig) {
        body.conversation_config = conversationConfig;
      } else if (
        toolIds !== undefined ||
        builtInTools !== undefined ||
        tools !== undefined
      ) {
        // Compatibilidade com agent-tools-modal que envia campos separados
        const promptObj: Record<string, unknown> = {};
        if (toolIds !== undefined) {
          promptObj.tool_ids = toolIds;
          promptObj.tools = [];
        } else if (tools !== undefined) {
          promptObj.tools = tools;
          promptObj.tool_ids = [];
        }
        if (builtInTools !== undefined) promptObj.built_in_tools = builtInTools;
        body.conversation_config = { agent: { prompt: promptObj } };
      }

      if (platformSettings) body.platform_settings = platformSettings;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(req.params.agentId)}`,
        {
          method: "PATCH",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ message: text });
      }

      res.json({ ok: true });
    } catch (e) {
      console.error("[elevenlabs] update-agent error:", e);
      res.status(500).json({ message: "Erro ao atualizar agente" });
    }
  },
);

// ─── Listar branches do agente ───────────────────────────────────────────────

router.get(
  "/agents/:agentId/branches",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const apiKey = await getElevenLabsKey();
      if (!apiKey)
        return res.status(400).json({ message: "ElevenLabs não configurado" });

      const response = await fetch(
        `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(req.params.agentId)}/branches`,
        { headers: { "xi-api-key": apiKey } },
      );

      if (!response.ok) {
        const body = await response.text();
        return res.status(response.status).json({ message: body });
      }

      const data = (await response.json()) as Record<string, unknown>;

      type BranchItem = {
        id: string;
        name: string;
        current_live_percentage: number;
        draft_exists: boolean;
        parent_branch_id: string | null;
      };

      const items =
        (data.results as BranchItem[] | undefined) ??
        (data.items as BranchItem[] | undefined) ??
        (data.branches as BranchItem[] | undefined) ??
        [];

      res.json({ branches: items });
    } catch (e) {
      console.error("[elevenlabs] list-branches error:", e);
      res.status(500).json({ message: "Erro ao listar branches" });
    }
  },
);

// ─── Publicar/deploy do agente ────────────────────────────────────────────────
// Estratégia: tenta obter o branch via /branches; se vazio, lê o current_branch_id
// do próprio agente; como último recurso tenta o deploy sem branch_id (agentes sem versioning).

router.post(
  "/agents/:agentId/deploy",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const apiKey = await getElevenLabsKey();
      if (!apiKey)
        return res.status(400).json({ message: "ElevenLabs não configurado" });

      const agentId = req.params.agentId;
      const { branchId: explicitBranchId } = req.body as { branchId?: string };

      let branchId = explicitBranchId;

      if (!branchId) {
        // 1. Tentar listar branches
        const branchRes = await fetch(
          `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId)}/branches`,
          { headers: { "xi-api-key": apiKey } },
        );

        if (branchRes.ok) {
          const branchData = (await branchRes.json()) as Record<
            string,
            unknown
          >;

          type BranchItem = {
            id: string;
            name: string;
            parent_branch_id?: string | null;
          };
          // A API retorna o array em "results", "items" ou "branches" dependendo da versão
          const items =
            (branchData.results as BranchItem[] | undefined) ??
            (branchData.items as BranchItem[] | undefined) ??
            (branchData.branches as BranchItem[] | undefined) ??
            [];

          const mainBranch =
            items.find((b) => b.parent_branch_id === null) ??
            items.find((b) => b.name?.toLowerCase() === "main") ??
            items[0];

          if (mainBranch) branchId = mainBranch.id;
        }

        // 2. Fallback: usar branch_id do próprio agente
        if (!branchId) {
          const agentRes = await fetch(
            `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId)}`,
            { headers: { "xi-api-key": apiKey } },
          );
          if (agentRes.ok) {
            const agentData = (await agentRes.json()) as Record<
              string,
              unknown
            >;
            branchId =
              (agentData.branch_id as string | undefined) ??
              (agentData.main_branch_id as string | undefined) ??
              undefined;
          }
        }

        if (!branchId) {
          return res
            .status(404)
            .json({
              message: "Não foi possível determinar o branch do agente",
            });
        }
      }

      const deployRes = await fetch(
        `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(agentId)}/deployments`,
        {
          method: "POST",
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            deployment_request: {
              requests: [
                {
                  branch_id: branchId,
                  deployment_strategy: {
                    type: "percentage",
                    traffic_percentage: 100,
                  },
                },
              ],
            },
          }),
        },
      );

      if (!deployRes.ok) {
        const text = await deployRes.text();
        return res.status(deployRes.status).json({ message: text });
      }

      const deployData = await deployRes.json();
      res.json({ ok: true, branchId, deployment: deployData });
    } catch (e) {
      console.error("[elevenlabs] deploy-agent error:", e);
      res.status(500).json({ message: "Erro ao publicar agente" });
    }
  },
);

// ─── Clonar / criar voz ──────────────────────────────────────────────────────

router.post(
  "/voices",
  requireAuth,
  audioUpload.array("files", 10),
  async (req: Request, res: Response) => {
    try {
      const apiKey = await getElevenLabsKey();
      if (!apiKey)
        return res.status(400).json({ message: "ElevenLabs não configurado" });

      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        return res
          .status(400)
          .json({ message: "Envie ao menos um arquivo de áudio" });
      }

      const name = (req.body.name as string | undefined)?.trim();
      if (!name || name.length < 3) {
        return res
          .status(400)
          .json({ message: "Nome da voz deve ter ao menos 3 caracteres" });
      }

      const form = new FormData();
      form.append("name", name);
      if (req.body.description)
        form.append("description", req.body.description as string);
      if (req.body.labels) form.append("labels", req.body.labels as string);

      for (const file of files) {
        const blob = new Blob([file.buffer], { type: file.mimetype });
        form.append(
          "files",
          blob,
          file.originalname || `sample_${Date.now()}.webm`,
        );
      }

      const response = await fetch("https://api.elevenlabs.io/v1/voices/add", {
        method: "POST",
        headers: { "xi-api-key": apiKey },
        body: form,
      });

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ message: text });
      }

      const data = (await response.json()) as { voice_id: string };
      res.status(201).json({ voiceId: data.voice_id });
    } catch (e) {
      console.error("[elevenlabs] clone-voice error:", e);
      res.status(500).json({ message: "Erro ao clonar voz" });
    }
  },
);

// ─── Deletar voz clonada ──────────────────────────────────────────────────────

router.delete(
  "/voices/:voiceId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const apiKey = await getElevenLabsKey();
      if (!apiKey)
        return res.status(400).json({ message: "ElevenLabs não configurado" });

      const response = await fetch(
        `https://api.elevenlabs.io/v1/voices/${encodeURIComponent(req.params.voiceId)}`,
        { method: "DELETE", headers: { "xi-api-key": apiKey } },
      );

      if (!response.ok) {
        const text = await response.text();
        return res.status(response.status).json({ message: text });
      }

      res.json({ ok: true });
    } catch (e) {
      console.error("[elevenlabs] delete-voice error:", e);
      res.status(500).json({ message: "Erro ao deletar voz" });
    }
  },
);

// ─── Gerar system prompt com IA ───────────────────────────────────────────────

router.post(
  "/generate-system-prompt",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!process.env.OPENAI_API_KEY) {
        return res
          .status(400)
          .json({ message: "OpenAI não configurado no servidor" });
      }

      const { purpose, audience, tone, behaviors, language, agentName } =
        req.body as {
          purpose?: string;
          audience?: string;
          tone?: string;
          behaviors?: string;
          language?: string;
          agentName?: string;
        };

      if (!purpose?.trim()) {
        return res
          .status(400)
          .json({ message: "O campo 'purpose' é obrigatório" });
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const userParts: string[] = [];
      if (agentName) userParts.push(`Nome do agente: ${agentName}`);
      userParts.push(`Objetivo principal: ${purpose}`);
      if (audience) userParts.push(`Público-alvo: ${audience}`);
      if (tone) userParts.push(`Tom de voz: ${tone}`);
      if (behaviors)
        userParts.push(`Comportamentos e instruções específicas: ${behaviors}`);
      if (language) userParts.push(`Idioma das conversas: ${language}`);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: `Você é um especialista em criação de system prompts para agentes de voz conversacional (ElevenLabs Conversational AI).

Seu objetivo é gerar um system prompt completo, detalhado e eficaz em português do Brasil, pronto para ser usado diretamente no campo "prompt" do agente.

Diretrizes para o system prompt gerado:
- Escreva em português do Brasil (a não ser que o idioma informado seja outro)
- Defina claramente a identidade, papel e objetivo do agente
- Inclua instruções de comportamento conversacional (fluxo, como lidar com objeções, como encerrar a conversa)
- Especifique o tom e estilo de comunicação
- Adicione regras sobre o que o agente NÃO deve fazer
- Se pertinente, inclua instruções sobre como coletar informações do interlocutor
- Formate o prompt de forma clara, com seções bem delimitadas
- Retorne APENAS o texto do system prompt, sem explicações adicionais, sem markdown de bloco de código`,
          },
          {
            role: "user",
            content: `Gere um system prompt para um agente de voz com as seguintes características:\n\n${userParts.join("\n")}`,
          },
        ],
      });

      const prompt = completion.choices[0]?.message?.content ?? "";
      res.json({ prompt });
    } catch (e) {
      console.error("[elevenlabs] generate-system-prompt error:", e);
      res.status(500).json({ message: "Erro ao gerar system prompt" });
    }
  },
);

export default router;
