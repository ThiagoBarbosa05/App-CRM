import { Router, Request, Response, NextFunction } from "express";
import {
  openOrderController,
  getOrderController,
  listOrdersController,
  addOrderItemController,
  updateOrderItemController,
  cancelOrderItemController,
  closeOrderController,
  listTablesController,
  listTablesMapController,
  createTableController,
  updateTableController,
  deactivateTableController,
  requestPaymentController,
  cancelPaymentRequestController,
  applyDiscountController,
  removeDiscountController,
  listOrderAuditLogController,
  listOrderPaymentsController,
  addOrderPaymentController,
  removeOrderPaymentController,
  transferOrderItemsController,
  mergeOrdersController,
  getDailySummaryController,
  getSalesReportController,
  getCancellationsReportController,
  forceCancelOrderController,
  updateOrderPeopleCountController,
} from "../controllers/restaurant-pdv";
import {
  openCashSessionController,
  closeCashSessionController,
  getCurrentCashSessionController,
  addCashMovementController,
  listCashSessionsController,
  getCashSessionController,
  listCurrentSessionOrdersController,
  listSessionsOverviewController,
} from "../controllers/restaurant-cash-session";
import {
  getPdvSettingsController,
  updatePdvSettingsController,
} from "../controllers/restaurant-pdv/pdv-settings.controller";
import { searchClientsController } from "../controllers/restaurant-pdv/search-clients.controller";
import { quickCreateClientController } from "../controllers/restaurant-pdv/quick-create-client.controller";
import { updateOrderClientController } from "../controllers/restaurant-pdv/update-order-client.controller";
import {
  listPdvUnitsController,
  createPdvUnitController,
  updatePdvUnitController,
  deactivatePdvUnitController,
  listPdvUnitUsersController,
  listEligibleSellersController,
} from "../controllers/restaurant-pdv/pdv-units.controller";
import { adminUnitsOverviewController } from "../controllers/restaurant-pdv/admin-units-overview.controller";
import { storage } from "../storage";
import { resolvePdvUnit } from "../middleware/resolve-pdv-unit";

export const restaurantPdvRouter = Router();

function requireOperadorOrGestor(req: Request, res: Response, next: NextFunction) {
  const role = req.user?.role;
  if (!["garcom", "vendedor", "admin", "gerente"].includes(role ?? "")) {
    return res.status(403).json({ message: "Acesso restrito" });
  }
  return next();
}

function requireGestor(req: Request, res: Response, next: NextFunction) {
  const role = req.user?.role;
  if (!["admin", "gerente"].includes(role ?? "")) {
    return res.status(403).json({ message: "Acesso restrito a administradores e gerentes" });
  }
  return next();
}

// ── Rotas sem contexto de unidade (antes do middleware resolvePdvUnit) ────────

// Busca de produtos Bling — acessível ao garçom sem contexto de unidade
restaurantPdvRouter.get("/products", requireOperadorOrGestor, async (req: Request, res: Response) => {
  try {
    const { name, connectionId, category, country } = req.query;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const { data, total } = await storage.getProducts(
      {
        name: name as string | undefined,
        connectionId: connectionId as string | undefined,
        category: category as string | undefined,
        // O frontend já mandava `country` (chips de país); a rota descartava
        // silenciosamente, então clicar num chip não filtrava nada.
        country: country as string | undefined,
      },
      1,
      pageSize,
    );
    return res.json({ data, total });
  } catch (err) {
    console.error("[PDV] Erro ao buscar produtos:", err);
    return res.status(500).json({ message: "Erro ao buscar produtos" });
  }
});

/** Lista categorias e países distintos dos produtos mapeados para esta conexão Bling. */
restaurantPdvRouter.get("/products/filters", requireOperadorOrGestor, async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.query;
    if (!connectionId) return res.json({ categories: [], countries: [] });

    const { data } = await storage.getProducts(
      { connectionId: connectionId as string },
      1,
      2000,
    );

    const categories = [...new Set(
      data.map((p: { category?: string }) => p.category).filter(Boolean) as string[]
    )].sort((a, b) => a.localeCompare(b, "pt-BR"));

    const countries = [...new Set(
      data.map((p: { country?: string }) => p.country).filter(Boolean) as string[]
    )].sort((a, b) => a.localeCompare(b, "pt-BR"));

    return res.json({ categories, countries });
  } catch (err) {
    console.error("[PDV] Erro ao buscar filtros:", err);
    return res.status(500).json({ message: "Erro ao buscar filtros" });
  }
});

restaurantPdvRouter.get("/units", requireGestor, listPdvUnitsController);
restaurantPdvRouter.get("/units/eligible-sellers", requireGestor, listEligibleSellersController);
restaurantPdvRouter.post("/units", requireGestor, createPdvUnitController);
restaurantPdvRouter.put("/units/:id", requireGestor, updatePdvUnitController);
restaurantPdvRouter.delete("/units/:id", requireGestor, deactivatePdvUnitController);
restaurantPdvRouter.get("/units/:id/users", requireGestor, listPdvUnitUsersController);

// Visão geral agrega TODAS as unidades — não precisa de contexto de unidade
restaurantPdvRouter.get("/cash-sessions/overview", requireGestor, listSessionsOverviewController);

// Painel multi-unidade do admin — agrega todas as unidades, sem contexto de unidade
restaurantPdvRouter.get("/admin/units-overview", requireGestor, adminUnitsOverviewController);

// Cancelamento de comanda pelo admin sem precisar de contexto de unidade
restaurantPdvRouter.delete("/admin/orders/:id", requireGestor, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const actorId = req.user?.userId;
    if (!actorId) return res.status(401).json({ message: "Usuário não autenticado" });
    const { restaurantPdvService } = await import("../services/restaurant-pdv.service");
    await restaurantPdvService.forceCancelOrder(id, actorId);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error(`[Admin] Erro ao cancelar comanda ${req.params.id}: code=${error?.code} msg=${error?.message}`);
    if (error?.code === "NOT_FOUND") return res.status(404).json({ message: error.message });
    if (error?.code === "ORDER_CLOSED" || error?.code === "PAYMENTS_ALREADY_REGISTERED") {
      return res.status(409).json({ message: error.message });
    }
    return res.status(500).json({ message: "Erro ao cancelar comanda" });
  }
});

// ── Middleware: resolve unidade PDV para todas as rotas abaixo ───────────────
restaurantPdvRouter.use(resolvePdvUnit);

// ── Mesas ────────────────────────────────────────────────────────────────────
restaurantPdvRouter.get("/tables/map", requireOperadorOrGestor, listTablesMapController);
restaurantPdvRouter.get("/tables", requireGestor, listTablesController);
restaurantPdvRouter.post("/tables", requireGestor, createTableController);
restaurantPdvRouter.put("/tables/:id", requireGestor, updateTableController);
restaurantPdvRouter.delete("/tables/:id", requireGestor, deactivateTableController);

// ── Comandas ─────────────────────────────────────────────────────────────────
restaurantPdvRouter.get("/orders", requireGestor, listOrdersController);
restaurantPdvRouter.post("/orders", requireOperadorOrGestor, openOrderController);
restaurantPdvRouter.get("/orders/:id", requireOperadorOrGestor, getOrderController);
restaurantPdvRouter.post("/orders/:id/items", requireOperadorOrGestor, addOrderItemController);
restaurantPdvRouter.put("/orders/:id/items/:itemId", requireOperadorOrGestor, updateOrderItemController);
restaurantPdvRouter.delete("/orders/:id/items/:itemId", requireOperadorOrGestor, cancelOrderItemController);
restaurantPdvRouter.post("/orders/:id/close", requireOperadorOrGestor, closeOrderController);
restaurantPdvRouter.post("/orders/:id/request-payment", requireOperadorOrGestor, requestPaymentController);
restaurantPdvRouter.post("/orders/:id/cancel-payment-request", requireOperadorOrGestor, cancelPaymentRequestController);
restaurantPdvRouter.post("/orders/:id/discount", requireGestor, applyDiscountController);
restaurantPdvRouter.delete("/orders/:id/discount", requireGestor, removeDiscountController);
restaurantPdvRouter.get("/orders/:id/audit-log", requireGestor, listOrderAuditLogController);
restaurantPdvRouter.get("/orders/:id/payments", requireOperadorOrGestor, listOrderPaymentsController);
restaurantPdvRouter.post("/orders/:id/payments", requireOperadorOrGestor, addOrderPaymentController);
restaurantPdvRouter.delete("/orders/:id/payments/:paymentId", requireOperadorOrGestor, removeOrderPaymentController);
restaurantPdvRouter.post("/orders/:id/transfer-items", requireOperadorOrGestor, transferOrderItemsController);
restaurantPdvRouter.post("/orders/:id/merge-into/:targetId", requireOperadorOrGestor, mergeOrdersController);
restaurantPdvRouter.delete("/orders/:id", requireGestor, forceCancelOrderController);

// ── Caixa ─────────────────────────────────────────────────────────────────────
restaurantPdvRouter.get("/cash-sessions/current", requireOperadorOrGestor, getCurrentCashSessionController);
restaurantPdvRouter.get("/cash-sessions/current/orders", requireOperadorOrGestor, listCurrentSessionOrdersController);
restaurantPdvRouter.get("/cash-sessions", requireGestor, listCashSessionsController);
// Gerenciar o caixa (abrir, lançar movimento, fechar) é exclusivo do gestor.
// O operador (garçom/vendedor) só consulta o caixa atual (linhas acima) para
// saber se pode abrir mesa — nunca abre, movimenta ou fecha o caixa ele mesmo.
restaurantPdvRouter.post("/cash-sessions", requireGestor, openCashSessionController);
restaurantPdvRouter.post("/cash-sessions/movements", requireGestor, addCashMovementController);
restaurantPdvRouter.get("/cash-sessions/:id", requireGestor, getCashSessionController);
restaurantPdvRouter.post("/cash-sessions/:id/close", requireGestor, closeCashSessionController);

// ── Relatórios ────────────────────────────────────────────────────────────────
restaurantPdvRouter.get("/reports/daily-summary", requireGestor, getDailySummaryController);
restaurantPdvRouter.get("/reports/sales", requireGestor, getSalesReportController);
restaurantPdvRouter.get("/reports/cancellations", requireGestor, getCancellationsReportController);

// ── Configurações ─────────────────────────────────────────────────────────────
restaurantPdvRouter.get("/settings", requireOperadorOrGestor, getPdvSettingsController);
restaurantPdvRouter.put("/settings", requireGestor, updatePdvSettingsController);

// ── Clientes ──────────────────────────────────────────────────────────────────
restaurantPdvRouter.get("/clients/search", requireOperadorOrGestor, searchClientsController);
restaurantPdvRouter.post("/clients", requireOperadorOrGestor, quickCreateClientController);
restaurantPdvRouter.patch("/orders/:id/client", requireOperadorOrGestor, updateOrderClientController);
restaurantPdvRouter.patch("/orders/:id/people-count", requireOperadorOrGestor, updateOrderPeopleCountController);
