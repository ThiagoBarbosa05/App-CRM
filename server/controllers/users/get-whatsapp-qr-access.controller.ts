import { Request, Response } from "express";
import { listQrReaderChannelIdsForUser } from "../../services/whatsapp-channels.service";

/**
 * Controller: GET /api/users/:id/whatsapp-qr-access
 *
 * Retorna os canais em que o usuário tem permissão explícita de leitura de
 * QR Code (whatsapp_channel_qr_readers) — usado pela UI de edição de usuário
 * para popular o multi-select "Liberar leitura de QRCode nos canais". Não
 * inclui canais dos quais o usuário é dono (esses já têm acesso implícito).
 */
export async function getWhatsappQrAccessController(
  req: Request,
  res: Response,
): Promise<Response> {
  const { id } = req.params;
  const channelIds = await listQrReaderChannelIdsForUser(id);
  return res.status(200).json({ channelIds });
}
