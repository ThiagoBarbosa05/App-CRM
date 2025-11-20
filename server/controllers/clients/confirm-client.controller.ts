import { Request, Response } from "express";
import { clientsService } from "../../services/clients.service";

/**
 * @route POST /api/clients/:id/confirm
 * @description Confirma o cadastro de um cliente validando o código de confirmação
 * @access Private
 * @urlParams {string} id - ID do cliente a ser confirmado (obrigatório)
 * @bodyParams {string} confirmationCode - Código de confirmação de 6 dígitos (obrigatório)
 * @returns {Object} 200 - Cliente confirmado com sucesso
 * @returns {Object} 400 - Erro de validação ou código inválido
 * @returns {Object} 404 - Cliente não encontrado
 * @returns {Object} 500 - Erro interno do servidor
 */
export const confirmClientController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { confirmationCode } = req.body;

    // Validação básica
    if (!confirmationCode || typeof confirmationCode !== "string") {
      return res.status(400).json({
        message: "Código de confirmação é obrigatório",
      });
    }

    // Confirmar cliente através do service
    const result = await clientsService.confirmClient(id, confirmationCode);

    res.status(200).json(result);
  } catch (error) {
    console.error("Erro no confirmClientController:", error);

    // Tratamento específico para cliente não encontrado
    if (error instanceof Error && error.message === "Cliente não encontrado") {
      return res.status(404).json({
        message: error.message,
      });
    }

    // Tratamento específico para erros de validação
    if (
      error instanceof Error &&
      (error.message.includes("já foi confirmado") ||
        error.message.includes("inválido") ||
        error.message.includes("não foi gerado"))
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    // Erro genérico do servidor
    res.status(500).json({
      message: "Erro ao confirmar cliente",
    });
  }
};
