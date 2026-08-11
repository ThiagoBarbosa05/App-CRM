import { Request, Response } from "express";
import { clientsService } from "../../services/clients.service";

/**
 * Controller para buscar apenas os IDs de clientes que correspondem a um
 * conjunto de filtros, sem paginação. Usado para resolver um segmento em uma
 * lista de destinatários (ex.: pré-selecionar clientes ao criar uma campanha).
 */
export const getClientIdsController = async (req: Request, res: Response) => {
  try {
    const { userId, userRole, filters } = clientsService.processRequestParams(req);
    const clientIds = await clientsService.getFilteredClientIds({ userId, userRole, filters });
    res.json({ clientIds });
  } catch (error) {
    console.error("Erro no getClientIdsController:", error);
    res.status(500).json({ message: "Erro ao buscar IDs de clientes" });
  }
};
