import { Request, Response } from "express";
import { listSectorsForAllUsers } from "../../services/whatsapp-sectors.service";
import { listGrantedChannelsForAllUsers } from "../../services/whatsapp-channels.service";

/**
 * Controller: GET /api/users/whatsapp-access-summary
 *
 * Retorna, para todos os usuários de uma vez, os setores e canais de
 * WhatsApp vinculados a cada um (nomes já resolvidos) — usado na listagem
 * de atendentes para exibir o escopo de acesso sem precisar de um request
 * por usuário (N+1).
 */
export async function getWhatsappAccessSummaryController(
  _req: Request,
  res: Response,
): Promise<Response> {
  const [sectorsByUser, channelsByUser] = await Promise.all([
    listSectorsForAllUsers(),
    listGrantedChannelsForAllUsers(),
  ]);

  const userIds = new Set([...Object.keys(sectorsByUser), ...Object.keys(channelsByUser)]);

  const result: Record<
    string,
    {
      sectors: { id: string; name: string; color: string }[];
      channels: { id: number; name: string; displayPhone: string | null }[];
    }
  > = {};

  for (const userId of Array.from(userIds)) {
    result[userId] = {
      sectors: sectorsByUser[userId] ?? [],
      channels: channelsByUser[userId] ?? [],
    };
  }

  return res.status(200).json(result);
}
