import { Request, Response } from "express";
import { clientsService } from "../../services/clients.service";
import { respondWithClientError } from "./handle-client-error";

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
 * @returns {Object} 400 - Erro de validação (com `errors[]` por campo)
 * @returns {Object} 404 - Cliente não encontrado
 * @returns {Object} 409 - Telefone, CPF/CNPJ ou e-mail já cadastrado
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
    respondWithClientError(res, error, "update");
  }
};
