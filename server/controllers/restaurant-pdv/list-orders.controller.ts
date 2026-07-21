import { Request, Response } from "express";
import { z } from "zod";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";

// Antes o status vinha por cast direto do query string. Um valor fora do enum
// virava `eq(status, 'lixo')` e devolvia lista vazia com 200 — indistinguível
// de "não há comandas". Validar aqui transforma isso em 400.
const statusSchema = z.enum(["aberta", "fechada", "cancelada", "mesclada"]);

export const listOrdersController = async (req: Request, res: Response) => {
  try {
    let status: z.infer<typeof statusSchema> | undefined;
    if (req.query.status !== undefined) {
      const parsed = statusSchema.safeParse(req.query.status);
      if (!parsed.success) {
        return res.status(400).json({ message: "Status inválido" });
      }
      status = parsed.data;
    }

    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;

    const orders = await restaurantPdvService.listOrders({ status, from, to, unitId: req.pdvUnitId });
    return res.json(orders);
  } catch (error) {
    console.error("Erro ao buscar histórico de comandas:", error);
    return res.status(500).json({ message: "Erro ao buscar histórico de comandas" });
  }
};
