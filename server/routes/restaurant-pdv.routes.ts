import { Router, Request, Response, NextFunction } from "express";
import {
  listMenuItemsController,
  createMenuItemController,
  updateMenuItemController,
  deactivateMenuItemController,
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
} from "../controllers/restaurant-cash-session";
import {
  getPdvSettingsController,
  updatePdvSettingsController,
} from "../controllers/restaurant-pdv/pdv-settings.controller";
import { searchClientsController } from "../controllers/restaurant-pdv/search-clients.controller";
import { quickCreateClientController } from "../controllers/restaurant-pdv/quick-create-client.controller";

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

restaurantPdvRouter.get("/tables/map", requireGarcomOrGestor, listTablesMapController);
restaurantPdvRouter.get("/tables", requireGestor, listTablesController);
restaurantPdvRouter.post("/tables", requireGestor, createTableController);
restaurantPdvRouter.put("/tables/:id", requireGestor, updateTableController);
restaurantPdvRouter.delete("/tables/:id", requireGestor, deactivateTableController);

restaurantPdvRouter.get("/menu-items", requireGarcomOrGestor, listMenuItemsController);
restaurantPdvRouter.post("/menu-items", requireGestor, createMenuItemController);
restaurantPdvRouter.put("/menu-items/:id", requireGestor, updateMenuItemController);
restaurantPdvRouter.delete("/menu-items/:id", requireGestor, deactivateMenuItemController);

restaurantPdvRouter.get("/orders", requireGestor, listOrdersController);
restaurantPdvRouter.post("/orders", requireGarcomOrGestor, openOrderController);
restaurantPdvRouter.get("/orders/:id", requireGarcomOrGestor, getOrderController);
restaurantPdvRouter.post("/orders/:id/items", requireGarcomOrGestor, addOrderItemController);
restaurantPdvRouter.put(
  "/orders/:id/items/:itemId",
  requireGarcomOrGestor,
  updateOrderItemController,
);
restaurantPdvRouter.delete(
  "/orders/:id/items/:itemId",
  requireGarcomOrGestor,
  cancelOrderItemController,
);
restaurantPdvRouter.post("/orders/:id/close", requireGarcomOrGestor, closeOrderController);
restaurantPdvRouter.post(
  "/orders/:id/request-payment",
  requireGarcomOrGestor,
  requestPaymentController,
);
restaurantPdvRouter.post(
  "/orders/:id/cancel-payment-request",
  requireGarcomOrGestor,
  cancelPaymentRequestController,
);
restaurantPdvRouter.post("/orders/:id/discount", requireGestor, applyDiscountController);
restaurantPdvRouter.delete("/orders/:id/discount", requireGestor, removeDiscountController);
restaurantPdvRouter.get(
  "/orders/:id/audit-log",
  requireGestor,
  listOrderAuditLogController,
);
restaurantPdvRouter.get(
  "/orders/:id/payments",
  requireGarcomOrGestor,
  listOrderPaymentsController,
);
restaurantPdvRouter.post(
  "/orders/:id/payments",
  requireGarcomOrGestor,
  addOrderPaymentController,
);
restaurantPdvRouter.delete(
  "/orders/:id/payments/:paymentId",
  requireGarcomOrGestor,
  removeOrderPaymentController,
);
restaurantPdvRouter.post(
  "/orders/:id/transfer-items",
  requireGarcomOrGestor,
  transferOrderItemsController,
);
restaurantPdvRouter.post(
  "/orders/:id/merge-into/:targetId",
  requireGarcomOrGestor,
  mergeOrdersController,
);

restaurantPdvRouter.delete("/orders/:id", requireGestor, forceCancelOrderController);

// Caixa. Operar o caixa é privilégio de gestor; apenas a consulta do estado
// atual é liberada ao garçom, para a tela dele poder explicar o bloqueio.
restaurantPdvRouter.get(
  "/cash-sessions/current",
  requireGarcomOrGestor,
  getCurrentCashSessionController,
);
restaurantPdvRouter.get("/cash-sessions", requireGestor, listCashSessionsController);
restaurantPdvRouter.post("/cash-sessions", requireGestor, openCashSessionController);
restaurantPdvRouter.post(
  "/cash-sessions/movements",
  requireGestor,
  addCashMovementController,
);
restaurantPdvRouter.get("/cash-sessions/:id", requireGestor, getCashSessionController);
restaurantPdvRouter.post(
  "/cash-sessions/:id/close",
  requireGestor,
  closeCashSessionController,
);

restaurantPdvRouter.get(
  "/reports/daily-summary",
  requireGestor,
  getDailySummaryController,
);
restaurantPdvRouter.get("/reports/sales", requireGestor, getSalesReportController);
restaurantPdvRouter.get(
  "/reports/cancellations",
  requireGestor,
  getCancellationsReportController,
);

restaurantPdvRouter.get("/settings", requireGarcomOrGestor, getPdvSettingsController);
restaurantPdvRouter.put("/settings", requireGestor, updatePdvSettingsController);

restaurantPdvRouter.get("/clients/search", requireGarcomOrGestor, searchClientsController);
restaurantPdvRouter.post("/clients", requireGarcomOrGestor, quickCreateClientController);
