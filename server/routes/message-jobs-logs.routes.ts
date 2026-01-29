import { Router } from "express";
import { getMessageJobsLogsController } from "../controllers/get-message-jobs-logs.controller";
import { createMessageJobsLogController } from "../controllers/create-message-jobs-logs.controller";
import { updateMessageJobsLogController } from "../controllers/update-message-jobs-logs.controller";
import { deleteMessageJobsLogController } from "../controllers/delete-message-jobs-logs.controller";

/**
 * Router específico para endpoints relacionados a logs de jobs de mensagens
 * Gerencia histórico de envio de mensagens automáticas (aniversários, etc)
 */
export const messageJobsLogsRouter = Router();

/**
 * @route GET /api/message-jobs-logs
 * @description Busca logs de jobs de mensagens com filtros e paginação
 * @access Private
 * @queryParams {string} [automationId] - Filtro por ID da automação
 * @queryParams {string} [status] - Filtro por status (agendado, enviado, falhou)
 * @queryParams {number} [page=1] - Número da página
 * @queryParams {number} [pageSize=20] - Tamanho da página
 * @returns {object} Lista paginada de logs com total e informações de paginação
 */
messageJobsLogsRouter.get("/", getMessageJobsLogsController);

/**
 * @route POST /api/message-jobs-logs
 * @description Cria um novo log de job de mensagem
 * @access Private
 * @bodyParams {string} automationId - ID da automação
 * @bodyParams {string} clientId - ID do cliente
 * @bodyParams {string} scheduledSendAt - Data/hora agendada para envio
 * @bodyParams {string} [status=agendado] - Status inicial do log
 * @bodyParams {number} [attempts=0] - Número de tentativas de envio
 * @returns {object} Log criado com status 201
 */
messageJobsLogsRouter.post("/", createMessageJobsLogController);

/**
 * @route PUT /api/message-jobs-logs/:id
 * @description Atualiza um log de job de mensagem existente
 * @access Private
 * @urlParams {string} id - ID do log a ser atualizado
 * @bodyParams {string} [status] - Novo status (agendado, enviado, falhou)
 * @bodyParams {string} [actualSendAt] - Data/hora real de envio
 * @bodyParams {number} [attempts] - Número atualizado de tentativas
 * @bodyParams {string} [lastError] - Mensagem de erro da última tentativa
 * @bodyParams {string} [externalId] - ID externo (da API Umbler, por exemplo)
 * @returns {object} Log atualizado
 */
messageJobsLogsRouter.put("/:id", updateMessageJobsLogController);

/**
 * @route DELETE /api/message-jobs-logs/:id
 * @description Remove um log de job de mensagem
 * @access Private
 * @urlParams {string} id - ID do log a ser removido
 * @returns {object} Mensagem de sucesso e log deletado
 */
messageJobsLogsRouter.delete("/:id", deleteMessageJobsLogController);
