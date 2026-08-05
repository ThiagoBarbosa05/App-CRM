import { Request, Response } from "express";
import { clientsService } from "../../services/clients.service";
import { respondWithClientError } from "./handle-client-error";

/**
 * @route POST /api/clients
 * @description Cria um novo cliente no sistema
 * @access Private (baseado em role do usuário)
 * @bodyParams {string} name - Nome completo do cliente (obrigatório)
 * @bodyParams {string} phone - Telefone do cliente (obrigatório, único)
 * @bodyParams {string} [email] - Email do cliente (opcional)
 * @bodyParams {string} [cpf] - CPF do cliente (opcional)
 * @bodyParams {string} [birthday] - Data de nascimento (opcional)
 * @bodyParams {string} [categoria="Geral"] - Categoria do cliente (default: "Geral")
 * @bodyParams {string} [origem="Website"] - Origem do lead (default: "Website")
 * @bodyParams {string} [responsavelId] - ID do responsável (se não admin, usa usuário atual)
 * @bodyParams {string[]} [markers=[]] - Array de marcadores/tags
 * @queryParams {string} [userId] - ID do usuário (ou via header x-user-id)
 * @queryParams {string} [userRole] - Role do usuário (ou via header x-user-role)
 * @headerParams {string} [x-user-id] - ID do usuário logado
 * @headerParams {string} [x-user-role] - Role do usuário (vendedor/admin)
 * @returns {Object} 201 - Cliente criado com sucesso
 * @returns {Object} 400 - Erro de validação (com `errors[]` por campo)
 * @returns {Object} 409 - Telefone, CPF/CNPJ ou e-mail já cadastrado
 * @returns {Object} 500 - Erro interno do servidor
 */
export const postClientController = async (req: Request, res: Response) => {
  try {
    // Processar parâmetros da requisição
    const createClientParams = clientsService.processCreateClientParams(req);

    // Criar cliente através do service
    const client = await clientsService.createClient(createClientParams);

    res.status(201).json(client);
  } catch (error) {
    respondWithClientError(res, error, "create");
  }
};
