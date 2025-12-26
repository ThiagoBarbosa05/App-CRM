import { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * @route DELETE /api/categories/:id
 * @description Exclui uma categoria existente
 * @access Private (requer autenticação)
 * @param {string} id - ID da categoria a ser excluída
 * @returns {Object} Confirmação de exclusão
 *
 * @example Request
 * DELETE /api/categories/cat-123
 *
 * @example Success Response (200)
 * {
 *   "success": true
 * }
 *
 * @example Error Response (500)
 * {
 *   "message": "Erro ao excluir categoria"
 * }
 *
 * @notes
 * - Remove permanentemente a categoria do banco de dados
 * - Utiliza o método storage.deleteTag para a exclusão
 * - Retorna erro genérico em caso de falha
 */
export const deleteCategoryController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await storage.deleteTag(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Erro ao excluir categoria" });
  }
};
