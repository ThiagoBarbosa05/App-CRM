import { Router } from "express";
import { unifiedOrdersController } from "../controllers/unified-orders/unified-orders.controller";

const router = Router();

/**
 * @route   GET /api/unified-orders
 * @desc    Lista pedidos unificados (Bling + Connect) com filtros e paginação
 * @query   startDate, endDate, contactName?, sellerId?, source?, limit?, offset?
 */
router.get(
  "/",
  unifiedOrdersController.listOrders.bind(unifiedOrdersController),
);

/**
 * @route   GET /api/unified-orders/statistics/sales
 * @desc    Estatísticas de vendas somadas (total pedidos, valor total, ticket médio)
 * @query   startDate, endDate, source?
 */
router.get(
  "/statistics/sales",
  unifiedOrdersController.getSalesStatistics.bind(unifiedOrdersController),
);

/**
 * @route   GET /api/unified-orders/statistics/sales-comparison
 * @desc    Comparação das estatísticas do período atual vs período anterior
 * @query   startDate, endDate, source?
 */
router.get(
  "/statistics/sales-comparison",
  unifiedOrdersController.getSalesComparison.bind(unifiedOrdersController),
);

/**
 * @route   GET /api/unified-orders/statistics/sales-evolution
 * @desc    Evolução temporal de vendas agrupada por dia/semana/mês
 * @query   startDate, endDate, groupBy?, source?
 */
router.get(
  "/statistics/sales-evolution",
  unifiedOrdersController.getSalesEvolution.bind(unifiedOrdersController),
);

/**
 * @route   GET /api/unified-orders/statistics/top-sellers
 * @desc    Top vendedores por valor (Bling + Connect combinados)
 * @query   startDate, endDate, limit?, source?
 */
router.get(
  "/statistics/top-sellers",
  unifiedOrdersController.getTopSellers.bind(unifiedOrdersController),
);

export default router;
