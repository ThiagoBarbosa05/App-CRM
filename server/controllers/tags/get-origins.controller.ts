import { Request, Response } from "express";
import { tagsService } from "../../services/tags.service";

/**
 * Controller para buscar origens
 *
 * @route GET /api/tags/origins
 * @returns Lista de tags do tipo "origem"
 *
 * @example Request
 * GET /api/tags/origins
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "origin-id-1",
 *     "name": "Facebook",
 *     "type": "origem",
 *     "createdAt": "2023-01-15T10:30:00.000Z"
 *   },
 *   {
 *     "id": "origin-id-2",
 *     "name": "Instagram",
 *     "type": "origem",
 *     "createdAt": "2023-01-10T14:20:00.000Z"
 *   }
 * ]
 *
 * @notes
 * - Retorna todas as origens do sistema
 * - Ordenadas por data de criação (mais recentes primeiro)
 * - Origens indicam de onde o cliente veio (canal de aquisição)
 */
export async function getOriginsController(req: Request, res: Response) {
  try {
    const origins = await tagsService.getOrigins();
    return res.json(origins);
  } catch (error) {
    console.error("[getOriginsController] Erro:", error);
    return res.status(500).json({ message: "Erro ao buscar origens" });
  }
}
