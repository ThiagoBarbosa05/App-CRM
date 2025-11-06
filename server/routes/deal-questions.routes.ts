import { Router } from "express";
import {
  validateQuery,
  validateBody,
  validateParams,
  requireAuth,
  dealQuestionsQuerySchema,
  dealQuestionParamsSchema,
} from "../middleware/validation";
import {
  insertDealQuestionSchema,
  updateDealQuestionSchema,
} from "../../shared/schema";
import { getDealQuestionsController } from "../controllers/deal-questions/get-deal-questions.controller";
import { createDealQuestionController } from "../controllers/deal-questions/post-deal-question.controller";
import { updateDealQuestionController } from "../controllers/deal-questions/put-deal-question.controller";
import { deleteDealQuestionController } from "../controllers/deal-questions/delete-deal-question.controller";

/**
 * Router específico para endpoints relacionados a perguntas de deals
 * Segue padrão RESTful e organiza todas as rotas de deal-questions
 */
export const dealQuestionsRouter = Router();

/**
 * @route GET /api/deal-questions
 * @description Busca todas as perguntas de deals com filtros opcionais
 * @access Private (requer autenticação via middleware)
 * @queryParams {string} [category] - Categoria da pergunta para filtrar (opcional)
 * @queryParams {string} [isActive] - Status ativo da pergunta: "true" ou "false" (opcional)
 * @returns {Array} Lista de perguntas de deals ordenada por displayOrder e createdAt
 * @example Query Parameters:
 * - GET /api/deal-questions (todas as perguntas)
 * - GET /api/deal-questions?category=qualificacao (perguntas da categoria qualificacao)
 * - GET /api/deal-questions?isActive=true (apenas perguntas ativas)
 * - GET /api/deal-questions?category=qualificacao&isActive=true (combinação de filtros)
 * @example Response:
 * [
 *   {
 *     "id": "question-1",
 *     "question": "Qual é o orçamento disponível para este projeto?",
 *     "category": "qualificacao",
 *     "type": "text",
 *     "isRequired": true,
 *     "isActive": true,
 *     "displayOrder": 1,
 *     "options": null,
 *     "placeholder": "Ex: R$ 50.000,00",
 *     "helpText": "Informe o valor aproximado do orçamento",
 *     "createdAt": "2023-01-01T00:00:00.000Z",
 *     "updatedAt": "2023-01-01T00:00:00.000Z"
 *   },
 *   {
 *     "id": "question-2",
 *     "question": "Qual é o prazo esperado para conclusão?",
 *     "category": "timeline",
 *     "type": "select",
 *     "isRequired": true,
 *     "isActive": true,
 *     "displayOrder": 2,
 *     "options": ["1-3 meses", "3-6 meses", "6-12 meses", "Mais de 1 ano"],
 *     "placeholder": null,
 *     "helpText": "Selecione o prazo mais adequado",
 *     "createdAt": "2023-01-01T00:00:00.000Z",
 *     "updatedAt": "2023-01-01T00:00:00.000Z"
 *   }
 * ]
 * @notes
 *   - Perguntas são retornadas ordenadas por displayOrder (ordem de exibição) e depois por createdAt
 *   - Filtros são opcionais e podem ser combinados
 *   - isActive="true" retorna apenas perguntas ativas, isActive="false" apenas inativas
 *   - category filtra perguntas de uma categoria específica (ex: "qualificacao", "timeline", "technical")
 *   - Validação de query parameters é feita via middleware validateQuery
 *   - Usado para configurar questionários dinâmicos em deals/negócios
 *   - Perguntas inativas (isActive=false) são mantidas no sistema mas não exibidas por padrão
 */
dealQuestionsRouter.get(
  "/",
  validateQuery(dealQuestionsQuerySchema),
  getDealQuestionsController
);

/**
 * @route POST /api/deal-questions
 * @description Cria uma nova pergunta de deal no sistema
 * @access Private (requer autenticação)
 * @bodyParams {Object} question - Dados da pergunta a ser criada
 * @bodyParams {string} question.question - Texto da pergunta (obrigatório)
 * @bodyParams {string} question.category - Categoria da pergunta (obrigatório)
 * @bodyParams {string} question.type - Tipo da pergunta: text, select, textarea, number, email, etc. (obrigatório)
 * @bodyParams {boolean} [question.isRequired=false] - Se a pergunta é obrigatória
 * @bodyParams {boolean} [question.isActive=true] - Se a pergunta está ativa
 * @bodyParams {number} [question.displayOrder] - Ordem de exibição da pergunta
 * @bodyParams {string[]} [question.options] - Opções para perguntas do tipo select/radio
 * @bodyParams {string} [question.placeholder] - Texto de placeholder para o campo
 * @bodyParams {string} [question.helpText] - Texto de ajuda/instrução para a pergunta
 * @returns {Object} Pergunta criada com ID gerado
 * @example Request Body:
 * {
 *   "question": "Qual é o orçamento disponível para este projeto?",
 *   "category": "qualificacao",
 *   "type": "text",
 *   "isRequired": true,
 *   "isActive": true,
 *   "displayOrder": 1,
 *   "placeholder": "Ex: R$ 50.000,00",
 *   "helpText": "Informe o valor aproximado do orçamento"
 * }
 * @example Response:
 * {
 *   "id": "question-abc123",
 *   "question": "Qual é o orçamento disponível para este projeto?",
 *   "category": "qualificacao",
 *   "type": "text",
 *   "isRequired": true,
 *   "isActive": true,
 *   "displayOrder": 1,
 *   "options": null,
 *   "placeholder": "Ex: R$ 50.000,00",
 *   "helpText": "Informe o valor aproximado do orçamento",
 *   "createdAt": "2023-01-01T00:00:00.000Z",
 *   "updatedAt": "2023-01-01T00:00:00.000Z"
 * }
 * @notes
 *   - Validação completa via Zod schema (insertDealQuestionSchema)
 *   - ID é gerado automaticamente via UUID
 *   - createdAt e updatedAt são definidos automaticamente
 *   - Requer autenticação de usuário (middleware requireAuth)
 *   - Tipos suportados: text, select, textarea, number, email, phone, url, date
 *   - Para perguntas do tipo select/radio, o campo options deve conter as opções
 *   - displayOrder determina a ordem de exibição no questionário
 *   - Perguntas inativas (isActive=false) não são exibidas por padrão
 *   - Usado para configurar questionários dinâmicos personalizados
 */
dealQuestionsRouter.post(
  "/",
  requireAuth,
  validateBody(insertDealQuestionSchema),
  createDealQuestionController
);

/**
 * @route PUT /api/deal-questions/:id
 * @description Atualiza uma pergunta de deal existente
 * @access Private (requer autenticação)
 * @pathParams {string} id - UUID da pergunta a ser atualizada (obrigatório)
 * @bodyParams {Object} question - Dados parciais da pergunta para atualização
 * @bodyParams {string} [question.question] - Texto da pergunta
 * @bodyParams {string} [question.category] - Categoria da pergunta
 * @bodyParams {string} [question.type] - Tipo da pergunta: text, select, textarea, etc.
 * @bodyParams {boolean} [question.isRequired] - Se a pergunta é obrigatória
 * @bodyParams {boolean} [question.isActive] - Se a pergunta está ativa
 * @bodyParams {number} [question.displayOrder] - Ordem de exibição da pergunta
 * @bodyParams {string[]} [question.options] - Opções para perguntas do tipo select/radio
 * @bodyParams {string} [question.placeholder] - Texto de placeholder para o campo
 * @bodyParams {string} [question.helpText] - Texto de ajuda/instrução para a pergunta
 * @returns {Object} Pergunta atualizada
 * @example Request Body:
 * {
 *   "question": "Qual é o orçamento disponível? (atualizado)",
 *   "isActive": false,
 *   "helpText": "Por favor, forneça uma estimativa do orçamento total"
 * }
 * @example Response:
 * {
 *   "id": "question-abc123",
 *   "question": "Qual é o orçamento disponível? (atualizado)",
 *   "category": "qualificacao",
 *   "type": "text",
 *   "isRequired": true,
 *   "isActive": false,
 *   "displayOrder": 1,
 *   "options": null,
 *   "placeholder": "Ex: R$ 50.000,00",
 *   "helpText": "Por favor, forneça uma estimativa do orçamento total",
 *   "createdAt": "2023-01-01T00:00:00.000Z",
 *   "updatedAt": "2023-01-01T15:30:00.000Z"
 * }
 * @notes
 *   - Atualização parcial: apenas campos fornecidos são atualizados
 *   - Validação de ID via middleware validateParams (deve ser UUID válido)
 *   - Validação de body via middleware validateBody (updateDealQuestionSchema)
 *   - Pergunta deve existir para ser atualizada (retorna 404 se não encontrada)
 *   - updatedAt é automaticamente atualizado para data/hora atual
 *   - Campos não fornecidos permanecem inalterados
 *   - Requer autenticação de usuário
 *   - Usado para ajustar questionários existentes sem recriar do zero
 *   - Alterações em perguntas ativas podem afetar deals em andamento
 */
dealQuestionsRouter.put(
  "/:id",
  validateParams(dealQuestionParamsSchema),
  validateBody(updateDealQuestionSchema),
  updateDealQuestionController
);

/**
 * DELETE /api/deal-questions/:id
 *
 * Exclui uma pergunta de deal existente
 *
 * Esta rota permite a exclusão de uma pergunta específica do sistema de perguntas de deals.
 * A exclusão é feita através do ID da pergunta, e todas as respostas relacionadas são
 * automaticamente excluídas devido ao cascade delete configurado no banco de dados.
 *
 * Middleware aplicado:
 * - requireAuth: Valida autenticação do usuário
 * - validateParams: Valida parâmetros da URL (ID da pergunta)
 *
 * @param {string} id - ID único da pergunta (UUID formato)
 *
 * Respostas:
 * - 204: Pergunta excluída com sucesso (sem conteúdo)
 * - 400: Parâmetros inválidos ou missing
 * - 401: Usuário não autenticado
 * - 404: Pergunta não encontrada
 * - 500: Erro interno do servidor
 *
 * @example
 * DELETE /api/deal-questions/123e4567-e89b-12d3-a456-426614174000
 *
 * Response (204):
 * // Sem conteúdo - pergunta excluída com sucesso
 *
 * Response (404):
 * {
 *   "error": "Pergunta não encontrada"
 * }
 */
dealQuestionsRouter.delete(
  "/:id",

  validateParams(dealQuestionParamsSchema),
  deleteDealQuestionController
);

// TODO: Migrar outras rotas de deal-questions para este arquivo:
// - ✅ GET /deal-questions (MIGRADO - busca de perguntas)
// - ✅ POST /deal-questions (MIGRADO - criação de pergunta)
// - ✅ PUT /deal-questions/:id (MIGRADO - atualização de pergunta)
// - ✅ DELETE /deal-questions/:id (MIGRADO - exclusão de pergunta)
// - GET /deal-questions/stats (estatísticas de perguntas)
// - POST /deal-questions/seed (popular perguntas padrão)

export default dealQuestionsRouter;
