import { Request, Response } from "express";
import { clientsService } from "../../services/clients.service";

/**
 * Controller para buscar clientes com filtros e paginação
 * Responsável por gerenciar a requisição HTTP e formatação da resposta
 */
export const getClientsController = async (req: Request, res: Response) => {
  try {
    // Processar parâmetros da requisição usando o service
    const params = clientsService.processRequestParams(req);

    // Executar busca de clientes
    const result = await clientsService.getClients(params);

    // Retornar resposta HTTP
    res.json(result);
  } catch (error) {
    console.error("Erro no getClientsController:", error);

    // Tratamento de diferentes tipos de erro
    if (error instanceof Error) {
      if (
        error.message.includes("Página deve ser maior") ||
        error.message.includes("Tamanho da página deve estar")
      ) {
        return res.status(400).json({
          message: error.message,
          error: "INVALID_PARAMETERS",
        });
      }
    }

    // Erro genérico - mantém comportamento original
    res.status(500).json({
      message: "Erro ao buscar clientes",
    });
  }
};
