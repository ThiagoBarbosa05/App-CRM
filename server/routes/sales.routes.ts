import { Router } from "express";
import {
  getSalesListController,
  getSalesStatisticsController,
  getSalesHistoryController,
  createSaleController,
  deleteSaleController,
} from "../controllers/sales/index";

/**
 * Router para operações de vendas
 */
export const salesRouter = Router();

/**
 * @route GET /api/sales
 * @description Busca todas as vendas do sistema
 * @access Private (requer autenticação)
 * @returns {Array} Lista de vendas
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
 * @notes
 * - Retorna todas as vendas sem filtros
 * - Ordenação padrão por data
 */
salesRouter.get("/sales", getSalesListController);

/**
 * @route GET /api/sales-statistics
 * @description Busca estatísticas de vendas
 * @access Private (requer autenticação)
 * @returns {Object} Estatísticas de vendas
 *
 * @notes
 * - Já migrado anteriormente
 */
salesRouter.get("/sales-statistics", getSalesStatisticsController);

/**
 * @route GET /api/sales-history
 * @description Busca histórico de vendas
 * @access Private (requer autenticação)
 * @returns {Array} Histórico de vendas
 *
 * @notes
 * - Já migrado anteriormente
 */
salesRouter.get("/sales-history", getSalesHistoryController);

/**
 * @route POST /api/sales
 * @description Cria uma nova venda com cálculo automático de cashback
 * @access Private (requer autenticação)
 * @bodyParams {string} clientId - ID do cliente (obrigatório)
 * @bodyParams {string} date - Data da venda (obrigatório)
 * @bodyParams {number} grossValue - Valor bruto da venda (obrigatório)
 * @bodyParams {string} [notes] - Observações da venda
 * @bodyParams {string} [invoiceNumber] - Número da nota fiscal
 * @bodyParams {string} [userId] - ID do usuário que registrou a venda
 * @bodyParams {boolean} [useCashback=true] - Se deve usar cashback disponível
 * @returns {Object} Venda criada com saldo atualizado do cliente
 *
 * @example Request Body
 * {
 *   "clientId": "client-123",
 *   "date": "2025-12-25",
 *   "grossValue": 1000.00,
 *   "notes": "Venda de produtos",
 *   "invoiceNumber": "NF-001",
 *   "userId": "user-456",
 *   "useCashback": true
 * }
 *
 * @example Success Response (201)
 * {
 *   "id": "sale-id",
 *   "clientId": "client-123",
 *   "date": "2025-12-25",
 *   "grossValue": "1000.00",
 *   "cashbackUsed": "50.00",
 *   "netValue": "950.00",
 *   "cashbackGenerated": "95.00",
 *   "clientCurrentBalance": "145.00"
 * }
 *
 * @notes
 * - Calcula automaticamente cashbackUsed (máximo 50% do valor bruto)
 * - Calcula netValue = grossValue - cashbackUsed
 * - Calcula cashbackGenerated baseado na configuração ativa de cashback
 * - Atualiza saldo do cliente automaticamente
 * - Retorna saldo atualizado na resposta
 */
salesRouter.post("/sales", createSaleController);

/**
 * @route DELETE /api/sales/:id
 * @description Exclui uma venda do sistema (admin apenas)
 * @access Private (requer autenticação + admin)
 * @pathParams {string} id - ID da venda a ser excluída
 * @headers {string} x-user-role - Role do usuário (admin ou administrador)
 * @returns {Object} Mensagem de sucesso
 *
 * @example Success Response (200)
 * {
 *   "message": "Venda excluída com sucesso"
 * }
 *
 * @notes
 * - Apenas administradores podem excluir vendas
 * - A exclusão é permanente
 * - Não reverte alterações de saldo de cashback automaticamente
 */
salesRouter.delete("/sales/:id", deleteSaleController);
