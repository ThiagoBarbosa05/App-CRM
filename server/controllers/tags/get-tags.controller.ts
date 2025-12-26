import { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * @route GET /api/tags
 * @description Busca todas as tags do sistema
 * @access Private (apenas usuários autenticados)
 *
 * @returns {Array} 200 - Lista de todas as tags
 * @returns {Object} 500 - Erro interno do servidor
 *
 * @example
 * // Response 200:
 * [
 *   {
 *     "id": "tag-id-1",
 *     "name": "Premium",
 *     "type": "categoria",
 *     "color": "#3B82F6",
 *     "createdAt": "2025-01-15T10:30:00.000Z"
 *   },
 *   {
 *     "id": "tag-id-2",
 *     "name": "Indicação",
 *     "type": "origem",
 *     "color": "#10B981",
 *     "createdAt": "2025-01-15T10:30:00.000Z"
 *   }
 * ]
 */
export const getTagsController = async (req: Request, res: Response) => {
  try {
    const tags = await storage.getTags();
    res.json(tags);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar tags" });
  }
};
