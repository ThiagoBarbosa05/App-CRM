import { Router, Request, Response } from "express";
import {
  listChannels,
  listActiveChannels,
  listChannelsByUserId,
  getChannelById,
  createChannel,
  updateChannel,
  deleteChannel,
  updateConnectionStatus,
} from "../services/whatsapp-channels.service";
import {
  listWabaPhoneNumbers,
  getPhoneNumberDetails,
  requestVerificationCode,
  verifyPhoneNumber,
} from "../integrations/whatsapp";
import {
  connectInstance,
  getInstanceStatus,
  logoutInstance,
  deleteInstance as deleteEvolutionInstance,
} from "../integrations/evolution";
import { getWhatsappSettingsRaw } from "../services/whatsapp-settings.service";

const router = Router();

router.get("/channels", async (_req: Request, res: Response) => {
  const channels = await listChannels();
  res.json(channels);
});

// Deve ficar antes de /channels/:id para não ser capturado como id
router.get("/channels/mine", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

    if (user.role === "vendedor") {
      const channels = await listChannelsByUserId(user.userId);
      return res.json(channels);
    }
    res.json(await listActiveChannels());
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao buscar canais";
    res.status(500).json({ message });
  }
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

router.get("/channels/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.sendStatus(400); return; }
  const channel = await getChannelById(id);
  if (!channel) { res.sendStatus(404); return; }
  res.json(channel);
});

router.get("/channels/:id/status", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.sendStatus(400); return; }
    const channel = await getChannelById(id);
    if (!channel) { res.sendStatus(404); return; }

    if (channel.provider === "evolution") {
      if (!channel.evolutionInstanceName) {
        res.status(400).json({ message: "Canal Evolution sem instância configurada" });
        return;
      }
      const status = await getInstanceStatus(channel.evolutionInstanceName);
      res.json({ provider: "evolution", connectionStatus: channel.connectionStatus, instanceState: status.state });
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

// ── Rotas exclusivas de canais Evolution ──────────────────────────────────────

router.post("/channels/evolution", async (req: Request, res: Response) => {
  try {
    const { name, userId, displayPhone } = req.body as {
      name: string;
      userId?: string;
      displayPhone?: string;
    };
    if (!name) { res.status(400).json({ error: "name é obrigatório" }); return; }

    // instanceName único baseado no nome (slug)
    const instanceName = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50);

    const channel = await createChannel({
      name,
      provider: "evolution",
      evolutionInstanceName: instanceName,
      connectionStatus: "disconnected",
      displayPhone,
      userId,
      isActive: true,
    });
    res.status(201).json(channel);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao criar canal Evolution";
    res.status(500).json({ message });
  }
});

router.get("/channels/:id/evolution/connect", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.sendStatus(400); return; }
    const channel = await getChannelById(id);
    if (!channel?.evolutionInstanceName) { res.sendStatus(404); return; }

    const qrData = await connectInstance(channel.evolutionInstanceName);
    await updateConnectionStatus(id, "connecting");
    res.json(qrData);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao gerar QR Code";
    res.status(500).json({ message });
  }
});

router.post("/channels/:id/evolution/logout", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) { res.sendStatus(400); return; }
    const channel = await getChannelById(id);
    if (!channel?.evolutionInstanceName) { res.sendStatus(404); return; }

    await logoutInstance(channel.evolutionInstanceName);
    await updateConnectionStatus(id, "disconnected");
    res.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao desconectar canal";
    res.status(500).json({ message });
  }
});

router.post("/channels/:id/request-code", async (req: Request, res: Response) => {
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

router.post("/channels/:id/verify-code", async (req: Request, res: Response) => {
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

router.post("/channels", async (req: Request, res: Response) => {
  const { name, phoneNumberId, accessToken, wabaId, displayPhone, userId, isActive } = req.body as {
    name: string;
    phoneNumberId: string;
    accessToken?: string;
    wabaId?: string;
    displayPhone?: string;
    userId?: string;
    isActive?: boolean;
  };

  if (!name || !phoneNumberId) {
    res.status(400).json({ error: "name e phoneNumberId são obrigatórios" });
    return;
  }

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
  });
  res.status(201).json(channel);
});

router.patch("/channels/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.sendStatus(400); return; }

  const { name, phoneNumberId, accessToken, wabaId, displayPhone, userId, isActive } = req.body as {
    name?: string;
    phoneNumberId?: string;
    accessToken?: string;
    wabaId?: string;
    displayPhone?: string;
    userId?: string | null;
    isActive?: boolean;
  };

  const updated = await updateChannel(id, { name, phoneNumberId, accessToken, wabaId, displayPhone, userId: userId ?? undefined, isActive });
  if (!updated) { res.sendStatus(404); return; }
  res.json(updated);
});

router.delete("/channels/:id", async (req: Request, res: Response) => {
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
