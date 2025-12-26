import { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * Controller para excluir saldo de cashback (Admin only)
 *
 * @route DELETE /api/cashback-balances/:balanceId
 * @access Private (Admin only)
 *
 * @pathParams {string} balanceId - UUID do saldo de cashback
 *
 * @returns {Object} Mensagem de confirmação
 *
 * @description
 * Exclui permanentemente um saldo de cashback.
 * Apenas administradores podem realizar esta operação.
 *
 * @example Success Response (200)
 * {
 *   "message": "Saldo de cashback excluído com sucesso"
 * }
 *
 * @example Error Response (403)
 * {
 *   "message": "Acesso negado. Apenas administradores podem excluir saldos de cashback."
 * }
 *
 * @example Error Response (404)
 * {
 *   "message": "Saldo de cashback não encontrado"
 * }
 */
export const deleteCashbackBalanceController = async (
  req: Request,
  res: Response
) => {
  try {
    // Verificar se o usuário é administrador
    const userEmail = req.headers["x-user-email"] as string;
    const userRole = req.headers["x-user-role"] as string;

    if (
      !userEmail ||
      !userRole ||
      (userRole !== "administrador" && userRole !== "admin")
    ) {
      return res.status(403).json({
        message:
          "Acesso negado. Apenas administradores podem excluir saldos de cashback.",
      });
    }

    const { balanceId } = req.params;
    const deleted = await storage.deleteCashbackBalance(balanceId);

    if (deleted) {
      res.json({ message: "Saldo de cashback excluído com sucesso" });
    } else {
      res.status(404).json({ message: "Saldo de cashback não encontrado" });
    }
  } catch (error) {
    console.error("Erro ao excluir saldo de cashback:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
};
