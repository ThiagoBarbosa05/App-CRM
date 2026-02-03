import { Router } from "express";
import { blingOrdersController } from "../controllers/bling-orders.controller";

const router = Router();

/**
 * Rotas para gerenciamento de pedidos do Bling Control
 *
 * Todas as rotas requerem autenticação (adicione middleware se necessário)
 */

/**
 * @route   GET /api/bling-orders
 * @desc    Lista pedidos com filtros e paginação
 * @query   {
 *   accountId?: string,
 *   userId?: string,
 *   contactId?: number,
 *   sellerId?: number,
 *   storeId?: number,
 *   situationId?: number,
 *   startDate?: string,  // YYYY-MM-DD
 *   endDate?: string,    // YYYY-MM-DD
 *   includeDeleted?: boolean,
 *   limit?: number,      // 1-100, default: 50
 *   offset?: number      // default: 0
 * }
 * @access  Private
 */
router.get("/", blingOrdersController.listOrders.bind(blingOrdersController));

/**
 * @route   GET /api/bling-orders/statistics/sales
 * @desc    Retorna estatísticas de vendas por período
 * @query   {
 *   startDate: string,   // YYYY-MM-DD (obrigatório)
 *   endDate: string,     // YYYY-MM-DD (obrigatório)
 *   accountId?: string
 * }
 * @access  Private
 */
router.get(
  "/statistics/sales",
  blingOrdersController.getSalesStatistics.bind(blingOrdersController)
);

/**
 * @route   GET /api/bling-orders/statistics/top-sellers
 * @desc    Retorna top vendedores por valor de vendas
 * @query   {
 *   startDate: string,   // YYYY-MM-DD (obrigatório)
 *   endDate: string,     // YYYY-MM-DD (obrigatório)
 *   limit?: number       // 1-50, default: 10
 * }
 * @access  Private
 */
router.get(
  "/statistics/top-sellers",
  blingOrdersController.getTopSellers.bind(blingOrdersController)
);

/**
 * @route   GET /api/bling-orders/statistics/top-products
 * @desc    Retorna produtos mais vendidos
 * @query   {
 *   startDate: string,   // YYYY-MM-DD (obrigatório)
 *   endDate: string,     // YYYY-MM-DD (obrigatório)
 *   limit?: number       // 1-50, default: 10
 * }
 * @access  Private
 */
router.get(
  "/statistics/top-products",
  blingOrdersController.getTopProducts.bind(blingOrdersController)
);

/**
 * @route   GET /api/bling-orders/filters/sellers
 * @desc    Lista vendedores disponíveis com contagem de pedidos
 * @access  Private
 */
router.get(
  "/filters/sellers",
  blingOrdersController.getAvailableSellers.bind(blingOrdersController)
);

/**
 * @route   GET /api/bling-orders/filters/stores
 * @desc    Lista lojas disponíveis com contagem de pedidos
 * @access  Private
 */
router.get(
  "/filters/stores",
  blingOrdersController.getAvailableStores.bind(blingOrdersController)
);

/**
 * @route   GET /api/bling-orders/filters/situations
 * @desc    Lista situações disponíveis com contagem de pedidos
 * @access  Private
 */
router.get(
  "/filters/situations",
  blingOrdersController.getAvailableSituations.bind(blingOrdersController)
);

/**
 * @route   GET /api/bling-orders/:blingOrderId
 * @desc    Busca um pedido específico por ID do Bling
 * @params  blingOrderId: number
 * @access  Private
 */
router.get(
  "/:blingOrderId",
  blingOrdersController.getOrderById.bind(blingOrdersController)
);


export default router;
