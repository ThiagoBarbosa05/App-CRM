import { Request, Response } from "express";
import { clientsService } from "../../services/clients.service";

/**
 * Controller para buscar clientes por uma lista explícita de IDs, com paginação.
 * Recebe os IDs no corpo (POST) em vez de query string porque a lista pode ter
 * milhares de itens (ex.: revisar destinatários de uma campanha pré-selecionada
 * a partir de um segmento) e estourar o limite de tamanho de uma URL.
 */
export const getClientsByIdsController = async (req: Request, res: Response) => {
  try {
    const userId = (req.query.userId as string) || req.user?.userId;
    const userRole = req.user?.role;
    const page = parseInt(req.body?.page, 10) || 1;
    const pageSize = parseInt(req.body?.pageSize, 10) || 100;
    const clientIds = Array.isArray(req.body?.clientIds)
      ? (req.body.clientIds as unknown[]).filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];

    if (clientIds.length === 0) {
      return res.json({ data: [], currentPage: page, hasNextPage: false, totalPages: 1, totalItems: 0 });
    }

    const result = await clientsService.getClients({
      userId,
      userRole,
      filters: { ids: clientIds },
      page,
      pageSize,
    });
    res.json(result);
  } catch (error) {
    console.error("Erro no getClientsByIdsController:", error);

    if (error instanceof Error) {
      if (
        error.message.includes("Página deve ser maior") ||
        error.message.includes("Tamanho da página deve estar")
      ) {
        return res.status(400).json({ message: error.message, error: "INVALID_PARAMETERS" });
      }
    }

    res.status(500).json({ message: "Erro ao buscar clientes" });
  }
};
