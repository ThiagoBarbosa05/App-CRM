import { Request, Response } from "express";
import { tagsService } from "../../services/tags.service";

/**
 * Controller para buscar marcadores
 *
 * @route GET /api/tags/markers
 * @returns Lista de tags do tipo "marcador"
 *
 * @example Request
 * GET /api/tags/markers
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "marker-id-1",
 *     "name": "Urgente",
 *     "type": "marcador",
 *     "createdAt": "2023-01-15T10:30:00.000Z"
 *   },
 *   {
 *     "id": "marker-id-2",
 *     "name": "Follow-up",
 *     "type": "marcador",
 *     "createdAt": "2023-01-10T14:20:00.000Z"
 *   }
 * ]
 *
 * @notes
 * - Retorna todos os marcadores do sistema
 * - Ordenadas por data de criação (mais recentes primeiro)
 * - Marcadores são labels adicionais para organizar clientes
 */
export async function getMarkersController(req: Request, res: Response) {
  try {
    const markers = await tagsService.getMarkers();
    return res.json(markers);
  } catch (error) {
    console.error("[getMarkersController] Erro:", error);
    return res.status(500).json({ message: "Erro ao buscar marcadores" });
  }
}
