import type { Request, Response } from "express";

import { getAcompanhamentoData } from "../../services/acompanhamento.service";

export async function getAcompanhamentoController(req: Request, res: Response) {
  try {
    const userId = req.headers["x-user-id"] as string;
    const userRole = req.headers["x-user-role"] as string;
    const searchQuery = req.query.search as string | undefined;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;

    const result = await getAcompanhamentoData({
      userId,
      userRole,
      searchQuery,
      page,
      pageSize,
    });

    return res.json(result);
  } catch (error) {
    console.error("Erro ao buscar dados de acompanhamento:", error);
    return res
      .status(500)
      .json({ message: "Erro ao buscar dados de acompanhamento" });
  }
}
