import { Request, Response } from "express";
import { tagsService } from "../../services/tags.service";

/**
 * Controller para buscar categorias
 *
 * @route GET /api/tags/categories
 * @returns Lista de tags do tipo "categoria"
 *
 * @example Request
 * GET /api/tags/categories
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "cat-id-1",
 *     "name": "VIP",
 *     "type": "categoria",
 *     "createdAt": "2023-01-15T10:30:00.000Z"
 *   },
 *   {
 *     "id": "cat-id-2",
 *     "name": "Premium",
 *     "type": "categoria",
 *     "createdAt": "2023-01-10T14:20:00.000Z"
 *   }
 * ]
 *
 * @notes
 * - Retorna todas as categorias do sistema
 * - Ordenadas por data de criação (mais recentes primeiro)
 * - Categorias são usadas para classificar clientes
 */
export async function getCategoriesController(req: Request, res: Response) {
  try {
    const categories = await tagsService.getCategories();
    return res.json(categories);
  } catch (error) {
    console.error("[getCategoriesController] Erro:", error);
    return res.status(500).json({ message: "Erro ao buscar categorias" });
  }
}
