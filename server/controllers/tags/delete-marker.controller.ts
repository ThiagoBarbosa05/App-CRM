import { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * @route DELETE /api/markers/:id
 * @description Exclui um marcador existente
 * @access Private (requer autenticação)
 * @param {string} id - ID do marcador a ser excluído
 * @returns {Object} Confirmação de exclusão
 *
 * @example Request
 * DELETE /api/markers/mark-123
 *
 * @example Success Response (200)
 * {
 *   "success": true
 * }
 *
 * @example Error Response (500)
 * {
 *   "message": "Erro ao excluir marcador"
 * }
 *
 * @notes
 * - Remove permanentemente o marcador do banco de dados
 * - Utiliza o método storage.deleteTag para a exclusão
 * - Retorna erro genérico em caso de falha
 */
export const deleteMarkerController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await storage.deleteTag(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Erro ao excluir marcador" });
  }
};
