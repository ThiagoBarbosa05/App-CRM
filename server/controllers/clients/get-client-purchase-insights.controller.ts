import { Request, Response } from "express";
import { z } from "zod";
import { clientPurchaseInsightsService } from "../../services/client-purchase-insights.service";

const querySchema = z.object({
  historyLimit: z.coerce.number().int().min(1).max(50).optional().default(10),
  historyOffset: z.coerce.number().int().min(0).optional().default(0),
  historySource: z.enum(["all", "bling", "connect"]).optional().default("all"),
});

export const getClientPurchaseInsightsController = async (
  req: Request,
  res: Response,
) => {
  try {
    const { clientId } = req.params;

    if (!clientId) {
      return res.status(400).json({ message: "ID do cliente é obrigatório" });
    }

    const query = querySchema.parse(req.query);
    const data = await clientPurchaseInsightsService.getInsights({
      clientId,
      historyLimit: query.historyLimit,
      historyOffset: query.historyOffset,
      historySource: query.historySource,
    });

    return res.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        message: "Parâmetros inválidos",
        details: error.errors,
      });
    }

    if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }

    console.error("Erro no getClientPurchaseInsightsController:", error);
    return res.status(500).json({
      message: "Erro ao buscar inteligência de compras do cliente",
    });
  }
};
