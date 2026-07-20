import { Request, Response } from "express";
import {
  setQrReaderChannelsForUser,
  listQrReaderChannelIdsForUser,
} from "../../services/whatsapp-channels.service";

/**
 * Controller: PUT /api/users/:id/whatsapp-qr-access
 *
 * Substitui a lista de canais em que o usuário tem permissão explícita de
 * leitura de QR Code (whatsapp_channel_qr_readers) — reaproveitado pela UI
 * de edição de usuário ("Liberar leitura de QRCode nos canais"). Restrito a
 * admin/gerente (ver requireAdminOrGerente em server/middleware/validation.ts,
 * aplicado na rota).
 */
export async function putWhatsappQrAccessController(
  req: Request,
  res: Response,
): Promise<Response> {
  const { id } = req.params;
  const { channelIds } = req.body as { channelIds?: unknown };

  if (!Array.isArray(channelIds) || !channelIds.every((c) => typeof c === "number")) {
    return res.status(400).json({ message: "channelIds deve ser um array de números" });
  }

  await setQrReaderChannelsForUser(id, channelIds);
  const updatedChannelIds = await listQrReaderChannelIdsForUser(id);

  return res.status(200).json({ channelIds: updatedChannelIds });
}
