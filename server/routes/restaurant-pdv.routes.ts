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
  removeOrderItemController,
  closeOrderController,
} from "../controllers/restaurant-pdv";

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
  removeOrderItemController,
);
restaurantPdvRouter.post("/orders/:id/close", requireGarcomOrGestor, closeOrderController);
