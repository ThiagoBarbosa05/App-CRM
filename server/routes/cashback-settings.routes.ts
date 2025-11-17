import { Router } from "express";

import {
  getCashbackStatisticsController,
  getExpiringCashbacks,
  getCashbackBalancesController,
  getCashbackTransactionsController,
} from "../controllers/cashback/index";
import { getCashbackUsageController } from "../controllers/cashback/get-cashback-usage.controller";
import { getCashbackSettingsController } from "server/controllers/cashback/get-cashback-settings.controller";
import { createCashbackSettingsController } from "server/controllers/cashback/create-cashback-settings.controller";
import { updateCashbackSettingsController } from "server/controllers/cashback/update-cashback-settings.controller";
import { deleteCashbackSettingsController } from "server/controllers/cashback/delete-cashback-settings.controller";

/**
 * Router específico para endpoints relacionados a configurações de cashback
 * Segue padrão RESTful e organiza todas as rotas de cashback settings
 */
export const cashbackSettingsRouter = Router();

/**
 * @route GET /api/cashback-settings/statistics
 * @description Busca estatísticas gerais do sistema de cashback
 * @access Private (requer autenticação)
 * @returns {Object} Estatísticas calculadas
 *
 * @example Request
 * GET /api/cashback-settings/statistics
 *
 * @example Success Response (200)
 * {
 *   "totalCashback": 15000.50,
 *   "activeClients": 42,
 *   "averageRate": 12.5,
 *   "totalClients": 100,
 *   "totalTransactions": 250,
 *   "totalSettings": 5
 * }
 *
 * @notes
 * - totalCashback: soma de todas transações aprovadas
 * - activeClients: clientes com saldo disponível > 0
 * - averageRate: média das taxas de configurações ativas
 * - totalClients: total de clientes que já receberam cashback
 * - totalTransactions: total de transações registradas
 * - totalSettings: total de configurações cadastradas
 * - Útil para dashboards e visão geral do sistema
 */
cashbackSettingsRouter.get("/statistics", getCashbackStatisticsController);

/**
 * @route GET /api/cashback-settings/expiring
 * @description Busca cashbacks que estão próximos de expirar (próximos 7 dias)
 * @access Private (requer autenticação)
 * @queryParams {string} [search] - Termo de busca (nome cliente/vendedor, telefone, CPF)
 * @queryParams {string} [sortBy=expiresAt] - Campo para ordenação (amount, expiresAt, clientName, sellerName)
 * @queryParams {string} [sortOrder=asc] - Direção (asc, desc)
 * @queryParams {number} [limit=50] - Limite de registros (máximo 100)
 * @queryParams {number} [offset=0] - Offset para paginação
 * @returns {Object} Lista de cashbacks expirando com estatísticas
 *
 * @example Request
 * GET /api/cashback-settings/expiring?search=João&sortBy=expiresAt&limit=20
 *
 * @example Success Response (200)
 * {
 *   "success": true,
 *   "data": [{
 *     "id": "cashback-id",
 *     "cashbackAmount": 50.00,
 *     "expiresAt": "2023-12-31T23:59:59.999Z",
 *     "daysUntilExpiry": 5,
 *     "client": { "id": "client-id", "name": "João Silva" },
 *     "seller": { "id": "seller-id", "name": "Maria Santos" }
 *   }],
 *   "statistics": {
 *     "totalRecords": 15,
 *     "totalAmount": 750.00,
 *     "averageAmount": 50.00,
 *     "daysRange": 7
 *   },
 *   "pagination": { "total": 15, "limit": 20, "offset": 0, "hasMore": false }
 * }
 *
 * @notes
 * - Apenas cashbacks com status "approved"
 * - Filtra por expiração entre hoje e 7 dias
 * - daysUntilExpiry calculado automaticamente
 * - Útil para alertas de expiração
 */
cashbackSettingsRouter.get("/expiring", getExpiringCashbacks);

/**
 * @route GET /api/cashback-settings/balances
 * @description Busca saldos de cashback dos clientes com filtros avançados
 * @access Private (requer autenticação)
 * @queryParams {string} [search] - Busca por nome, CPF, telefone, email ou vendedor
 * @queryParams {string} [userId] - Filtrar por vendedor responsável (use "all" para todos)
 * @queryParams {string} [minBalance] - Saldo mínimo
 * @queryParams {string} [maxBalance] - Saldo máximo
 * @queryParams {string} [sortBy=currentBalance] - Campo para ordenação (clientName, currentBalance, totalEarned, totalUsed, sellerName, lastUpdated)
 * @queryParams {string} [sortOrder=desc] - Direção (asc, desc)
 * @queryParams {number} [page=1] - Página atual
 * @queryParams {number} [limit=20] - Registros por página (máximo 100)
 * @returns {Object} Saldos com paginação e estatísticas
 *
 * @example Request
 * GET /api/cashback-settings/balances?search=João&sortBy=currentBalance&sortOrder=desc&page=1&limit=20
 *
 * @example Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "balances": [{
 *       "id": "balance-id",
 *       "clientId": "client-id",
 *       "clientName": "João Silva",
 *       "clientCpf": "123.456.789-00",
 *       "clientPhone": "(11) 98765-4321",
 *       "clientEmail": "joao@example.com",
 *       "currentBalance": "150.50",
 *       "totalEarned": "500.00",
 *       "totalUsed": "349.50",
 *       "lastUpdated": "2023-12-15T10:30:00.000Z",
 *       "sellerId": "seller-id",
 *       "sellerName": "Maria Santos",
 *       "sellerEmail": "maria@example.com"
 *     }],
 *     "pagination": {
 *       "currentPage": 1,
 *       "totalPages": 5,
 *       "totalItems": 95,
 *       "itemsPerPage": 20
 *     },
 *     "statistics": {
 *       "totalClients": 95,
 *       "totalCurrentBalance": "14250.75",
 *       "totalEarnedEver": "47500.00",
 *       "totalUsedEver": "33249.25",
 *       "averageBalance": "150.01"
 *     }
 *   }
 * }
 *
 * @notes
 * - Busca case-insensitive em múltiplos campos
 * - Filtros combinados com AND lógico
 * - Estatísticas calculadas com mesmos filtros aplicados
 * - Paginação automática
 * - Clientes sem responsável exibem "Sem responsável"
 * - Útil para gestão de saldos e relatórios
 */
cashbackSettingsRouter.get("/balances", getCashbackBalancesController);

/**
 * @route GET /api/cashback-settings/transactions
 * @description Busca transações de cashback com filtros avançados
 * @access Private (requer autenticação)
 * @queryParams {string} [search] - Busca por nome, CPF, telefone, email ou número da nota
 * @queryParams {string} [status=all] - Filtrar por status (pending, approved, paid, cancelled, all)
 * @queryParams {string} [userId] - Filtrar por vendedor responsável (use "all" para todos)
 * @queryParams {string} [startDate] - Data inicial de venda (formato ISO)
 * @queryParams {string} [endDate] - Data final de venda (formato ISO)
 * @queryParams {string} [minAmount] - Valor mínimo de cashback
 * @queryParams {string} [maxAmount] - Valor máximo de cashback
 * @queryParams {string} [sortBy=createdAt] - Campo para ordenação (clientName, cashbackAmount, purchaseAmount, cashbackRate, saleDate, status, createdAt)
 * @queryParams {string} [sortOrder=desc] - Direção (asc, desc)
 * @queryParams {number} [page=1] - Página atual
 * @queryParams {number} [limit=20] - Registros por página (máximo 100)
 * @returns {Object} Transações com paginação e estatísticas
 *
 * @example Request
 * GET /api/cashback-settings/transactions?search=João&status=approved&sortBy=createdAt&sortOrder=desc&page=1&limit=20
 *
 * @example Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "transactions": [{
 *       "id": "transaction-id",
 *       "clientName": "João Silva",
 *       "clientPhone": "(11) 98765-4321",
 *       "clientCpf": "123.456.789-00",
 *       "purchaseAmount": "500.00",
 *       "cashbackAmount": "50.00",
 *       "cashbackRate": "10.00",
 *       "status": "approved",
 *       "saleDate": "2023-12-01T10:00:00.000Z",
 *       "expiresAt": "2024-03-01T23:59:59.999Z",
 *       "invoiceNumber": "NF-12345",
 *       "processedBy": { "id": "user-id", "name": "Admin", "email": "admin@example.com" },
 *       "responsibleUser": { "id": "seller-id", "name": "Maria Santos", "email": "maria@example.com" },
 *       "createdAt": "2023-12-01T10:00:00.000Z"
 *     }],
 *     "pagination": {
 *       "page": 1,
 *       "limit": 20,
 *       "totalItems": 150,
 *       "totalPages": 8,
 *       "hasNext": true,
 *       "hasPrevious": false
 *     },
 *     "statistics": {
 *       "totalTransactions": 150,
 *       "totalPurchaseAmount": "75000.00",
 *       "totalCashbackAmount": "7500.00",
 *       "avgCashbackRate": "10.00",
 *       "statusCounts": { "pending": 10, "approved": 120, "paid": 15, "cancelled": 5 }
 *     }
 *   }
 * }
 *
 * @notes
 * - Busca case-insensitive em múltiplos campos
 * - Filtros de data consideram horário completo
 * - Estatísticas calculadas com mesmos filtros aplicados
 * - Inclui informações de vendedor responsável e usuário que processou
 * - Útil para relatórios e auditoria de cashback
 */
cashbackSettingsRouter.get("/transactions", getCashbackTransactionsController);

/**
 * @route GET /api/cashback-settings/usage
 * @description Busca lista de resgates de cashback com filtros avançados e estatísticas
 * @access Private
 *
 * @queryparam {string} [search] - Busca por nome, CPF, telefone, email do cliente ou descrição do resgate
 * @queryparam {string} [userId] - Filtra por usuário responsável pelo cliente (use "all" para todos)
 * @queryparam {string} [authorizedById] - Filtra por usuário que autorizou o resgate (use "all" para todos)
 * @queryparam {string} [startDate] - Data inicial de criação (formato ISO)
 * @queryparam {string} [endDate] - Data final de criação (formato ISO)
 * @queryparam {string} [minAmount] - Valor mínimo usado no resgate
 * @queryparam {string} [maxAmount] - Valor máximo usado no resgate
 * @queryparam {string} [sortBy=createdAt] - Campo para ordenação (clientName, usedAmount, authorizedBy, description, createdAt)
 * @queryparam {string} [sortOrder=desc] - Direção da ordenação (asc, desc)
 * @queryparam {number} [page=1] - Número da página
 * @queryparam {number} [limit=20] - Quantidade de itens por página (máximo 100)
 *
 * @example Request
 * GET /api/cashback-settings/usage?search=João&userId=123&startDate=2024-01-01&sortBy=usedAmount&sortOrder=desc&page=1&limit=20
 *
 * @example Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "usages": [
 *       {
 *         "id": "usage-id-1",
 *         "clientName": "João Silva",
 *         "clientPhone": "11987654321",
 *         "clientCpf": "12345678900",
 *         "clientEmail": "joao@email.com",
 *         "usedAmount": "50.00",
 *         "description": "Resgate em loja",
 *         "authorizedBy": {
 *           "id": "user-id-1",
 *           "name": "Maria Admin",
 *           "email": "maria@empresa.com"
 *         },
 *         "responsibleUser": {
 *           "id": "user-id-2",
 *           "name": "Pedro Vendedor",
 *           "email": "pedro@empresa.com"
 *         },
 *         "createdAt": "2024-01-15T10:30:00.000Z"
 *       }
 *     ],
 *     "pagination": {
 *       "page": 1,
 *       "limit": 20,
 *       "totalItems": 100,
 *       "totalPages": 5,
 *       "hasNext": true,
 *       "hasPrevious": false
 *     },
 *     "statistics": {
 *       "totalUsages": 100,
 *       "totalUsedAmount": "5000.00",
 *       "avgUsageAmount": "50.00",
 *       "uniqueClients": 75,
 *       "usagesByAuthorizer": {
 *         "user-id-1": {
 *           "name": "Maria Admin",
 *           "count": 60,
 *           "totalAmount": "3000.00"
 *         }
 *       }
 *     }
 *   }
 * }
 *
 * @implementation_notes
 * - A busca textual é case-insensitive e pesquisa em 5 campos simultaneamente
 * - Filtro por data ajusta endDate para 23:59:59 do dia especificado
 * - Ordenação por authorizedBy usa o nome do autorizador
 * - Estatísticas incluem quebra por autorizador mostrando contagem e total por cada um
 * - Suporta filtro "all" para userId e authorizedById para incluir todos os usuários
 */
cashbackSettingsRouter.get("/usage", getCashbackUsageController);

// ============================================================================
// CRUD ROUTES
// ============================================================================

/**
 * @route GET /api/cashback-settings
 * @description Busca todas as configurações de cashback do sistema
 * @access Private (requer autenticação)
 * @returns {Array} Lista de configurações de cashback
 *
 * @example Request
 * GET /api/cashback-settings
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "setting-id-1",
 *     "name": "Cashback Padrão",
 *     "percentage": "10",
 *     "expirationDays": 90,
 *     "createdAt": "2023-01-01T00:00:00.000Z",
 *     "updatedAt": "2023-01-01T00:00:00.000Z"
 *   },
 *   {
 *     "id": "setting-id-2",
 *     "name": "Cashback Premium",
 *     "percentage": "15",
 *     "expirationDays": 120,
 *     "createdAt": "2023-01-02T00:00:00.000Z",
 *     "updatedAt": "2023-01-02T00:00:00.000Z"
 *   }
 * ]
 *
 * @notes
 * - Retorna todas as configurações (ativas e inativas)
 * - Ordenadas por data de criação
 * - Útil para popular dropdowns de seleção
 * - percentage é armazenado como string
 */
cashbackSettingsRouter.get("/", getCashbackSettingsController);

/**
 * @route POST /api/cashback-settings
 * @description Cria uma nova configuração de cashback
 * @access Private (requer autenticação)
 * @bodyParams {Object} setting - Dados da configuração
 * @bodyParams {string} setting.name - Nome da configuração (obrigatório)
 * @bodyParams {string} setting.percentage - Percentual de cashback (obrigatório)
 * @bodyParams {number} [setting.expirationDays] - Dias para expiração do cashback
 * @returns {Object} Configuração criada
 *
 * @example Request
 * POST /api/cashback-settings
 * Body: {
 *   "name": "Cashback Black Friday",
 *   "percentage": "20",
 *   "expirationDays": 60
 * }
 *
 * @example Success Response (201)
 * {
 *   "id": "setting-id",
 *   "name": "Cashback Black Friday",
 *   "percentage": "20",
 *   "expirationDays": 60,
 *   "createdAt": "2023-01-15T10:00:00.000Z",
 *   "updatedAt": "2023-01-15T10:00:00.000Z"
 * }
 *
 * @notes
 * - Validação via Zod schema
 * - percentage deve ser string representando número
 * - expirationDays é opcional
 */
cashbackSettingsRouter.post("/", createCashbackSettingsController);

/**
 * @route PUT /api/cashback-settings/:id
 * @description Atualiza uma configuração de cashback existente
 * @access Private (requer autenticação)
 * @pathParams {string} id - UUID da configuração (obrigatório)
 * @bodyParams {Object} setting - Dados parciais para atualização
 * @bodyParams {string} [setting.name] - Nome da configuração
 * @bodyParams {string} [setting.percentage] - Percentual de cashback
 * @bodyParams {number} [setting.expirationDays] - Dias para expiração
 * @returns {Object} Configuração atualizada
 *
 * @example Request
 * PUT /api/cashback-settings/setting-id
 * Body: {
 *   "percentage": "25",
 *   "expirationDays": 90
 * }
 *
 * @example Success Response (200)
 * {
 *   "id": "setting-id",
 *   "name": "Cashback Black Friday",
 *   "percentage": "25",
 *   "expirationDays": 90,
 *   "createdAt": "2023-01-15T10:00:00.000Z",
 *   "updatedAt": "2023-01-16T14:30:00.000Z"
 * }
 *
 * @example Error Response (404)
 * {
 *   "message": "Configuração não encontrada"
 * }
 *
 * @notes
 * - Atualização parcial permitida
 * - updatedAt atualizado automaticamente
 * - Retorna 404 se configuração não existe
 */
cashbackSettingsRouter.put("/:id", updateCashbackSettingsController);

/**
 * @route DELETE /api/cashback-settings/:id
 * @description Exclui uma configuração de cashback
 * @access Private (requer autenticação)
 * @pathParams {string} id - UUID da configuração (obrigatório)
 * @returns {Object} Mensagem de confirmação
 *
 * @example Request
 * DELETE /api/cashback-settings/setting-id
 *
 * @example Success Response (200)
 * {
 *   "message": "Configuração excluída com sucesso"
 * }
 *
 * @example Error Response (404)
 * {
 *   "message": "Configuração não encontrada"
 * }
 *
 * @notes
 * - Exclusão permanente
 * - Retorna 404 se configuração não existe
 * - Validação de UUID no parâmetro
 */
cashbackSettingsRouter.delete("/:id", deleteCashbackSettingsController);

export default cashbackSettingsRouter;
