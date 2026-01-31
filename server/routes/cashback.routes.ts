import { Router } from "express";
import {
  calculateCashbackController,
  getCashbackBalancesListController,
  getClientCashbackBalanceController,
  deleteCashbackBalanceController,
  getCashbackUsageListController,
  createCashbackUsageController,
  getClientCashbackUsageController,
  getCashbackTransactionsListController,
  getCashbackReports30DaysController,
} from "../controllers/cashback/index";
import { createCashbackTransaction } from "../controllers/cashback/create-cashback-transaction.controller";

/**
 * Router para operações de cashback (cálculos, transações, consultas)
 * Separado de cashback-settings que gerencia apenas configurações
 */
export const cashbackRouter = Router();

/**
 * @route POST /api/calculate-cashback
 * @description Calcula o valor de cashback para uma compra baseado nas configurações ativas
 * @access Private (requer autenticação)
 * @bodyParams {number} purchaseAmount - Valor bruto da compra (obrigatório)
 * @bodyParams {number} [netAmount] - Valor líquido da compra (opcional, tem prioridade sobre purchaseAmount)
 * @returns {Object} Resultado do cálculo de cashback
 *
 * @example Request Body
 * {
 *   "purchaseAmount": 1000.00,
 *   "netAmount": 950.00
 * }
 *
 * @example Success Response (200) - Com cashback
 * {
 *   "cashbackAmount": 95.00,
 *   "rate": 10,
 *   "setting": {
 *     "id": "setting-id",
 *     "name": "Cashback Padrão",
 *     "percentageRate": "10",
 *     "minimumPurchase": "100",
 *     "maximumCashback": "500",
 *     "isActive": "true"
 *   }
 * }
 *
 * @example Success Response (200) - Sem configuração ativa
 * {
 *   "cashbackAmount": 0,
 *   "rate": 0,
 *   "setting": null
 * }
 *
 * @example Success Response (200) - Abaixo do mínimo
 * {
 *   "cashbackAmount": 0,
 *   "rate": 0,
 *   "setting": { ... }
 * }
 *
 * @example Error Response (400)
 * {
 *   "message": "Valor de compra inválido"
 * }
 *
 * @notes
 * - Usa netAmount se fornecido, senão usa purchaseAmount
 * - Busca apenas configurações com isActive = "true"
 * - Valida valor mínimo de compra (minimumPurchase)
 * - Aplica taxa percentual (percentageRate)
 * - Respeita limite máximo (maximumCashback)
 * - Retorna 0 se não houver configuração ativa
 * - Retorna 0 se valor estiver abaixo do mínimo
 */
cashbackRouter.post("/calculate-cashback", calculateCashbackController);

/**
 * @route GET /api/cashback-balances
 * @description Busca todos os saldos de cashback dos clientes
 * @access Private (requer autenticação)
 * @queryParams {string} [userId] - ID do usuário (opcional, via query ou header x-user-id)
 * @queryParams {string} [userRole] - Papel do usuário (opcional, via query ou header x-user-role)
 * @returns {Array} Lista de saldos de cashback com informações do cliente
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "balance-id",
 *     "clientId": "client-id",
 *     "currentBalance": "150.00",
 *     "totalEarned": "500.00",
 *     "totalUsed": "350.00",
 *     "client": {
 *       "id": "client-id",
 *       "name": "João Silva",
 *       "phone": "(11) 98765-4321"
 *     }
 *   }
 * ]
 *
 * @notes
 * - Filtra por usuário se role não for admin/administrador
 * - Retorna lista vazia se não houver saldos
 */
cashbackRouter.get("/cashback-balances", getCashbackBalancesListController);

/**
 * @route GET /api/cashback-balances/:clientId
 * @description Busca saldo de cashback de um cliente específico
 * @access Private (requer autenticação)
 * @pathParams {string} clientId - UUID do cliente
 * @returns {Object} Saldo de cashback do cliente
 *
 * @example Success Response (200)
 * {
 *   "id": "balance-id",
 *   "clientId": "client-id",
 *   "currentBalance": "150.00",
 *   "totalEarned": "500.00",
 *   "totalUsed": "350.00",
 *   "updatedAt": "2025-12-25T10:30:00.000Z"
 * }
 *
 * @notes
 * - Se não existir registro, cria um novo com saldo zero
 * - Sempre retorna um objeto de saldo
 */
cashbackRouter.get(
  "/cashback-balances/:clientId",
  getClientCashbackBalanceController
);

/**
 * @route DELETE /api/cashback-balances/:balanceId
 * @description Exclui saldo de cashback (Admin only)
 * @access Private (Admin only)
 * @pathParams {string} balanceId - UUID do saldo de cashback
 * @returns {Object} Mensagem de confirmação
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
 *
 * @notes
 * - Apenas usuários com role "admin" ou "administrador" podem executar
 * - Verifica headers x-user-email e x-user-role
 */
cashbackRouter.delete(
  "/cashback-balances/:balanceId",
  deleteCashbackBalanceController
);

/**
 * @route GET /api/cashback-usage
 * @description Busca histórico de uso de cashback
 * @access Private (requer autenticação)
 * @queryParams {string} [userId] - ID do usuário (opcional, via query ou header x-user-id)
 * @queryParams {string} [userRole] - Papel do usuário (opcional, via query ou header x-user-role)
 * @returns {Array} Lista de usos de cashback
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "usage-id",
 *     "clientId": "client-id",
 *     "amountUsed": "50.00",
 *     "saleId": "sale-id",
 *     "usedAt": "2025-12-25T10:00:00.000Z"
 *   }
 * ]
 *
 * @notes
 * - Filtra por usuário se role não for admin/administrador
 * - Retorna lista vazia se não houver usos registrados
 */
cashbackRouter.get("/cashback-usage", getCashbackUsageListController);

/**
 * @route POST /api/cashback-usage
 * @description Cria registro de uso de cashback
 * @access Private (requer autenticação)
 * @bodyParams {string} clientId - UUID do cliente (obrigatório)
 * @bodyParams {string} amountUsed - Valor utilizado (obrigatório)
 * @bodyParams {string} [saleId] - UUID da venda (opcional)
 * @returns {Object} Registro de uso criado
 *
 * @example Request Body
 * {
 *   "clientId": "client-id",
 *   "amountUsed": "50.00",
 *   "saleId": "sale-id"
 * }
 *
 * @example Success Response (201)
 * {
 *   "id": "usage-id",
 *   "clientId": "client-id",
 *   "amountUsed": "50.00",
 *   "saleId": "sale-id",
 *   "usedAt": "2025-12-25T10:00:00.000Z"
 * }
 *
 * @notes
 * - Atualiza automaticamente o saldo do cliente
 * - Deduz o valor usado do saldo disponível
 */
cashbackRouter.post("/cashback-usage", createCashbackUsageController);

/**
 * @route GET /api/cashback-usage/:clientId
 * @description Busca histórico de uso de cashback de um cliente
 * @access Private (requer autenticação)
 * @pathParams {string} clientId - UUID do cliente
 * @returns {Array} Lista de usos do cliente
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "usage-id",
 *     "clientId": "client-id",
 *     "amountUsed": "50.00",
 *     "saleId": "sale-id",
 *     "usedAt": "2025-12-25T10:00:00.000Z"
 *   }
 * ]
 *
 * @notes
 * - Retorna lista vazia se cliente não tiver usado cashback
 * - Ordenado por data de uso (mais recente primeiro)
 */
cashbackRouter.get(
  "/cashback-usage/:clientId",
  getClientCashbackUsageController
);

/**
 * @route GET /api/cashback-transactions
 * @description Busca transações de cashback
 * @access Private (requer autenticação)
 * @queryParams {string} [userId] - ID do usuário (opcional, via query ou header x-user-id)
 * @queryParams {string} [userRole] - Papel do usuário (opcional, via query ou header x-user-role)
 * @returns {Array} Lista de transações com informações do cliente
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "transaction-id",
 *     "clientId": "client-id",
 *     "amount": "50.00",
 *     "type": "earned",
 *     "status": "approved",
 *     "settingId": "setting-id",
 *     "expiresAt": "2026-01-22T23:59:59.000Z",
 *     "createdAt": "2025-12-25T10:00:00.000Z",
 *     "client": {
 *       "id": "client-id",
 *       "name": "João Silva",
 *       "phone": "(11) 98765-4321"
 *     }
 *   }
 * ]
 *
 * @notes
 * - Filtra por usuário se role não for admin/administrador
 * - Inclui informações do cliente e configuração aplicada
 */
cashbackRouter.get(
  "/cashback-transactions",
  getCashbackTransactionsListController
);

/**
 * @route POST /api/cashback-transactions
 * @description Cria uma nova transação de cashback (para registro de vendas)
 * @access Private (requer autenticação)
 * @bodyParams {string} clientId - UUID do cliente (obrigatório)
 * @bodyParams {string} purchaseAmount - Valor da compra (obrigatório)
 * @bodyParams {string} cashbackAmount - Valor do cashback (obrigatório)
 * @bodyParams {string} cashbackRate - Taxa de cashback aplicada (obrigatório)
 * @bodyParams {string} status - Status da transação ("pending" | "approved" | "expired")
 * @bodyParams {string} [settingId] - UUID da configuração de cashback
 * @bodyParams {string} [notes] - Observações
 * @bodyParams {string} [invoiceNumber] - Número da nota fiscal
 * @bodyParams {string} [saleDate] - Data da venda
 * @bodyParams {string} [processedBy] - UUID do usuário que processou
 * @returns {Object} Transação criada
 *
 * @notes
 * - Calcula automaticamente a data de expiração baseada na configuração
 * - Atualiza automaticamente o saldo do cliente
 */
cashbackRouter.post("/cashback-transactions", createCashbackTransaction);

/**
 * @route GET /api/cashback-reports/30-days
 * @description Retorna relatórios agregados de cashback dos últimos 30 dias
 * @access Private (requer autenticação)
 * @returns {Object} Estatísticas de cashback dos últimos 30 dias
 *
 * @example Success Response (200)
 * {
 *   "totalSales": 15000.00,
 *   "totalCashbackGenerated": 1500.00,
 *   "totalCashbackUsed": 500.00,
 *   "totalCashbackRedeemed": 300.00,
 *   "salesCount": 45,
 *   "period": "30 days"
 * }
 *
 * @notes
 * - Calcula estatísticas baseadas nos últimos 30 dias
 * - totalSales: soma do valor bruto de todas as vendas
 * - totalCashbackGenerated: cashback gerado nas vendas
 * - totalCashbackUsed: cashback usado nas vendas
 * - totalCashbackRedeemed: cashback resgatado pelos clientes
 * - salesCount: número total de vendas no período
 */
cashbackRouter.get(
  "/cashback-reports/30-days",
  getCashbackReports30DaysController
);
