import { Router, type Request, type Response } from "express";
import { unifiedOrdersController } from "../controllers/unified-orders/unified-orders.controller";
import { requireAdmin, requireAdminOrGerente } from "../middleware/validation";
import { db } from "../db";
import { blingOrders, connectOrders, clients } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * @route   GET /api/unified-orders
 * @desc    Lista pedidos unificados (Bling + Connect) com filtros e paginação
 * @access  Admin — consome a página /pedidos. Sem `requireAdmin` qualquer
 *          usuário autenticado poderia omitir `userId` e ler os pedidos de
 *          todos os vendedores.
 * @query   startDate, endDate, contactName?, sellerId?, source?, minValue?, maxValue?, limit?, offset?
 */
router.get(
  "/",
  requireAdmin,
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
 * @route   GET /api/unified-orders/statistics/sales-comparison.
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
 * @route   GET /api/unified-orders/statistics/seller-totals
 * @desc    Totais por vendedor respeitando os filtros da listagem + meta mensal de user_goals
 * @access  Admin — expõe o faturamento de todos os vendedores.
 * @query   startDate, endDate, contactName?, sellerId?, userId?, source?, minValue?, maxValue?
 */
router.get(
  "/statistics/seller-totals",
  requireAdmin,
  unifiedOrdersController.getSellerTotals.bind(unifiedOrdersController),
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

/**
 * @route   PATCH /api/unified-orders/:source/:id/link-client
 * @desc    Vincula um cliente CRM a um pedido (bling ou connect)
 * @body    { clientId: string }
 */
router.patch("/:source/:id/link-client", requireAdminOrGerente, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

  const { source, id } = req.params;
  const { clientId } = req.body as { clientId?: string };

  if (!["bling", "connect"].includes(source)) {
    return res.status(400).json({ message: "source inválido. Use 'bling' ou 'connect'" });
  }
  if (!clientId) {
    return res.status(400).json({ message: "clientId é obrigatório" });
  }

  // Verifica se o cliente existe
  const [client] = await db.select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!client) {
    return res.status(404).json({ message: "Cliente não encontrado" });
  }

  try {
    if (source === "bling") {
      await db.update(blingOrders)
        .set({ appClientId: clientId })
        .where(eq(blingOrders.id, id));
    } else {
      await db.update(connectOrders)
        .set({ appClientId: clientId })
        .where(eq(connectOrders.id, parseInt(id, 10)));
    }
    res.json({ ok: true, clientName: client.name });
  } catch (err) {
    console.error("[UnifiedOrders] Erro ao vincular cliente:", err);
    res.status(500).json({ message: "Erro ao vincular cliente" });
  }
});

/**
 * @route   PATCH /api/unified-orders/:source/:id/unlink-client
 * @desc    Remove o vínculo de cliente CRM de um pedido (bling ou connect)
 */
router.patch("/:source/:id/unlink-client", requireAdminOrGerente, async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.userId) return res.status(401).json({ message: "Não autenticado" });

  const { source, id } = req.params;

  if (!["bling", "connect"].includes(source)) {
    return res.status(400).json({ message: "source inválido. Use 'bling' ou 'connect'" });
  }

  try {
    if (source === "bling") {
      await db.update(blingOrders)
        .set({ appClientId: null })
        .where(eq(blingOrders.id, id));
    } else {
      await db.update(connectOrders)
        .set({ appClientId: null })
        .where(eq(connectOrders.id, parseInt(id, 10)));
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[UnifiedOrders] Erro ao desvincular cliente:", err);
    res.status(500).json({ message: "Erro ao desvincular cliente" });
  }
});

export default router;
