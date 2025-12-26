import { Request, Response } from "express";
import { storage } from "../../storage";

/**
 * Controller para buscar todas as vendas
 *
 * @route GET /api/sales
 * @access Private
 *
 * @returns {Array} Lista de todas as vendas
 *
 * @description
 * Retorna lista completa de vendas do sistema.
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "sale-id",
 *     "clientId": "client-id",
 *     "date": "2025-12-25",
 *     "grossValue": "1000.00",
 *     "cashbackUsed": "50.00",
 *     "netValue": "950.00",
 *     "cashbackGenerated": "95.00",
 *     "userId": "user-id"
 *   }
 * ]
 *
 * @example Error Response (500)
 * {
 *   "message": "Erro ao buscar vendas"
 * }
 */
export const getSalesListController = async (req: Request, res: Response) => {
  try {
    const sales = await storage.getSales();
    res.json(sales);
  } catch (error) {
    console.error("Erro ao buscar vendas:", error);
    res.status(500).json({ message: "Erro ao buscar vendas" });
  }
};
