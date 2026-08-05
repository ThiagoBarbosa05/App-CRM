import { Router, Request, Response } from "express";
import {
  listChannels,
  listActiveChannels,
  listAccessibleChannelsForUser,
  listAttendantsWithChannel,
  getChannelById,
  createChannel,
  updateChannel,
  deleteChannel,
  canUserReadChannelQr,
  resolveChannelById,
} from "../services/whatsapp-channels.service";
import { applyChannelConnectionStatus } from "../services/baileys/connection-status.service";
import {
  listWabaPhoneNumbers,
  getPhoneNumberDetails,
  requestVerificationCode,
  verifyPhoneNumber,
} from "../integrations/whatsapp";
import {
  connectInstance,
  logoutInstance,
  deleteInstance as deleteEvolutionInstance,
} from "../integrations/evolution";
import {
  baileysGateway,
  BaileysGatewayError,
} from "../integrations/baileys-gateway";
import { getWhatsappSettingsRaw } from "../services/whatsapp-settings.service";
import { listChannelConnectionEvents } from "../services/baileys/connection-events.service";
import { isAdminOrGerente, requireAdminOrGerente } from "../middleware/validation";

const router = Router();

function sendGatewayError(res: Response, error: unknown): void {
  if (!(error instanceof BaileysGatewayError)) {
    const message = error instanceof Error ? error.message : "Erro no Baileys Gateway";
    res.status(500).json({ message });
    return;
  }
  const status =
    error.code === "not_found"
      ? 404
      : error.code === "rate_limited"
        ? 429
        : error.code === "overloaded"
          ? 503
          : error.code === "unauthorized"
            ? 502
            : error.code === "channel_offline"
              ? 409
              : 502;
  res.status(status).json({ message: error.message, code: error.code });
}

router.get("/channels", async (_req: Request, res: Response) => {
  const channels = await listChannels();
  res.json(channels);
});

// Canais que podem efetivamente originar uma campanha. Diferente de /mine,
// esta lista exclui configurações incompletas e instâncias QR desconectadas.
router.get("/channels/campaign", async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user?.userId) {
      return res.status(401).json({ message: "Não autenticado" });
    }

    const visibleChannels =
      user.role === "vendedor"
        ? await listAccessibleChannelsForUser(user.userId)
        : await listActiveChannels();
    const resolvedChannels = await Promise.all(
      visibleChannels.map(async (channel) => ({
        channel,
        resolved: await resolveChannelById(channel.id).catch(() => null),
      })),
    );

    return res.json(
      resolvedChannels
        .filter(
          ({ channel, resolved }) =>
            resolved !== null &&
            (channel.provider !== "evolution" ||
              channel.connectionStatus === "connected"),
        )
        .map(({ channel }) => channel),
    );
  } catch (error) {
    console.error("[GET /whatsapp/channels/campaign] Erro ao buscar canais:", error);
    return res.status(500).json({ message: "Erro ao buscar canais disponíveis" });
  }
});

// Deve ficar antes de /channels/:id para não ser capturado como id
router.get("/channels/mine", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    if (user.role === "vendedor") {
      const channels = await listAccessibleChannelsForUser(user.userId);
      return res.json(channels);
    }
    res.json(await listActiveChannels());
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao buscar canais";
    res.status(500).json({ message });
  }
});

/**
 * Diretório interno de canais: nome + número de cada canal conectado, para
 * qualquer usuário autenticado. Alimenta a aba "Atendentes" do diálogo
 * "Nova conversa", onde se inicia uma conversa de WhatsApp com o número de
 * outro setor/atendente. Só expõe nome e telefone do canal — nenhuma
 * credencial —, ao contrário de /channels/:id, que é restrito.
 * Deve ficar antes de /channels/:id para não ser capturado como id.
 */
router.get("/channels/directory", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });
    const channels = await listActiveChannels();
    res.json(
      channels
        .filter((c) => !!c.displayPhone)
        .map((c) => ({
          id: c.id,
          name: c.name,
          displayPhone: c.displayPhone,
          connectionStatus: c.connectionStatus,
          provider: c.provider,
        })),
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao listar canais";
    res.status(500).json({ message });
  }
});

router.get("/attendants", async (req: Request, res: Response) => {
  if (!isAdminOrGerente(req)) {
    res.status(403).json({ message: "Acesso restrito a administradores e gerentes" });
    return;
  }
  res.json(await listAttendantsWithChannel());
});

router.get("/channels/from-waba", async (_req: Request, res: Response) => {
  try {
    const numbers = await listWabaPhoneNumbers();
    res.json(numbers);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao buscar números da WABA";
    res.status(500).json({ message });
  }
});

// Retorna a linha completa do canal, incluindo accessToken em texto plano
// (decifrado por getChannelById) — restrito a admin/gerente para não vazar
// credenciais do WhatsApp Cloud API para qualquer usuário autenticado.
router.get("/channels/:id", requireAdminOrGerente, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.sendStatus(400); return; }
  const channel = await getChannelById(id);
  if (!channel) { res.sendStatus(404); return; }
  res.json(channel);
});

// Consulta o status AO VIVO no gateway. O ramo Cloud API devolve dados da Meta
// e segue restrito a admin/gerente; o ramo QR é self-service (o vendedor
// precisa poder verificar o próprio canal), com o mesmo critério de
// canConnectChannel usado por connect/qr/logout.
router.get("/channels/:id/status", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.sendStatus(400); return; }
    const channel = await getChannelById(id);
    if (!channel) { res.sendStatus(404); return; }

    if (channel.provider === "evolution") {
      if (!(await canConnectChannel(req, channel))) {
        res.status(403).json({ message: "Acesso restrito ao dono do canal, administradores ou atendentes autorizados" });
        return;
      }
      if (!channel.evolutionInstanceName) {
        res.status(400).json({ message: "Canal Evolution sem instância configurada" });
        return;
      }
      if (channel.qrBackend !== "gateway") {
        res.status(409).json({ message: "Canal QR não configurado para o gateway" });
        return;
      }
      const instance = await baileysGateway.getInstance(channel.evolutionInstanceName);
      const connectionStatus = instance.observed_state_stale
        ? "disconnected"
        : instance.observed_state === "lock_wait"
          ? "connecting"
          : instance.observed_state === "failed"
            ? "disconnected"
            : instance.observed_state;
      if (connectionStatus !== channel.connectionStatus) {
        await applyChannelConnectionStatus(id, connectionStatus, {
          source: "route",
          occurredAt: new Date(),
          reasonLabel: instance.observed_state_stale
            ? "Gateway parou de responder pela sessão"
            : instance.last_error ?? undefined,
        });
      }
      res.json({
        provider: "evolution",
        qrBackend: "gateway",
        connectionStatus,
        observedState: instance.observed_state,
        observedStale: instance.observed_state_stale ?? false,
        observedAt: instance.observed_at ?? instance.updated_at,
        instanceState: instance.observed_state === "connected" ? "open" : instance.observed_state,
        desiredState: instance.desired_state,
        connectedPhone: instance.connected_phone,
        lastError: instance.last_error,
      });
      return;
    }

    if (!isAdminOrGerente(req)) {
      res.status(403).json({ message: "Acesso restrito a administradores e gerentes" });
      return;
    }

    if (!channel.phoneNumberId || !channel.accessToken) {
      res.status(400).json({ message: "Canal Cloud API sem phoneNumberId ou accessToken" });
      return;
    }
    const details = await getPhoneNumberDetails(channel.phoneNumberId, {
      phoneNumberId: channel.phoneNumberId,
      accessToken: channel.accessToken,
    });
    res.json(details);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao buscar status do canal";
    res.status(500).json({ message });
  }
});

router.get("/channels/:id/connection-events", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.sendStatus(400); return; }
    const channel = await getChannelById(id);
    if (!channel) { res.sendStatus(404); return; }

    // Mesmo critério de canConnectChannel: quem pode abrir o diálogo de QR
    // precisa enxergar o histórico dentro dele. Antes, um atendente com
    // permissão de leitura de QR abria o diálogo e recebia 403 aqui — o bloco
    // de histórico simplesmente sumia, sem explicação.
    if (!(await canConnectChannel(req, channel))) {
      res.status(403).json({ message: "Acesso restrito ao dono do canal, administradores ou atendentes autorizados" });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const result = await listChannelConnectionEvents(id, limit, offset);
    res.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao buscar histórico de conexão";
    res.status(500).json({ message });
  }
});

// ── Rotas exclusivas de canais Evolution ──────────────────────────────────────
// Todas as rotas abaixo alteram/expõem configuração sensível de canais
// (dono, setor padrão, credenciais, conexão do número) — restritas a
// administradores e gerentes para evitar que um vendedor se auto-atribua a
// posse de um canal (e, com isso, o escopo de setor/canal de outros
// atendentes) via chamada direta à API.

router.post("/channels/evolution", requireAdminOrGerente, async (req: Request, res: Response) => {
  try {
    const { name, userId, displayPhone, defaultSectorId } = req.body as {
      name: string;
      userId?: string;
      displayPhone?: string;
      defaultSectorId?: string | null;
    };
    if (!name) { res.status(400).json({ error: "name é obrigatório" }); return; }

    // instanceName único baseado no nome (slug)
    const instanceName = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);

    // Falha fechada: não cria um canal no CRM quando o gateway obrigatório
    // está indisponível ou sem configuração.
    await baileysGateway.createInstance(instanceName);
    const channel = await createChannel({
      name,
      provider: "evolution",
      evolutionInstanceName: instanceName,
      qrBackend: "gateway",
      connectionStatus: "disconnected",
      displayPhone,
      userId,
      isActive: true,
      defaultSectorId,
    });
    res.status(201).json(channel);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao criar canal Evolution";
    res.status(500).json({ message });
  }
});

// Conectar/desconectar (QR Code) é uma ação de self-service: o próprio dono
// do canal (ex.: vendedor reconectando "Meu WhatsApp"), admin/gerente, ou um
// atendente com permissão explícita de leitura de QR (whatsapp_channel_qr_readers,
// configurada em /api/users/:id/whatsapp-qr-access) também pode acionar —
// por isso não usa requireAdminOrGerente aqui.
async function canConnectChannel(req: Request, channel: { id: number; userId: string | null }): Promise<boolean> {
  const user = (req as any).user;
  const isOwner = !!channel.userId && channel.userId === user?.userId;
  if (isOwner || isAdminOrGerente(req)) return true;
  if (!user?.userId) return false;
  return canUserReadChannelQr(user.userId, channel.id);
}

router.get("/channels/:id/evolution/connect", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.sendStatus(400); return; }
    const channel = await getChannelById(id);
    if (!channel?.evolutionInstanceName) { res.sendStatus(404); return; }
    if (!(await canConnectChannel(req, channel))) {
      res.status(403).json({ message: "Acesso restrito ao dono do canal, administradores ou atendentes autorizados" });
      return;
    }

    // "Conectar via QR" é uma ação EXPLÍCITA do usuário (o frontend não dispara
    // mais isso automaticamente ao montar). Portanto sempre força um QR novo —
    // é o "reset" confiável do canal. A proteção contra reconexões incidentais
    // (abrir o CRM em outro dispositivo) fica por conta do frontend, que apenas
    // reflete o status e só chama este endpoint no clique do botão.
    const qrData = await connectInstance(channel.evolutionInstanceName);
    // Só grava no banco quando de fato houve reinício (QR novo) ou o backend
    // confirmou que o canal já estava conectado. Se nenhum dos dois ocorreu
    // (ex.: lock da instância pertence a outra réplica), não sobrescreve o
    // status atual — sobrescrever aqui derrubava um "connected" legítimo
    // para "connecting" mesmo com o socket real seguindo vivo e recebendo
    // mensagens, deixando o canal preso em "desconectado" na UI.
    if (qrData.connectionStatus === "connected") {
      await applyChannelConnectionStatus(id, "connected", { source: "route", occurredAt: new Date() });
    } else if (qrData.base64) {
      await applyChannelConnectionStatus(id, "connecting", {
        source: "route",
        occurredAt: new Date(),
        logEvent: false,
      });
    }
    res.json(qrData);
  } catch (e) {
    sendGatewayError(res, e);
  }
});

router.get("/channels/:id/evolution/qr", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.sendStatus(400); return; }
    const channel = await getChannelById(id);
    if (!channel?.evolutionInstanceName) { res.sendStatus(404); return; }
    if (!(await canConnectChannel(req, channel))) {
      res.status(403).json({ message: "Acesso negado" });
      return;
    }
    if (channel.qrBackend !== "gateway") {
      res.status(409).json({ message: "Canal QR não configurado para o gateway" });
      return;
    }
    try {
      const qr = await baileysGateway.getQr(channel.evolutionInstanceName);
      if (qr.connectionStatus === "connected") {
        await applyChannelConnectionStatus(id, "connected", { source: "route", occurredAt: new Date() });
      } else if (
        qr.connectionStatus === "connecting" ||
        qr.connectionStatus === "lock_wait" ||
        qr.connectionStatus === "qr"
      ) {
        // Este polling roda a cada 2,5s enquanto o diálogo espera o QR —
        // logEvent:false para não gerar uma linha de histórico por rodada.
        await applyChannelConnectionStatus(id, "connecting", {
          source: "route",
          occurredAt: new Date(),
          logEvent: false,
        });
      } else if (qr.connectionStatus === "failed") {
        await applyChannelConnectionStatus(id, "disconnected", {
          source: "route",
          occurredAt: new Date(),
          reasonLabel: qr.lastError ?? "O gateway não conseguiu abrir a sessão",
        });
      }
      res.json(qr);
    } catch (error) {
      if (error instanceof BaileysGatewayError && error.code === "not_found") {
        const instance = await baileysGateway.getInstance(channel.evolutionInstanceName);
        res.json({
          code: "",
          connectionStatus: instance.observed_state === "connected" ? "connected" : undefined,
          observedState: instance.observed_state,
          desiredState: instance.desired_state,
        });
        return;
      }
      throw error;
    }
  } catch (error) {
    sendGatewayError(res, error);
  }
});

router.patch("/channels/:id/evolution/backend", requireAdminOrGerente, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { qrBackend } = req.body as { qrBackend?: string };
    if (isNaN(id) || qrBackend !== "gateway") {
      res.status(400).json({ message: 'Somente qrBackend "gateway" é permitido' });
      return;
    }
    const channel = await getChannelById(id);
    if (!channel?.evolutionInstanceName) { res.sendStatus(404); return; }
    await baileysGateway.createInstance(channel.evolutionInstanceName);
    const updated = await updateChannel(id, {
      qrBackend: "gateway",
      connectionStatus: "disconnected",
    });
    res.json(updated);
  } catch (error) {
    sendGatewayError(res, error);
  }
});

router.post("/channels/:id/evolution/logout", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.sendStatus(400); return; }
    const channel = await getChannelById(id);
    if (!channel?.evolutionInstanceName) { res.sendStatus(404); return; }
    if (!(await canConnectChannel(req, channel))) {
      res.status(403).json({ message: "Acesso restrito ao dono do canal, administradores ou atendentes autorizados" });
      return;
    }

    await logoutInstance(channel.evolutionInstanceName);
    await applyChannelConnectionStatus(id, "disconnected", {
      source: "route",
      occurredAt: new Date(),
      reasonLabel: "Desconectado manualmente pelo CRM",
    });
    res.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao desconectar canal";
    res.status(500).json({ message });
  }
});

router.post("/channels/:id/request-code", requireAdminOrGerente, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.sendStatus(400); return; }
    const channel = await getChannelById(id);
    if (!channel?.phoneNumberId || !channel.accessToken) { res.sendStatus(404); return; }
    const { codeMethod = "SMS" } = req.body as { codeMethod?: "SMS" | "VOICE" };
    await requestVerificationCode(channel.phoneNumberId, codeMethod, {
      phoneNumberId: channel.phoneNumberId,
      accessToken: channel.accessToken,
    });
    res.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao solicitar código";
    res.status(500).json({ message });
  }
});

router.post("/channels/:id/verify-code", requireAdminOrGerente, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.sendStatus(400); return; }
    const channel = await getChannelById(id);
    if (!channel?.phoneNumberId || !channel.accessToken) { res.sendStatus(404); return; }
    const { code } = req.body as { code: string };
    if (!code) { res.status(400).json({ message: "Código é obrigatório" }); return; }
    await verifyPhoneNumber(channel.phoneNumberId, code, {
      phoneNumberId: channel.phoneNumberId,
      accessToken: channel.accessToken,
    });
    res.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao verificar código";
    res.status(500).json({ message });
  }
});

router.post("/channels", requireAdminOrGerente, async (req: Request, res: Response) => {
  const { name, phoneNumberId, accessToken, wabaId, displayPhone, userId, isActive, defaultSectorId } = req.body as {
    name: string;
    phoneNumberId: string;
    accessToken?: string;
    wabaId?: string;
    displayPhone?: string;
    userId?: string;
    isActive?: boolean;
    defaultSectorId?: string | null;
  };

  if (!name || !phoneNumberId) {
    res.status(400).json({ error: "name e phoneNumberId são obrigatórios" });
    return;
  }

  try {
    let resolvedToken = accessToken ?? "";
    let resolvedWabaId = wabaId ?? "";

    if (!resolvedToken || !resolvedWabaId) {
      const settings = await getWhatsappSettingsRaw();
      if (!resolvedToken) resolvedToken = settings["wa_access_token"] ?? "";
      if (!resolvedWabaId) resolvedWabaId = settings["wa_waba_id"] ?? "";
    }

    const channel = await createChannel({
      name,
      phoneNumberId,
      accessToken: resolvedToken,
      wabaId: resolvedWabaId,
      displayPhone,
      userId,
      isActive,
      defaultSectorId,
    });
    res.status(201).json(channel);
  } catch (e) {
    if ((e as { code?: string })?.code === "23505") {
      res.status(409).json({ error: "Já existe um canal cadastrado com esse phoneNumberId" });
      return;
    }
    const message = e instanceof Error ? e.message : "Erro ao criar canal";
    res.status(500).json({ message });
  }
});

router.patch("/channels/:id", requireAdminOrGerente, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.sendStatus(400); return; }

  const { name, phoneNumberId, accessToken, wabaId, displayPhone, userId, isActive, defaultSectorId } = req.body as {
    name?: string;
    phoneNumberId?: string;
    accessToken?: string;
    wabaId?: string;
    displayPhone?: string;
    userId?: string | null;
    isActive?: boolean;
    defaultSectorId?: string | null;
  };

  const updated = await updateChannel(id, { name, phoneNumberId, accessToken, wabaId, displayPhone, userId: userId ?? undefined, isActive, defaultSectorId: defaultSectorId ?? undefined });
  if (!updated) { res.sendStatus(404); return; }
  res.json(updated);
});

router.delete("/channels/:id", requireAdminOrGerente, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.sendStatus(400); return; }
  const channel = await getChannelById(id);
  if (channel?.evolutionInstanceName) {
    await deleteEvolutionInstance(channel.evolutionInstanceName).catch(() => null);
  }
  await deleteChannel(id);
  res.sendStatus(204);
});

export default router;
