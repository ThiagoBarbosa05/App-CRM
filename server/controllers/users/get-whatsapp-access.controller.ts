import { Request, Response } from "express";
import { listSectorIdsForUser } from "../../services/whatsapp-sectors.service";
import { listGrantedChannelIdsForUser } from "../../services/whatsapp-channels.service";

/**
 * Controller: GET /api/users/:id/whatsapp-access
 *
 * Retorna o escopo de acesso de WhatsApp (setores e canais) de um usuário —
 * usado pela UI de edição de usuário para popular os multi-selects "Acesso
 * aos setores" / "Acesso aos canais". channelIds retorna só as concessões
 * explícitas (whatsapp_channel_members), não os canais que o usuário é dono.
 */
export async function getWhatsappAccessController(
  req: Request,
  res: Response,
): Promise<Response> {
  const { id } = req.params;
  const [sectorIds, channelIds] = await Promise.all([
    listSectorIdsForUser(id),
    listGrantedChannelIdsForUser(id),
  ]);
  return res.status(200).json({ sectorIds, channelIds });
}
