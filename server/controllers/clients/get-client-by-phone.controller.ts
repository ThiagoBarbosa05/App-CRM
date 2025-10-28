import { Request, Response } from "express";
import { clientsService } from "../../services/clients.service";

/**
 * Controller para buscar cliente específico por telefone
 * Responsável por gerenciar a requisição HTTP e formatação da resposta
 */
export const getClientByPhoneController = async (
  req: Request,
  res: Response
) => {
  try {
    // Extrair telefone dos parâmetros da URL
    const { phone } = req.params;

    // Executar busca através do service
    const client = await clientsService.getClientByPhone(phone);

    // Se cliente não encontrado, retornar 404
    if (!client) {
      return res.status(404).json({
        message: "Cliente não encontrado",
      });
    }

    // Retornar cliente encontrado
    res.json(client);
  } catch (error) {
    console.error("Erro no getClientByPhoneController:", error);

    // Tratamento de diferentes tipos de erro
    if (error instanceof Error) {
      if (error.message.includes("Número de telefone é obrigatório")) {
        return res.status(400).json({
          message: error.message,
          error: "INVALID_PHONE_PARAMETER",
        });
      }
    }

    // Erro genérico - mantém comportamento original
    res.status(500).json({
      message: "Erro ao buscar cliente por telefone",
    });
  }
};
