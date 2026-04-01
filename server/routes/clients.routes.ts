import { Router } from "express";
import { getClientsController } from "../controllers/clients/get-clients.controller";
import { getClientByPhoneController } from "../controllers/clients/get-client-by-phone.controller";
import { getClientsWithoutContactController } from "../controllers/clients/get-clients-without-contact.controller";
import { getClientsExportAllController } from "../controllers/clients/get-clients-export-all.controller";
import { postClientController } from "../controllers/clients/post-client.controller";
import { putClientController } from "../controllers/clients/put-client.controller";
import { deleteClientController } from "../controllers/clients/delete-client.controller";
import { deleteClientsBulkController } from "../controllers/clients/delete-clients-bulk.controller";
import { confirmClientController } from "../controllers/clients/confirm-client.controller";
import { getClientInteractionsController } from "../controllers/clients/get-client-interactions.controller";
import { getClientFunnelsController } from "../controllers/clients/get-client-funnels.controller";
import { getClientByIdController } from "../controllers/clients/get-client-by-id.controller";

/**
 * Router específico para endpoints relacionados a clientes
 * Segue padrão RESTful e organiza todas as rotas de clientes
 */
export const clientsRouter = Router();

/**
 * @route GET /api/clients
 * @description Busca clientes com filtros, paginação e controle de acesso
 * @access Private (baseado em role do usuário)
 * @queryParams {string} [search] - Busca geral por nome, email, telefone ou CPF
 * @queryParams {string} [name] - Filtro por nome
 * @queryParams {string} [phone] - Filtro por telefone
 * @queryParams {string} [cpf] - Filtro por CPF
 * @queryParams {string} [responsavelId] - Filtro por responsável
 * @queryParams {string} [categoria] - Filtro por categoria
 * @queryParams {string} [origem] - Filtro por origem
 * @queryParams {string} [markers] - Filtro por marcadores
 * @queryParams {number} [page=1] - Número da página
 * @queryParams {number} [pageSize=100] - Tamanho da página (máx: 1000)
 * @headerParams {string} [x-user-id] - ID do usuário logado
 * @headerParams {string} [x-user-role] - Role do usuário (vendedor/gerente/admin)
 * @returns {object} Lista paginada de clientes
 */
clientsRouter.get("/", getClientsController);

/**
 * @route GET /api/clients/by-phone/:phone
 * @description Busca cliente específico por número de telefone
 * @access Private
 * @urlParams {string} phone - Número de telefone do cliente
 * @returns {object} Cliente encontrado ou erro 404
 */
clientsRouter.get("/by-phone/:phone", getClientByPhoneController);

/**
 * @route GET /api/clients/without-contact
 * @description Busca clientes sem contato recente baseado em dias
 * @access Private (baseado em role do usuário)
 * @queryParams {string} [userId] - ID do usuário (ou via header x-user-id)
 * @queryParams {string} [userRole] - Role do usuário (ou via header x-user-role)
 * @queryParams {number} [days=1] - Número de dias sem contato (entre 1 e 365)
 * @headerParams {string} [x-user-id] - ID do usuário logado
 * @headerParams {string} [x-user-role] - Role do usuário (vendedor/gerente/admin)
 * @returns {array} Lista de clientes sem contato recente
 */
clientsRouter.get("/without-contact", getClientsWithoutContactController);

/**
 * @route GET /api/clients/export-all
 * @description Exporta todos os clientes do sistema (apenas para administradores)
 * @access Admin only
 * @headerParams {string} x-user-role - Role do usuário (deve ser "admin" ou "administrador")
 * @returns {array} Lista completa de clientes para exportação
 * @returns {object} 403 - Acesso negado se não for administrador
 * @returns {object} 500 - Erro interno do servidor
 */
clientsRouter.get("/export-all", getClientsExportAllController);

/**
 * @route GET /api/clients/:id
 * @description Busca um cliente específico por ID
 * @access Private
 * @urlParams {string} id - ID do cliente
 * @returns {object} Cliente encontrado ou erro 404
 */
clientsRouter.get("/:id", getClientByIdController);

/**
 * @route GET /api/clients/:clientId/interactions
 * @description Busca as interações de um cliente
 * @access Private
 * @urlParams {string} clientId - ID do cliente
 * @returns {array} Lista de interações do cliente
 */
clientsRouter.get("/:clientId/interactions", getClientInteractionsController);

/**
 * @route GET /api/clients/:clientId/funnels
 * @description Busca os funis associados a um cliente
 * @access Private
 * @urlParams {string} clientId - ID do cliente
 * @returns {array} Lista de funis do cliente
 */
clientsRouter.get("/:clientId/funnels", getClientFunnelsController);

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
 * @returns {object} 201 - Cliente criado com sucesso
 * @returns {object} 400 - Erro de validação ou telefone duplicado
 * @returns {object} 500 - Erro interno do servidor
 */
clientsRouter.post("/", postClientController);

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
 * @returns {object} 200 - Cliente atualizado com sucesso
 * @returns {object} 400 - Erro de validação ou telefone duplicado
 * @returns {object} 404 - Cliente não encontrado
 * @returns {object} 500 - Erro interno do servidor
 */
clientsRouter.put("/:id", putClientController);

/**
 * @route POST /api/clients/:id/confirm
 * @description Confirma o cadastro de um cliente validando o código de confirmação
 * @access Private
 * @urlParams {string} id - ID do cliente a ser confirmado (obrigatório)
 * @bodyParams {string} confirmationCode - Código de confirmação de 6 dígitos (obrigatório)
 * @returns {object} 200 - Cliente confirmado com sucesso
 * @returns {object} 400 - Erro de validação ou código inválido
 * @returns {object} 404 - Cliente não encontrado
 * @returns {object} 500 - Erro interno do servidor
 */
clientsRouter.post("/:id/confirm", confirmClientController);

/**
 * @route DELETE /api/clients/:id
 * @description Exclui um cliente existente do sistema e todos os dados relacionados
 * @access Private
 * @urlParams {string} id - ID do cliente a ser excluído (obrigatório)
 * @returns {object} 200 - Cliente e dados relacionados excluídos com sucesso
 * @returns {object} 404 - Cliente não encontrado
 * @returns {object} 500 - Erro interno do servidor
 * @warning Esta operação é irreversível e exclui:
 *   - Usos de cashback
 *   - Saldo de cashback
 *   - Transações de cashback
 *   - Deals associados
 *   - Interações do cliente
 *   - O cliente em si
 */
clientsRouter.delete("/:id", deleteClientController);

/**
 * @route DELETE /api/clients
 * @description Exclusão em lote de clientes (APENAS ADMIN)
 * @access Private (admin only)
 * @bodyParams {string[]} clientIds - Array de IDs dos clientes para exclusão
 * @example Body: { "clientIds": ["client1", "client2", "client3"] }
 * @returns {Object} Status da operação com contagem de exclusões
 * @security Requer role 'admin' para acesso
 * @notes
 *   - Máximo de 100 clientes por operação
 *   - Realiza exclusão em cascata de todos os dados relacionados
 *   - Operação irreversível
 */
clientsRouter.delete("/", deleteClientsBulkController);

// TODO: Migrar outras rotas de clientes para este arquivo:
// - ✅ GET /clients/by-phone/:phone (MIGRADO)
// - ✅ GET /clients/without-contact (MIGRADO)
// - ✅ GET /clients/export-all (MIGRADO)
// - ✅ GET /clients/:id (MIGRADO)
// - ✅ POST /clients (MIGRADO)
// - ✅ PUT /clients/:id (MIGRADO)
// - ✅ DELETE /clients/:id (MIGRADO)
// - ✅ DELETE /clients (MIGRADO)
// - GET /clients/:clientId/interactions
// - GET /clients/:clientId/funnels
// - POST /clients/import
