import { Request, Response } from "express";
import { clientsService } from "../../services/clients.service";

/**
 * @route DELETE /api/clients/:id
 * @description Exclui um cliente existente do sistema
 * @access Private
 * @urlParams {string} id - ID do cliente a ser excluído (obrigatório)
 * @returns {Object} 200 - Cliente e dados relacionados excluídos com sucesso
 * @returns {Object} 404 - Cliente não encontrado
 * @returns {Object} 500 - Erro interno do servidor
 */
export const deleteClientController = async (req: Request, res: Response) => {
  try {
    // Processar parâmetros da requisição
    const deleteClientParams = clientsService.processDeleteClientParams(req);

    // Excluir cliente através do service
    const success = await clientsService.deleteClient(deleteClientParams);

    if (success) {
      res.status(200).json({
        message: "Cliente e dados relacionados excluídos com sucesso",
      });
    }
  } catch (error) {
    console.error("Erro no deleteClientController:", error);

    // Tratamento específico para cliente não encontrado
    if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") {
      return res.status(404).json({
        message: "Cliente não encontrado",
      });
    }

    // Erro genérico do servidor
    res.status(500).json({
      message: "Erro ao excluir cliente",
    });
  }
};
