import { Request, Response } from "express";
import { clientsService } from "../../services/clients.service";

export const getClientsExportFilteredController = async (
  req: Request,
  res: Response,
) => {
  try {
    const params = clientsService.processExportFilteredParams(req);
    const clients = await clientsService.getClientsForExportFiltered(params);
    res.status(200).json(clients);
  } catch (error) {
    console.error("Erro no getClientsExportFilteredController:", error);
    res.status(500).json({ message: "Erro ao buscar clientes para exportação" });
  }
};
