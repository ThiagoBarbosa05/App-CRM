import { Router, Request, Response, NextFunction } from "express";
import { db } from "server/db";
import {
  campaigns,
  campaignClients,
  campaignTriggers,
  calls,
  clients,
  whatsappChannels,
  whatsappCampaigns,
} from "@shared/schema";
import { eq, and, inArray, ne, sql, isNull } from "drizzle-orm";
import twilio from "twilio";
import {
  getTwilioConfig,
  getTwilioChannels,
  getServerBaseUrl,
  toE164Brazil,
} from "../lib/twilio-config";
import { ensureLocalTemplateForMeta } from "../services/whatsapp-templates.service";
import {
  listChannelIdsForUser,
  resolveChannelById,
} from "../services/whatsapp-channels.service";
import {
  analyzeBotCompatibility,
  BotCompatibilityLookupError,
} from "../services/whatsapp-bot-compatibility.service";
import {
  canActorAccessWhatsappCampaign,
  isWhatsappCampaign,
} from "../services/campaign-access.service";

const router = Router();

function respondCampaignAccessDenied(res: Response): Response {
  return res.status(403).json({
    message: "Acesso restrito a administradores e gerentes",
    code: "FORBIDDEN",
  });
}

function rejectWhatsappCampaignActivation(
  req: Request,
  res: Response,
  next: NextFunction,
): Response | void {
  if (
    Boolean(req.body?.waEnabled || req.body?.umblerEnabled) &&
    !canActorAccessWhatsappCampaign(req.user?.role)
  ) {
    return respondCampaignAccessDenied(res);
  }
  return next();
}

async function requireCampaignAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<Response | void> {
  if (canActorAccessWhatsappCampaign(req.user?.role)) {
    return next();
  }

  try {
    const [campaign] = await db
      .select({
        id: campaigns.id,
        waEnabled: campaigns.waEnabled,
        umblerEnabled: campaigns.umblerEnabled,
        whatsappCampaignId: whatsappCampaigns.id,
      })
      .from(campaigns)
      .leftJoin(whatsappCampaigns, eq(whatsappCampaigns.id, campaigns.id))
      .where(eq(campaigns.id, req.params.id))
      .limit(1);

    if (campaign && isWhatsappCampaign(campaign)) {
      return respondCampaignAccessDenied(res);
    }
    return next();
  } catch (error) {
    console.error("[campaigns access] Erro ao verificar acesso:", error);
    return res.status(500).json({ message: "Erro ao verificar acesso à campanha" });
  }
}

// ─── Listar campanhas ─────────────────────────────────────────────────────────

router.get("/", async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        campaign: campaigns,
        whatsappCampaignId: whatsappCampaigns.id,
      })
      .from(campaigns)
      .leftJoin(whatsappCampaigns, eq(whatsappCampaigns.id, campaigns.id))
      .where(isNull(campaigns.deletedAt))
      .orderBy(campaigns.createdAt);

    const visibleCampaigns = rows
      .filter(
        ({ campaign, whatsappCampaignId }) =>
          canActorAccessWhatsappCampaign(req.user?.role) ||
          !isWhatsappCampaign({
            waEnabled: campaign.waEnabled,
            umblerEnabled: campaign.umblerEnabled,
            whatsappCampaignId,
          }),
      )
      .map(({ campaign }) => campaign);
    res.json(visibleCampaigns);
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar campanhas" });
  }
});

// ─── Criar campanha ───────────────────────────────────────────────────────────

router.post("/", rejectWhatsappCampaignActivation, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const {
      name,
      description,
      type,
      elevenLabsAgentId,
      elevenLabsVoiceId,
      startDate,
      endDate,
      umblerEnabled,
      umblerChannelId,
      umblerBotId,
      umblerBotTriggerName,
      umblerMessageText,
      umblerTriggerDecision,
      waEnabled,
      waTemplateId,
      waBotId,
      waChannelId,
      metaTemplateName,
      metaTemplateLanguage,
      metaTemplateCategory,
      metaTemplateBodyParams,
      metaTemplateHeaderParams,
      metaTemplateHeaderMedia,
    } = req.body as {
      name: string;
      description?: string;
      type: "humano" | "ia";
      elevenLabsAgentId?: string;
      elevenLabsVoiceId?: string;
      startDate?: string;
      endDate?: string;
      umblerEnabled?: boolean;
      umblerChannelId?: string;
      umblerBotId?: string;
      umblerBotTriggerName?: string;
      umblerMessageText?: string;
      umblerTriggerDecision?: string;
      waEnabled?: boolean;
      waTemplateId?: string;
      waBotId?: string;
      waChannelId?: number | null;
      metaTemplateName?: string;
      metaTemplateLanguage?: string;
      metaTemplateCategory?: string;
      metaTemplateBodyParams?: string[];
      metaTemplateHeaderParams?: string[];
      metaTemplateHeaderMedia?: { storageKey: string; mediaType: "image" | "video" | "document" };
    };

    if (!name || !type) {
      return res.status(400).json({ message: "Nome e tipo são obrigatórios" });
    }

    const hasTemplate = Boolean(waTemplateId || metaTemplateName);
    const hasBot = Boolean(waBotId);
    if (waEnabled && hasTemplate === hasBot) {
      return res.status(400).json({
        message: "Selecione exatamente um conteúdo: template ou bot",
      });
    }

    // Seleção de template da Meta → resolve/cria a linha local usada no disparo.
    let resolvedWaChannelId: number | null = null;
    if (waChannelId != null) {
      if (!Number.isInteger(waChannelId) || waChannelId <= 0) {
        return res.status(400).json({ message: "Canal de envio inválido" });
      }
      const [channel] = await db
        .select({
          id: whatsappChannels.id,
          provider: whatsappChannels.provider,
          connectionStatus: whatsappChannels.connectionStatus,
        })
        .from(whatsappChannels)
        .where(
          and(
            eq(whatsappChannels.id, waChannelId),
            eq(whatsappChannels.isActive, true),
            isNull(whatsappChannels.deletedAt),
          ),
        )
        .limit(1);
      if (!channel) {
        return res.status(400).json({
          message: "O canal de envio selecionado não existe ou está inativo",
        });
      }

      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      if (req.user?.role === "vendedor") {
        const accessibleChannelIds = await listChannelIdsForUser(userId);
        if (!accessibleChannelIds.includes(channel.id)) {
          return res.status(403).json({
            message: "Você não possui acesso ao canal de envio selecionado",
          });
        }
      }
      const resolvedChannel = await resolveChannelById(channel.id);
      if (
        !resolvedChannel ||
        (channel.provider === "evolution" &&
          channel.connectionStatus !== "connected")
      ) {
        return res.status(400).json({
          message: "O canal de envio selecionado não está conectado ou configurado",
        });
      }
      if (hasTemplate && resolvedChannel.provider !== "cloud_api") {
        return res.status(400).json({
          message: "Campanhas com template exigem um canal Cloud API",
        });
      }
      if (waBotId) {
        const compatibility = await analyzeBotCompatibility(waBotId, channel.id);
        if (!compatibility.compatible) {
          return res.status(400).json({
            message: "O bot não é compatível com o canal selecionado",
            compatibility,
          });
        }
      }
      resolvedWaChannelId = channel.id;
    }
    if (waEnabled && resolvedWaChannelId == null) {
      return res.status(400).json({
        message: "Selecione o canal que será usado para enviar a campanha",
      });
    }

    let resolvedTemplateId = waTemplateId ?? null;
    if (!resolvedTemplateId && metaTemplateName) {
      if (!userId) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      const local = await ensureLocalTemplateForMeta(db, {
        name: metaTemplateName,
        languageCode: metaTemplateLanguage || "pt_BR",
        category: metaTemplateCategory,
        createdBy: userId,
      });
      resolvedTemplateId = local.id;
    }

    const [campaign] = await db
      .insert(campaigns)
      .values({
        name,
        description,
        type,
        elevenLabsAgentId,
        elevenLabsVoiceId,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        umblerEnabled: umblerEnabled ?? false,
        umblerChannelId: umblerChannelId ?? null,
        umblerBotId: umblerBotId ?? null,
        umblerBotTriggerName: umblerBotTriggerName ?? null,
        umblerMessageText: umblerMessageText ?? null,
        umblerTriggerDecision: umblerTriggerDecision ?? null,
        waEnabled: waEnabled ?? false,
        waTemplateId: resolvedTemplateId,
        waBotId: waBotId ?? null,
        waChannelId: resolvedWaChannelId,
        metaTemplateBodyParams: metaTemplateBodyParams ?? null,
        metaTemplateHeaderParams: metaTemplateHeaderParams ?? null,
        metaTemplateHeaderMediaStorageKey: metaTemplateHeaderMedia?.storageKey ?? null,
        metaTemplateHeaderMediaType: metaTemplateHeaderMedia?.mediaType ?? null,
        createdBy: userId ?? null,
      })
      .returning();

    res.status(201).json(campaign);
  } catch (e) {
    if (e instanceof BotCompatibilityLookupError) {
      return res.status(e.statusCode).json({ message: e.message });
    }
    console.error("[POST /api/campaigns] Erro ao criar campanha:", e);
    res.status(500).json({ message: "Erro ao criar campanha" });
  }
});

// ─── Buscar campanha ──────────────────────────────────────────────────────────

// Todas as operações por ID passam por uma única fronteira de acesso.
// Vendedores continuam usando campanhas de telemarketing, mas nunca conseguem
// consultar nem alterar campanhas que possuem qualquer integração WhatsApp.
router.use("/:id", requireCampaignAccess);

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, req.params.id));
    if (!campaign) return res.status(404).json({ message: "Campanha não encontrada" });
    res.json(campaign);
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar campanha" });
  }
});

// ─── Atualizar campanha ───────────────────────────────────────────────────────

router.put("/:id", rejectWhatsappCampaignActivation, async (req: Request, res: Response) => {
  try {
    const {
      name,
      description,
      status,
      type,
      elevenLabsAgentId,
      elevenLabsVoiceId,
      startDate,
      endDate,
      umblerEnabled,
      umblerChannelId,
      umblerBotId,
      umblerBotTriggerName,
      umblerMessageText,
      umblerTriggerDecision,
    } = req.body as {
      name?: string;
      description?: string;
      status?: "rascunho" | "ativa" | "pausada" | "encerrada";
      type?: "humano" | "ia";
      elevenLabsAgentId?: string;
      elevenLabsVoiceId?: string;
      startDate?: string;
      endDate?: string;
      umblerEnabled?: boolean;
      umblerChannelId?: string;
      umblerBotId?: string;
      umblerBotTriggerName?: string;
      umblerMessageText?: string;
      umblerTriggerDecision?: string;
    };

    const [campaign] = await db
      .update(campaigns)
      .set({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(type !== undefined && { type }),
        ...(elevenLabsAgentId !== undefined && { elevenLabsAgentId }),
        ...(elevenLabsVoiceId !== undefined && { elevenLabsVoiceId }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(umblerEnabled !== undefined && { umblerEnabled }),
        ...(umblerChannelId !== undefined && { umblerChannelId: umblerChannelId || null }),
        ...(umblerBotId !== undefined && { umblerBotId: umblerBotId || null }),
        ...(umblerBotTriggerName !== undefined && { umblerBotTriggerName: umblerBotTriggerName || null }),
        ...(umblerMessageText !== undefined && { umblerMessageText: umblerMessageText || null }),
        ...(umblerTriggerDecision !== undefined && { umblerTriggerDecision: umblerTriggerDecision || null }),
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, req.params.id))
      .returning();

    if (!campaign) return res.status(404).json({ message: "Campanha não encontrada" });
    res.json(campaign);
  } catch (e) {
    res.status(500).json({ message: "Erro ao atualizar campanha" });
  }
});

// ─── Excluir campanha ─────────────────────────────────────────────────────────

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const [updated] = await db
      .update(campaigns)
      .set({ deletedAt: new Date() })
      .where(and(eq(campaigns.id, req.params.id), isNull(campaigns.deletedAt)))
      .returning({ id: campaigns.id });
    if (!updated) return res.status(404).json({ message: "Campanha não encontrada" });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Erro ao excluir campanha" });
  }
});

// ─── Clientes da campanha ─────────────────────────────────────────────────────

router.get("/:id/clients", async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        id: campaignClients.id,
        campaignId: campaignClients.campaignId,
        clientId: campaignClients.clientId,
        status: campaignClients.status,
        createdAt: campaignClients.createdAt,
        clientName: clients.name,
        clientPhone: clients.phone,
      })
      .from(campaignClients)
      .leftJoin(clients, eq(campaignClients.clientId, clients.id))
      .where(eq(campaignClients.campaignId, req.params.id));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar clientes da campanha" });
  }
});

router.post("/:id/clients", async (req: Request, res: Response) => {
  try {
    const { clientIds } = req.body as { clientIds: string[] };
    if (!clientIds?.length) {
      return res.status(400).json({ message: "clientIds é obrigatório" });
    }

    const values = clientIds.map((clientId) => ({
      campaignId: req.params.id,
      clientId,
      status: "novo" as const,
    }));

    await db.insert(campaignClients).values(values).onConflictDoNothing();
    res.status(201).json({ added: values.length });
  } catch (e) {
    res.status(500).json({ message: "Erro ao adicionar clientes" });
  }
});

router.delete("/:id/clients/:clientId", async (req: Request, res: Response) => {
  try {
    await db
      .delete(campaignClients)
      .where(
        and(
          eq(campaignClients.campaignId, req.params.id),
          eq(campaignClients.clientId, req.params.clientId)
        )
      );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Erro ao remover cliente" });
  }
});

// ─── Triggers ─────────────────────────────────────────────────────────────────

router.get("/:id/triggers", async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(campaignTriggers)
      .where(eq(campaignTriggers.campaignId, req.params.id));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar triggers" });
  }
});

router.post("/:id/triggers", async (req: Request, res: Response) => {
  try {
    const { keyword, instruction } = req.body as {
      keyword: string;
      instruction?: string;
    };
    if (!keyword) return res.status(400).json({ message: "keyword é obrigatório" });

    const [trigger] = await db
      .insert(campaignTriggers)
      .values({ campaignId: req.params.id, keyword, instruction })
      .returning();
    res.status(201).json(trigger);
  } catch (e) {
    res.status(500).json({ message: "Erro ao criar trigger" });
  }
});

router.delete("/:id/triggers/:triggerId", async (req: Request, res: Response) => {
  try {
    await db
      .delete(campaignTriggers)
      .where(
        and(
          eq(campaignTriggers.campaignId, req.params.id),
          eq(campaignTriggers.id, req.params.triggerId)
        )
      );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: "Erro ao remover trigger" });
  }
});

// ─── Progresso da campanha (clientes + última chamada de cada um) ─────────────

router.get("/:id/progress", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;

    const [clientRows, callRows] = await Promise.all([
      db
        .select({
          id: campaignClients.id,
          clientId: campaignClients.clientId,
          status: campaignClients.status,
          createdAt: campaignClients.createdAt,
          clientName: clients.name,
          clientPhone: clients.phone,
        })
        .from(campaignClients)
        .leftJoin(clients, eq(campaignClients.clientId, clients.id))
        .where(eq(campaignClients.campaignId, id))
        .orderBy(campaignClients.createdAt),
      db
        .select({
          clientId: calls.clientId,
          callId: calls.id,
          callStatus: calls.status,
          aiDecision: calls.aiDecision,
          startedAt: calls.startedAt,
        })
        .from(calls)
        .where(eq(calls.campaignId, id))
        .orderBy(calls.startedAt),
    ]);

    // Última chamada por cliente (callRows já ordenado por startedAt asc → last wins)
    const latestCall = new Map<string, (typeof callRows)[0]>();
    for (const c of callRows) {
      if (c.clientId) latestCall.set(c.clientId, c);
    }

    const rows = clientRows.map((cc) => {
      const lc = cc.clientId ? (latestCall.get(cc.clientId) ?? null) : null;
      return {
        id: cc.id,
        clientId: cc.clientId,
        clientName: cc.clientName,
        clientPhone: cc.clientPhone,
        campaignStatus: cc.status,
        callId: lc?.callId ?? null,
        callStatus: lc?.callStatus ?? null,
        aiDecision: lc?.aiDecision ?? null,
        startedAt: lc?.startedAt ?? null,
      };
    });

    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar progresso" });
  }
});

// ─── Estatísticas da campanha ─────────────────────────────────────────────────

router.get("/:id/stats", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const [total, contacted, simCount, naoCount, failedCount] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(campaignClients)
        .where(eq(campaignClients.campaignId, id)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(campaignClients)
        .where(and(eq(campaignClients.campaignId, id), ne(campaignClients.status, "novo"))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(calls)
        .where(and(eq(calls.campaignId, id), eq(calls.aiDecision, "sim"))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(calls)
        .where(and(eq(calls.campaignId, id), eq(calls.aiDecision, "nao"))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(calls)
        .where(and(eq(calls.campaignId, id), eq(calls.status, "falhou"))),
    ]);
    res.json({
      total: Number(total[0]?.count ?? 0),
      contacted: Number(contacted[0]?.count ?? 0),
      sim: Number(simCount[0]?.count ?? 0),
      nao: Number(naoCount[0]?.count ?? 0),
      failed: Number(failedCount[0]?.count ?? 0),
    });
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar estatísticas" });
  }
});

// ─── Chamadas da campanha ─────────────────────────────────────────────────────

router.get("/:id/calls", async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        id: calls.id,
        status: calls.status,
        outcome: calls.outcome,
        aiDecision: calls.aiDecision,
        duration: calls.duration,
        startedAt: calls.startedAt,
        endedAt: calls.endedAt,
        clientName: clients.name,
        clientPhone: clients.phone,
      })
      .from(calls)
      .leftJoin(clients, eq(calls.clientId, clients.id))
      .where(eq(calls.campaignId, req.params.id))
      .orderBy(calls.startedAt);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: "Erro ao buscar chamadas da campanha" });
  }
});

// ─── Disparar campanha ────────────────────────────────────────────────────────

router.post("/:id/dispatch", async (req: Request, res: Response) => {
  try {
    const [campaign] = await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, req.params.id));

    if (!campaign) return res.status(404).json({ message: "Campanha não encontrada" });

    if (campaign.type === "ia" && !campaign.elevenLabsAgentId) {
      return res
        .status(400)
        .json({ message: "Agent ID do ElevenLabs não configurado na campanha" });
    }

    const config = await getTwilioConfig();
    if (!config.accountSid || !config.authToken) {
      return res.status(400).json({ message: "Twilio não configurado" });
    }

    const { fromNumber: callerIdOverride } = req.body as { fromNumber?: string };
    const from = callerIdOverride || config.fromNumber;
    if (!from) return res.status(400).json({ message: "Número de origem não configurado" });

    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: "Não autenticado" });

    const novos = await db
      .select({
        ccId: campaignClients.id,
        clientId: campaignClients.clientId,
        clientName: clients.name,
        clientPhone: clients.phone,
      })
      .from(campaignClients)
      .leftJoin(clients, eq(campaignClients.clientId, clients.id))
      .where(
        and(
          eq(campaignClients.campaignId, req.params.id),
          eq(campaignClients.status, "novo")
        )
      );

    if (novos.length === 0) {
      return res.json({ dispatched: 0, total: 0, calls: [] });
    }

    const baseUrl = await getServerBaseUrl();
    const twilioClient = twilio(config.accountSid, config.authToken);
    const dispatchResults: Array<{
      clientId: string;
      clientName: string | null;
      callSid: string | null;
      callRecordId: string;
      status: string;
    }> = [];

    for (const cc of novos) {
      if (!cc.clientPhone) {
        dispatchResults.push({
          clientId: cc.clientId,
          clientName: cc.clientName,
          callSid: null,
          callRecordId: "",
          status: "sem_telefone",
        });
        continue;
      }

      // Reserva atomicamente: marca campaignClient como 'contactado' antes
      // de criar a call. Se outra instância já tomou (race), pula.
      const [reserved] = await db
        .update(campaignClients)
        .set({
          status: "contactado",
          attempts: sql`${campaignClients.attempts} + 1`,
          lastAttemptAt: new Date(),
        })
        .where(
          and(
            eq(campaignClients.id, cc.ccId),
            eq(campaignClients.status, "novo"),
          ),
        )
        .returning({ id: campaignClients.id });

      if (!reserved) {
        // Outra instância já processou este cliente
        continue;
      }

      const [callRecord] = await db
        .insert(calls)
        .values({
          clientId: cc.clientId,
          operatorId: userId,
          campaignId: req.params.id,
          status: "iniciando",
          startedAt: new Date(),
        })
        .returning();

      const urlParams = new URLSearchParams({
        callRecordId: callRecord.id,
        campaignType: campaign.type,
        ...(campaign.elevenLabsAgentId && { agentId: campaign.elevenLabsAgentId }),
        ...(campaign.elevenLabsVoiceId && { voiceId: campaign.elevenLabsVoiceId }),
      });

      try {
        const e164 = toE164Brazil(cc.clientPhone);
        const call = await twilioClient.calls.create({
          to: e164,
          from,
          url: `${baseUrl}/api/twilio/voice?${urlParams.toString()}`,
          statusCallback: config.statusCallbackUrl ?? `${baseUrl}/api/calls/twilio-status`,
          statusCallbackMethod: "POST",
        });

        await db
          .update(calls)
          .set({ twilioCallSid: call.sid })
          .where(eq(calls.id, callRecord.id));

        dispatchResults.push({
          clientId: cc.clientId,
          clientName: cc.clientName,
          callSid: call.sid,
          callRecordId: callRecord.id,
          status: call.status,
        });
      } catch (err) {
        console.error(`[campaigns] dispatch error for ${cc.clientId}:`, err);
        // Rollback: marca call falhou, devolve campaign_client ao estado novo
        // para que retry posterior (Fase 4) reprocesse.
        await db
          .update(calls)
          .set({ status: "falhou", endedAt: new Date() })
          .where(eq(calls.id, callRecord.id));
        await db
          .update(campaignClients)
          .set({ status: "novo" })
          .where(eq(campaignClients.id, cc.ccId));

        dispatchResults.push({
          clientId: cc.clientId,
          clientName: cc.clientName,
          callSid: null,
          callRecordId: callRecord.id,
          status: "falhou",
        });
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    res.json({
      dispatched: dispatchResults.filter((r) => r.callSid).length,
      total: novos.length,
      calls: dispatchResults,
    });
  } catch (e) {
    console.error("[campaigns] dispatch error:", e);
    res.status(500).json({ message: "Erro ao disparar campanha" });
  }
});

export default router;
