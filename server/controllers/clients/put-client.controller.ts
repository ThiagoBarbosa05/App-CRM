import { Request, Response } from "express";
import { clientsService } from "../../services/clients.service";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

/**
 * @route PUT /api/clients/:id
 * @description Atualiza um cliente existente no sistema
 * @access Private (baseado em role do usuário)
 * @urlParams {string} id - ID do cliente a ser atualizado (obrigatório)
 * @bodyParams {string} [name] - Nome completo do cliente
 * @bodyParams {string} [phone] - Telefone do cliente (único)
 * @bodyParams {string} [email] - Email do cliente
 * @bodyParams {string} [cpf] - CPF do cliente
 * @bodyParams {string} [birthday] - Data de nascimento
 * @bodyParams {string} [categoria] - Categoria do cliente
 * @bodyParams {string} [origem] - Origem do lead
 * @bodyParams {string} [responsavelId] - ID do responsável (se não admin, usa usuário atual)
 * @bodyParams {string[]} [markers] - Array de marcadores/tags
 * @queryParams {string} [userId] - ID do usuário (ou via header x-user-id)
 * @queryParams {string} [userRole] - Role do usuário (ou via header x-user-role)
 * @headerParams {string} [x-user-id] - ID do usuário logado
 * @headerParams {string} [x-user-role] - Role do usuário (vendedor/admin)
 * @returns {Object} 200 - Cliente atualizado com sucesso
 * @returns {Object} 400 - Erro de validação ou telefone duplicado
 * @returns {Object} 404 - Cliente não encontrado
 * @returns {Object} 500 - Erro interno do servidor
 */
export const putClientController = async (req: Request, res: Response) => {
  try {
    // Processar parâmetros da requisição
    const updateClientParams = clientsService.processUpdateClientParams(req);

    // Atualizar cliente através do service
    const client = await clientsService.updateClient(updateClientParams);

    res.status(200).json(client);
  } catch (error) {
    console.error("Erro no putClientController:", error);

    // Tratamento específico para erros de validação Zod
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      console.error("Erro de validação Zod:", validationError.toString());
      return res.status(400).json({
        message: validationError.toString(),
      });
    }

    // Tratamento específico para cliente não encontrado
    if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") {
      return res.status(404).json({
        message: "Cliente não encontrado",
      });
    }

    // Tratamento específico para telefone duplicado
    if (
      error instanceof Error &&
      error.message.includes("telefone já está cadastrado")
    ) {
      return res.status(400).json({
        message: error.message,
      });
    }

    // Erro genérico do servidor
    res.status(500).json({
      message: "Erro ao atualizar cliente",
    });
  }
};
