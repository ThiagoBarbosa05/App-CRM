import { Request, Response } from "express";
import { clientsService } from "../../services/clients.service";

/**
 * @route GET /api/clients/export-all
 * @description Exporta todos os clientes do sistema
 * @access Admin only
 * @param {Object} req - Request object
 * @param {Object} req.headers - Request headers
 * @param {string} req.headers["x-user-role"] - Role do usuário logado
 * @returns {Object} 200 - Lista completa de clientes para exportação
 * @returns {Object} 403 - Acesso negado (não é admin)
 * @returns {Object} 500 - Erro interno do servidor
 */
export const getClientsExportAllController = async (
  req: Request,
  res: Response
) => {
  try {
    // Processar parâmetros da requisição
    const { userRole } = clientsService.processExportAllParams(req);

    // Buscar clientes através do service (já inclui validação de permissão)
    const clients = await clientsService.getAllClientsForExport(userRole);

    res.status(200).json(clients);
  } catch (error) {
    console.error("Erro no getClientsExportAllController:", error);

    // Tratamento específico para erro de permissão
    if (error instanceof Error && error.message.includes("Acesso negado")) {
      return res.status(403).json({
        message: error.message,
      });
    }

    // Erro genérico do servidor
    res.status(500).json({
      message: "Erro ao buscar dados para exportação",
    });
  }
};
