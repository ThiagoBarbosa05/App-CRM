import type { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * Controller para excluir uma venda
 *
 * @route DELETE /api/sales/:id
 * @description Exclui uma venda do sistema. Operação restrita a administradores.
 * @access Private (requer autenticação + admin)
 *
 * @pathParams {string} id - ID da venda a ser excluída (obrigatório)
 * @headers {string} x-user-role - Role do usuário (admin ou administrador)
 *
 * @returns {Object} Mensagem de sucesso
 *
 * @example Success Response (200)
 * {
 *   "message": "Venda excluída com sucesso"
 * }
 *
 * @notes
 * - Apenas usuários com role "admin" ou "administrador" podem excluir vendas
 * - A exclusão remove permanentemente a venda do banco de dados
 * - Não reverte alterações de saldo de cashback (deve ser tratado manualmente)
 *
 * @throws {403} Acesso negado - usuário não é administrador
 * @throws {404} Venda não encontrada
 * @throws {500} Erro ao excluir venda
 */
export const deleteSaleController = async (req: Request, res: Response) => {
  try {
    // Verificar se o usuário é administrador
    const userRole = req.headers["x-user-role"] as string;

    if (userRole !== "admin" && userRole !== "administrador") {
      return res.status(403).json({
        message: "Acesso negado. Apenas administradores podem excluir vendas.",
      });
    }

    const { id } = req.params;
    const success = await storage.deleteSale(id);

    if (!success) {
      return res.status(404).json({ message: "Venda não encontrada" });
    }

    res.json({ message: "Venda excluída com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir venda:", error);
    res.status(500).json({ message: "Erro ao excluir venda" });
  }
};
