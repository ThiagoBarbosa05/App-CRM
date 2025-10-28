import { Request, Response } from "express";
import { clientsService } from "../../services/clients.service";

/**
 * Controller para buscar clientes sem contato recente
 * Responsável por gerenciar a requisição HTTP e formatação da resposta
 */
export const getClientsWithoutContactController = async (
  req: Request,
  res: Response
) => {
  try {
    // Processar parâmetros da requisição usando o service
    const { userId, userRole, days } =
      clientsService.processWithoutContactParams(req);

    // Executar busca de clientes sem contato recente
    const clients = await clientsService.getClientsWithoutRecentContact(
      userId,
      userRole,
      days
    );

    // Retornar lista de clientes
    res.json(clients);
  } catch (error) {
    console.error("Erro no getClientsWithoutContactController:", error);

    // Tratamento de diferentes tipos de erro
    if (error instanceof Error) {
      if (error.message.includes("Número de dias deve estar")) {
        return res.status(400).json({
          message: error.message,
          error: "INVALID_DAYS_PARAMETER",
        });
      }
    }

    // Erro genérico - mantém comportamento original
    res.status(500).json({
      message: "Erro ao buscar clientes sem contato",
    });
  }
};
