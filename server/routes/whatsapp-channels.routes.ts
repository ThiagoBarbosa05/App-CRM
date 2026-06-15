import { Router, Request, Response } from "express";
import {
  listChannels,
  getChannelById,
  createChannel,
  updateChannel,
  deleteChannel,
} from "../services/whatsapp-channels.service";

const router = Router();

router.get("/channels", async (_req: Request, res: Response) => {
  const channels = await listChannels();
  res.json(channels);
});

router.get("/channels/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) { res.sendStatus(400); return; }
  const channel = await getChannelById(id);
  if (!channel) { res.sendStatus(404); return; }
  res.json(channel);
});

router.post("/channels", async (req: Request, res: Response) => {
  const { name, phoneNumberId, accessToken, wabaId, displayPhone, userId, isActive } = req.body as {
    name: string;
    phoneNumberId: string;
    accessToken: string;
    wabaId: string;
    displayPhone?: string;
    userId?: string;
    isActive?: boolean;
  };

  if (!name || !phoneNumberId || !accessToken || !wabaId) {
    res.status(400).json({ error: "name, phoneNumberId, accessToken e wabaId são obrigatórios" });
    return;
  }

  const channel = await createChannel({ name, phoneNumberId, accessToken, wabaId, displayPhone, userId, isActive });
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
  await deleteChannel(id);
  res.sendStatus(204);
});

export default router;
