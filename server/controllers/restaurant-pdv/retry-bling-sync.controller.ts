import { Request, Response } from "express";

import { retryBlingSalesOrderSync } from "../../services/bling-sales-order.service";

/**
 * Reenvia (ou apenas reconfere) o pedido de venda de uma comanda no Bling.
 *
 * Sem contexto de unidade de propósito: a tela de pendências é cross-unidade e
 * o `:id` já delimita o alvo. Mesmo padrão do cancelamento admin.
 */
export const retryBlingSyncController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await retryBlingSalesOrderSync(id);
    return res.json(result);
  } catch (error: any) {
    if (error?.code === "NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }
    if (error?.code === "ORDER_NOT_CLOSED" || error?.code === "NO_BLING_CONNECTION") {
      return res.status(409).json({ message: error.message });
    }
    console.error(`[Bling] Erro ao reenviar a comanda ${req.params.id}:`, error);
    return res.status(500).json({ message: "Erro ao reenviar o pedido para o Bling" });
  }
};
