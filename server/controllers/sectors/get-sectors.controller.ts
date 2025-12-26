import type { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * Controller para buscar todos os setores
 *
 * @route GET /api/sectors
 * @description Retorna todos os setores cadastrados no sistema
 * @access Private (requer autenticação)
 *
 * @returns {Array} Lista de setores
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "sector-id-1",
 *     "name": "Vendas",
 *     "createdAt": "2025-12-25T10:00:00.000Z"
 *   },
 *   {
 *     "id": "sector-id-2",
 *     "name": "Marketing",
 *     "createdAt": "2025-12-25T10:00:00.000Z"
 *   }
 * ]
 *
 * @notes
 * - Retorna todos os setores sem filtros ou paginação
 * - Ordenação padrão do banco de dados
 *
 * @throws {500} Erro ao buscar setores
 */
export const getSectorsController = async (req: Request, res: Response) => {
  try {
    const sectors = await storage.getSectors();
    res.json(sectors);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar setores" });
  }
};
