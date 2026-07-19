import { Request, Response } from "express";
import { setSectorsForUser, listSectorIdsForUser } from "../../services/whatsapp-sectors.service";
import { setChannelsForUser, listGrantedChannelIdsForUser } from "../../services/whatsapp-channels.service";

/**
 * Controller: PUT /api/users/:id/whatsapp-access
 *
 * Substitui o escopo de acesso de WhatsApp (setores e canais) de um usuário
 * pelas listas informadas — reaproveitado pela UI de edição de usuário
 * ("Escopo de acesso"). Restrito a admin/gerente (ver requireAdminOrGerente
 * em server/middleware/validation.ts, aplicado na rota).
 */
export async function putWhatsappAccessController(
  req: Request,
  res: Response,
): Promise<Response> {
  const { id } = req.params;
  const { sectorIds, channelIds } = req.body as { sectorIds?: unknown; channelIds?: unknown };

  if (!Array.isArray(sectorIds) || !sectorIds.every((s) => typeof s === "string")) {
    return res.status(400).json({ message: "sectorIds deve ser um array de strings" });
  }
  if (!Array.isArray(channelIds) || !channelIds.every((c) => typeof c === "number")) {
    return res.status(400).json({ message: "channelIds deve ser um array de números" });
  }

  await Promise.all([
    setSectorsForUser(id, sectorIds),
    setChannelsForUser(id, channelIds),
  ]);

  const [updatedSectorIds, updatedChannelIds] = await Promise.all([
    listSectorIdsForUser(id),
    listGrantedChannelIdsForUser(id),
  ]);

  return res.status(200).json({ sectorIds: updatedSectorIds, channelIds: updatedChannelIds });
}
