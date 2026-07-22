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
} from "../controllers/restaurant-pdv/pdv-units.controller";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../storage";

export const restaurantPdvRouter = Router();

function requireGarcomOrGestor(req: Request, res: Response, next: NextFunction) {
  const role = req.user?.role;
  if (!["garcom", "admin", "gerente"].includes(role ?? "")) {
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
restaurantPdvRouter.get("/products", requireGarcomOrGestor, async (req: Request, res: Response) => {
  try {
    const { name, connectionId, category } = req.query;
    const pageSize = parseInt(req.query.pageSize as string) || 50;
    const { data, total } = await storage.getProducts(
      {
        name: name as string | undefined,
        connectionId: connectionId as string | undefined,
        category: category as string | undefined,
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
restaurantPdvRouter.get("/products/filters", requireGarcomOrGestor, async (req: Request, res: Response) => {
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
restaurantPdvRouter.post("/units", requireGestor, createPdvUnitController);
restaurantPdvRouter.put("/units/:id", requireGestor, updatePdvUnitController);
restaurantPdvRouter.delete("/units/:id", requireGestor, deactivatePdvUnitController);
restaurantPdvRouter.get("/units/:id/users", requireGestor, listPdvUnitUsersController);

// Visão geral agrega TODAS as unidades — não precisa de contexto de unidade
restaurantPdvRouter.get("/cash-sessions/overview", requireGestor, listSessionsOverviewController);

// ── Middleware: resolve unidade PDV para todas as rotas abaixo ───────────────
// Para garçom: busca pdv_unit_id do usuário no banco.
// Para admin/gerente: lê o header X-PDV-Unit-Id enviado pelo frontend.
restaurantPdvRouter.use(async (req: Request, res: Response, next: NextFunction) => {
  const role = req.user?.role;
  const userId = req.user?.userId;

  if (!userId) return next(); // Rotas sem autenticação passam direto

  if (role === "garcom") {
    const [user] = await db
      .select({ pdvUnitId: users.pdvUnitId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user?.pdvUnitId) {
      return res.status(400).json({
        message: "Garçom não vinculado a nenhuma unidade PDV. Fale com o administrador.",
        code: "NO_PDV_UNIT",
      });
    }
    req.pdvUnitId = user.pdvUnitId;
  } else {
    const unitId = req.headers["x-pdv-unit-id"] as string | undefined;
    if (!unitId) {
      return res.status(400).json({
        message: "Selecione uma unidade PDV para continuar.",
        code: "NO_PDV_UNIT",
      });
    }
    req.pdvUnitId = unitId;
  }

  return next();
});

// ── Mesas ────────────────────────────────────────────────────────────────────
restaurantPdvRouter.get("/tables/map", requireGarcomOrGestor, listTablesMapController);
restaurantPdvRouter.get("/tables", requireGestor, listTablesController);
restaurantPdvRouter.post("/tables", requireGestor, createTableController);
restaurantPdvRouter.put("/tables/:id", requireGestor, updateTableController);
restaurantPdvRouter.delete("/tables/:id", requireGestor, deactivateTableController);

// ── Comandas ─────────────────────────────────────────────────────────────────
restaurantPdvRouter.get("/orders", requireGestor, listOrdersController);
restaurantPdvRouter.post("/orders", requireGarcomOrGestor, openOrderController);
restaurantPdvRouter.get("/orders/:id", requireGarcomOrGestor, getOrderController);
restaurantPdvRouter.post("/orders/:id/items", requireGarcomOrGestor, addOrderItemController);
restaurantPdvRouter.put("/orders/:id/items/:itemId", requireGarcomOrGestor, updateOrderItemController);
restaurantPdvRouter.delete("/orders/:id/items/:itemId", requireGarcomOrGestor, cancelOrderItemController);
restaurantPdvRouter.post("/orders/:id/close", requireGarcomOrGestor, closeOrderController);
restaurantPdvRouter.post("/orders/:id/request-payment", requireGarcomOrGestor, requestPaymentController);
restaurantPdvRouter.post("/orders/:id/cancel-payment-request", requireGarcomOrGestor, cancelPaymentRequestController);
restaurantPdvRouter.post("/orders/:id/discount", requireGestor, applyDiscountController);
restaurantPdvRouter.delete("/orders/:id/discount", requireGestor, removeDiscountController);
restaurantPdvRouter.get("/orders/:id/audit-log", requireGestor, listOrderAuditLogController);
restaurantPdvRouter.get("/orders/:id/payments", requireGarcomOrGestor, listOrderPaymentsController);
restaurantPdvRouter.post("/orders/:id/payments", requireGarcomOrGestor, addOrderPaymentController);
restaurantPdvRouter.delete("/orders/:id/payments/:paymentId", requireGarcomOrGestor, removeOrderPaymentController);
restaurantPdvRouter.post("/orders/:id/transfer-items", requireGarcomOrGestor, transferOrderItemsController);
restaurantPdvRouter.post("/orders/:id/merge-into/:targetId", requireGarcomOrGestor, mergeOrdersController);
restaurantPdvRouter.delete("/orders/:id", requireGestor, forceCancelOrderController);

// ── Caixa ─────────────────────────────────────────────────────────────────────
restaurantPdvRouter.get("/cash-sessions/current", requireGarcomOrGestor, getCurrentCashSessionController);
restaurantPdvRouter.get("/cash-sessions/current/orders", requireGarcomOrGestor, listCurrentSessionOrdersController);
restaurantPdvRouter.get("/cash-sessions", requireGestor, listCashSessionsController);
restaurantPdvRouter.post("/cash-sessions", requireGarcomOrGestor, openCashSessionController);
restaurantPdvRouter.post("/cash-sessions/movements", requireGestor, addCashMovementController);
restaurantPdvRouter.get("/cash-sessions/:id", requireGestor, getCashSessionController);
restaurantPdvRouter.post("/cash-sessions/:id/close", requireGarcomOrGestor, closeCashSessionController);

// ── Relatórios ────────────────────────────────────────────────────────────────
restaurantPdvRouter.get("/reports/daily-summary", requireGestor, getDailySummaryController);
restaurantPdvRouter.get("/reports/sales", requireGestor, getSalesReportController);
restaurantPdvRouter.get("/reports/cancellations", requireGestor, getCancellationsReportController);

// ── Configurações ─────────────────────────────────────────────────────────────
restaurantPdvRouter.get("/settings", requireGarcomOrGestor, getPdvSettingsController);
restaurantPdvRouter.put("/settings", requireGestor, updatePdvSettingsController);

// ── Clientes ──────────────────────────────────────────────────────────────────
restaurantPdvRouter.get("/clients/search", requireGarcomOrGestor, searchClientsController);
restaurantPdvRouter.post("/clients", requireGarcomOrGestor, quickCreateClientController);
restaurantPdvRouter.patch("/orders/:id/client", requireGarcomOrGestor, updateOrderClientController);
