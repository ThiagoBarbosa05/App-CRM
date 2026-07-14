import { Request, Response } from "express";
import { restaurantOrderAuditService } from "../../services/restaurant-order-audit.service";

export const listOrderAuditLogController = async (req: Request, res: Response) => {
  try {
    const { id: orderId } = req.params;
    const logs = await restaurantOrderAuditService.listOrderAudit(orderId);
    return res.json(logs);
  } catch (error) {
    console.error("Erro ao buscar histórico de auditoria:", error);
    return res.status(500).json({ message: "Erro ao buscar histórico de auditoria" });
  }
};
