import { Router } from "express";

import {
  getCashbackStatisticsController,
  getExpiringCashbacks,
  getCashbackBalancesController,
  getCashbackTransactionsController,
} from "../controllers/cashback/index";
import { getCashbackUsageController } from "../controllers/cashback/get-cashback-usage.controller";
import { getCashbackReports } from "../controllers/cashback/get-cashback-reports.controller";
import { getCashbackPerformance } from "../controllers/cashback/get-cashback-performance.controller";
import { getCashbackTransactionsSimple } from "../controllers/cashback/get-cashback-transactions-simple.controller";
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

/**
 * @route GET /api/cashback-settings/performance
 *
 * @description
 * Busca métricas detalhadas de performance do sistema de cashback com análises
 * de conversão, tendências por período, engajamento de clientes e efetividade
 * de configurações.
 *
 * @queryparam {string} [startDate] - Data inicial para análise (ISO string, padrão: 30 dias atrás)
 * @queryparam {string} [endDate] - Data final para análise (ISO string, padrão: hoje)
 * @queryparam {string} [sellerId] - ID do vendedor para filtrar métricas
 * @queryparam {string} [periodType=monthly] - Tipo de período para agrupamento (daily, weekly, monthly)
 * @queryparam {boolean} [compareWithPrevious=false] - Se deve comparar com período anterior equivalente
 *
 * @returns {Object} Resposta com métricas de performance:
 * ```json
 * {
 *   "success": true,
 *   "data": {
 *     "metrics": {
 *       "totalTransactions": 1250,
 *       "totalUsages": 380,
 *       "totalDistributed": 45000.00,
 *       "totalUsed": 12500.00,
 *       "totalPurchaseValue": 450000.00,
 *       "avgCashbackPercentage": 10.0,
 *       "avgTransactionValue": 360.00,
 *       "avgUsageValue": 32.89,
 *       "uniqueClients": 450,
 *       "uniqueUsageClients": 150,
 *       "conversionRate": 30.4,
 *       "usageRate": 27.78,
 *       "clientRetention": 33.33
 *     },
 *     "previousPeriodMetrics": {
 *       "totalTransactions": 1100,
 *       "totalDistributed": 38000.00,
 *       "totalUsed": 10000.00,
 *       "totalPurchaseValue": 380000.00,
 *       "avgTransactionValue": 345.45,
 *       "uniqueClients": 420
 *     },
 *     "periodTrends": [
 *       {
 *         "period": "2024-01",
 *         "totalTransactions": 420,
 *         "totalDistributed": 15000.00,
 *         "totalPurchaseValue": 150000.00,
 *         "avgTransactionValue": 357.14,
 *         "uniqueClients": 150
 *       }
 *     ],
 *     "usagePeriodTrends": [
 *       {
 *         "period": "2024-01",
 *         "totalUsages": 125,
 *         "totalUsed": 4200.00,
 *         "avgUsageValue": 33.60,
 *         "uniqueUsageClients": 48
 *       }
 *     ],
 *     "clientEngagement": [
 *       {
 *         "clientId": "client-123",
 *         "clientName": "João Silva",
 *         "totalTransactions": 45,
 *         "totalEarned": 2500.00,
 *         "totalUsed": 800.00,
 *         "currentBalance": 1700.00,
 *         "usageRate": 32.0,
 *         "avgTransactionValue": 555.56,
 *         "lastTransactionDate": "2024-01-15T10:30:00Z",
 *         "lastUsageDate": "2024-01-10T14:20:00Z",
 *         "responsibleUser": {
 *           "id": "user-456",
 *           "name": "Maria Santos"
 *         }
 *       }
 *     ],
 *     "settingsEffectiveness": [
 *       {
 *         "settingId": "setting-789",
 *         "settingName": "Cashback Premium",
 *         "percentageRate": "15.00",
 *         "minimumPurchase": "100.00",
 *         "maximumCashback": "500.00",
 *         "totalTransactions": 850,
 *         "totalDistributed": 32000.00,
 *         "totalPurchaseValue": 320000.00,
 *         "avgTransactionValue": 376.47,
 *         "uniqueClients": 280
 *       }
 *     ]
 *   },
 *   "filters": {
 *     "startDate": "2024-01-01T00:00:00.000Z",
 *     "endDate": "2024-01-31T23:59:59.999Z",
 *     "sellerId": "user-123",
 *     "periodType": "monthly",
 *     "compareWithPrevious": true
 *   }
 * }
 * ```
 *
 * @implementation
 * 1. **Métricas de Conversão**: Agrega totais de transações, distribuições, usos e calcula KPIs (taxa de conversão, taxa de uso, retenção)
 * 2. **Tendências por Período**: Agrupa transações e usos por período (diário, semanal ou mensal) com totais e médias
 * 3. **Engajamento de Clientes**: Top 20 clientes mais ativos com métricas de ganhos, usos e taxas de utilização
 * 4. **Efetividade de Configurações**: Analisa performance de cada configuração de cashback por transações e valores
 * 5. **Comparação com Período Anterior**: Opcionalmente compara métricas com período equivalente anterior
 * 6. **Agrupamento Flexível**: Suporta agrupamento diário (YYYY-MM-DD), semanal (YYYY-Www) ou mensal (YYYY-MM)
 * 7. **Filtros por Vendedor**: Permite análise específica por vendedor responsável pelos clientes
 *
 * @example
 * GET /api/cashback-settings/performance?periodType=monthly&compareWithPrevious=true
 * GET /api/cashback-settings/performance?startDate=2024-01-01&endDate=2024-12-31&sellerId=user-123
 * GET /api/cashback-settings/performance?periodType=daily&startDate=2024-01-01&endDate=2024-01-31
 */
cashbackSettingsRouter.get("/performance", getCashbackPerformance);

/**
 * @route GET /api/cashback-settings/transactions-simple
 *
 * @description
 * Busca transações de cashback com filtro por usuário e role
 *
 * @queryparam {string} [userId] - ID do usuário para filtrar (via query ou header x-user-id)
 * @queryparam {string} [userRole] - Role do usuário (via query ou header x-user-role)
 *
 * @returns {Array} Lista de transações com dados do cliente e responsável:
 * ```json
 * [
 *   {
 *     "id": "trans-123",
 *     "clientId": "client-456",
 *     "dealId": "deal-789",
 *     "purchaseAmount": "1000.00",
 *     "cashbackAmount": "100.00",
 *     "cashbackRate": "10.00",
 *     "status": "approved",
 *     "expiresAt": "2024-02-15T00:00:00.000Z",
 *     "processedBy": "user-111",
 *     "settingId": "setting-222",
 *     "notes": "Cashback gerado automaticamente",
 *     "createdAt": "2024-01-15T10:30:00.000Z",
 *     "updatedAt": "2024-01-15T10:30:00.000Z",
 *     "clientName": "João Silva",
 *     "clientEmail": "joao@example.com",
 *     "responsibleId": "user-333",
 *     "responsibleName": "Maria Santos"
 *   }
 * ]
 * ```
 *
 * @implementation
 * 1. **Filtro por Vendedor**: Se userRole for "vendedor", retorna apenas transações de clientes sob sua responsabilidade
 * 2. **Join com Dados**: Faz join com clients e users para trazer nome do cliente e responsável
 * 3. **Ordenação**: Ordenado por data de criação (createdAt)
 *
 * @example
 * GET /api/cashback-settings/transactions-simple
 * GET /api/cashback-settings/transactions-simple?userId=user-123&userRole=vendedor
 */
cashbackSettingsRouter.get(
  "/transactions-simple",
  getCashbackTransactionsSimple
);

/**
 * @route GET /api/cashback-settings/reports
 * @description Busca relatórios completos de cashback com estatísticas, top clientes, tendências e performance
 * @access Private
 *
 * @queryparam {string} [search] - Busca por nome, email ou telefone do cliente
 * @queryparam {string} [startDate] - Data inicial para filtrar transações (formato ISO)
 * @queryparam {string} [endDate] - Data final para filtrar transações (formato ISO)
 * @queryparam {string} [sellerId] - Filtra por vendedor responsável
 * @queryparam {string} [clientId] - Filtra por cliente específico
 * @queryparam {boolean} [hasActiveSettings] - Parâmetro não utilizado (mantido por compatibilidade)
 * @queryparam {number} [page=1] - Número da página (mantido por compatibilidade)
 * @queryparam {number} [limit=10] - Itens por página (mantido por compatibilidade)
 * @queryparam {string} [sortBy=totalEarned] - Campo de ordenação (mantido por compatibilidade)
 * @queryparam {string} [sortOrder=desc] - Direção da ordenação (mantido por compatibilidade)
 *
 * @example Request
 * GET /api/cashback-settings/reports?startDate=2024-01-01&endDate=2024-12-31&sellerId=user-123
 *
 * @example Success Response (200)
 * {
 *   "success": true,
 *   "data": {
 *     "dashboardStats": {
 *       "totalDistributed": 15000,
 *       "totalUsed": 8000,
 *       "totalPendingBalance": 7000,
 *       "totalTransactions": 150,
 *       "totalUsageCount": 80,
 *       "totalClientsWithBalance": 45
 *     },
 *     "topClients": [
 *       {
 *         "id": "client-1",
 *         "name": "João Silva",
 *         "email": "joao@email.com",
 *         "phone": "11987654321",
 *         "totalEarned": 1500,
 *         "totalUsed": 800,
 *         "currentBalance": "700.00",
 *         "responsibleUser": {
 *           "id": "user-1",
 *           "name": "Vendedor 1",
 *           "email": "vendedor1@empresa.com"
 *         }
 *       }
 *     ],
 *     "activeSettings": [
 *       {
 *         "id": "setting-1",
 *         "name": "Cashback Padrão",
 *         "percentageRate": "10",
 *         "minimumPurchase": "100.00",
 *         "maximumCashback": "500.00",
 *         "isActive": "true",
 *         "createdAt": "2024-01-01T00:00:00.000Z",
 *         "updatedAt": "2024-01-15T00:00:00.000Z"
 *       }
 *     ],
 *     "monthlyTrends": [
 *       {
 *         "month": "2024-01",
 *         "totalDistributed": 2500,
 *         "totalTransactions": 25,
 *         "avgTransactionValue": 1000
 *       }
 *     ],
 *     "monthlyUsageTrends": [
 *       {
 *         "month": "2024-01",
 *         "totalUsed": 1200,
 *         "totalUsageCount": 15,
 *         "avgUsageValue": 80
 *       }
 *     ],
 *     "sellersPerformance": [
 *       {
 *         "id": "user-1",
 *         "name": "Vendedor 1",
 *         "email": "vendedor1@empresa.com",
 *         "totalDistributed": 5000,
 *         "totalTransactions": 50,
 *         "totalClients": 20,
 *         "avgTransactionValue": 1000,
 *         "totalClientsWithBalance": 15
 *       }
 *     ]
 *   },
 *   "filters": {
 *     "search": null,
 *     "startDate": "2024-01-01",
 *     "endDate": "2024-12-31",
 *     "sellerId": "user-123",
 *     "clientId": null,
 *     "hasActiveSettings": null,
 *     "page": 1,
 *     "limit": 10,
 *     "sortBy": "totalEarned",
 *     "sortOrder": "desc"
 *   }
 * }
 *
 * @implementation_notes
 * - Dashboard stats incluem totais agregados de cashback distribuído, usado e saldo pendente
 * - Top clientes limitado a 5 com maior total ganho
 * - Tendências mensais cobrem os últimos 6 meses
 * - Performance de vendedores limitada a top 10 por total distribuído
 * - Filtros de data aplicam-se apenas a transações, não a configurações
 * - Busca textual pesquisa em nome, email e telefone do cliente
 */
cashbackSettingsRouter.get("/reports", getCashbackReports);

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
