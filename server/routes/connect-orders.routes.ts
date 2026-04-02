import { Router } from "express";
import { connectOrdersController } from "../controllers/connect-orders/connect-orders.controller";

const router = Router();

router.post(
  "/import",
  connectOrdersController.importOrders.bind(connectOrdersController),
);

router.get(
  "/statistics/sales",
  connectOrdersController.getSalesStatistics.bind(connectOrdersController),
);

router.get(
  "/statistics/top-sellers",
  connectOrdersController.getTopSellers.bind(connectOrdersController),
);

router.get(
  "/statistics/sales-evolution",
  connectOrdersController.getSalesEvolution.bind(connectOrdersController),
);

router.get(
  "/match-sellers",
  connectOrdersController.matchSellers.bind(connectOrdersController),
);

router.get(
  "/",
  connectOrdersController.listOrders.bind(connectOrdersController),
);

export default router;
