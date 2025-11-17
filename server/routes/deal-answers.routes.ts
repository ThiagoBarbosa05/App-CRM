import { Router } from "express";
import { z } from "zod";
import { validateParams, validateBody } from "../middleware/validation";
import { getDealAnswersController } from "../controllers/deal-answers/get-deal-answers.controller";
import { saveDealAnswersController } from "../controllers/deal-answers/save-deal-answers.controller";
import { getDealWithAnswersController } from "server/controllers/deal-answers/get-deal-with-answers.controller";

/**
 * Router para gerenciamento de respostas de deals
 *
 * Este módulo contém todas as rotas relacionadas às respostas de deals,
 * seguindo o padrão de arquitetura modular Controller-Service-Repository.
 *
 * Rotas disponíveis:
 * - GET /deals/:dealId/answers - Busca respostas de um deal específico
 * - POST /deals/:dealId/answers - Salva/atualiza respostas de um deal
 * - GET /deals/:dealId/complete - Busca deal completo com todas as respostas
 *
 * Middleware aplicado:
 * - validateParams: Validação de parâmetros da URL
 * - Tratamento de erros centralizado
 */
export const dealAnswersRouter = Router();

/**
 * Schema de validação para parâmetros de deal answers
 */
const dealAnswersParamsSchema = z.object({
  dealId: z.string().uuid("ID do deal deve ser um UUID válido"),
});

/**
 * Schema de validação para body de salvamento de respostas
 */
const saveDealAnswersBodySchema = z.object({
  answers: z
    .array(
      z
        .object({
          dealId: z.string().uuid("ID do deal deve ser um UUID válido"),
          questionId: z.string().uuid("ID da pergunta deve ser um UUID válido"),
          answerBoolean: z.boolean().optional(),
          answerNumber: z
            .union([z.string(), z.number()])
            .optional()
            .nullable()
            .transform((val) => {
              if (val === null || val === undefined || val === "")
                return undefined;
              const num = typeof val === "string" ? parseFloat(val) : val;
              return isNaN(num) ? undefined : num.toString();
            }),
          answerText: z
            .string()
            .optional()
            .nullable()
            .transform((val) => {
              if (val === null || val === "" || val === undefined)
                return undefined;
              return val;
            }),
        })
        .refine(
          (data) => {
            // Garantir que apenas um campo de resposta esteja preenchido
            const hasBoolean = typeof data.answerBoolean === "boolean";
            const hasNumber =
              data.answerNumber !== undefined && data.answerNumber !== "";
            const hasText =
              data.answerText !== undefined && data.answerText !== "";

            const filledFields = [hasBoolean, hasNumber, hasText].filter(
              Boolean
            ).length;

            return filledFields === 1;
          },
          {
            message: "Apenas um campo de resposta deve estar preenchido",
          }
        )
    )
    .min(1, "Pelo menos uma resposta deve ser fornecida"),
});

/**
 * GET /api/deals/:dealId/answers
 *
 * Busca todas as respostas de um deal específico
 *
 * Esta rota permite recuperar todas as respostas associadas a um deal,
 * incluindo as respostas das perguntas configuradas no sistema.
 * As respostas são retornadas ordenadas por data de criação.
 *
 * Middleware aplicado:
 * - validateParams: Valida parâmetros da URL (ID do deal)
 *
 * @param {string} dealId - ID único do deal (UUID formato)
 *
 * Respostas:
 * - 200: Lista de respostas retornada com sucesso
 * - 400: Parâmetros inválidos ou missing
 * - 404: Deal não encontrado
 * - 500: Erro interno do servidor
 *
 * @example
 * GET /api/deals/123e4567-e89b-12d3-a456-426614174000/answers
 *
 * Response (200):
 * [
 *   {
 *     "id": "answer-uuid-1",
 *     "dealId": "123e4567-e89b-12d3-a456-426614174000",
 *     "questionId": "question-uuid-1",
 *     "answerText": "Resposta para pergunta de texto",
 *     "answerBoolean": null,
 *     "answerNumber": null,
 *     "createdAt": "2023-01-01T10:00:00Z",
 *     "updatedAt": "2023-01-01T10:00:00Z"
 *   },
 *   {
 *     "id": "answer-uuid-2",
 *     "dealId": "123e4567-e89b-12d3-a456-426614174000",
 *     "questionId": "question-uuid-2",
 *     "answerBoolean": true,
 *     "answerText": null,
 *     "answerNumber": null,
 *     "createdAt": "2023-01-01T10:01:00Z",
 *     "updatedAt": "2023-01-01T10:01:00Z"
 *   }
 * ]
 *
 * Response (404):
 * {
 *   "error": "Deal não encontrado"
 * }
 *
 * Funcionalidades:
 * - Busca todas as respostas associadas ao deal
 * - Validação de existência do deal
 * - Retorno ordenado por data de criação
 * - Tratamento de casos onde não há respostas (retorna array vazio)
 * - Suporte a diferentes tipos de resposta (texto, boolean, número)
 * - Validação de UUID para parâmetros
 * - Logs de erro para debugging
 * - Resposta consistente com padrões da API
 */
dealAnswersRouter.get(
  "/deals/:dealId/answers",
  validateParams(dealAnswersParamsSchema),
  getDealAnswersController
);

/**
 * POST /api/deals/:dealId/answers
 *
 * Salva ou atualiza respostas de um deal específico
 *
 * Esta rota permite salvar respostas para as perguntas configuradas no sistema.
 * Remove todas as respostas existentes do deal e insere as novas respostas,
 * garantindo consistência dos dados. Valida que todas as perguntas referenciadas
 * existem no sistema e que apenas um campo de resposta está preenchido por pergunta.
 *
 * Middleware aplicado:
 * - validateParams: Valida parâmetros da URL (ID do deal)
 * - validateBody: Valida estrutura e conteúdo do body da requisição
 *
 * @param {string} dealId - ID único do deal (UUID formato)
 * @param {object} body - Corpo da requisição com array de respostas
 *
 * Respostas:
 * - 200: Respostas salvas com sucesso
 * - 400: Parâmetros inválidos, perguntas não existem ou validação falhou
 * - 404: Deal não encontrado
 * - 500: Erro interno do servidor
 *
 * @example
 * POST /api/deals/123e4567-e89b-12d3-a456-426614174000/answers
 * Content-Type: application/json
 * {
 *   "answers": [
 *     {
 *       "questionId": "question-uuid-1",
 *       "answerText": "Resposta para pergunta de texto"
 *     },
 *     {
 *       "questionId": "question-uuid-2",
 *       "answerBoolean": true
 *     },
 *     {
 *       "questionId": "question-uuid-3",
 *       "answerNumber": "150.75"
 *     }
 *   ]
 * }
 *
 * Response (200):
 * [
 *   {
 *     "id": "answer-uuid-1",
 *     "dealId": "123e4567-e89b-12d3-a456-426614174000",
 *     "questionId": "question-uuid-1",
 *     "answerText": "Resposta para pergunta de texto",
 *     "answerBoolean": null,
 *     "answerNumber": null,
 *     "createdAt": "2023-01-01T10:00:00Z",
 *     "updatedAt": "2023-01-01T10:00:00Z"
 *   }
 * ]
 *
 * Response (400):
 * {
 *   "error": "Algumas perguntas não existem: question-invalid-1"
 * }
 *
 * Funcionalidades:
 * - Substitui todas as respostas existentes (upsert behavior)
 * - Validação de existência do deal
 * - Validação de existência de todas as perguntas referenciadas
 * - Suporte a diferentes tipos de resposta (texto, boolean, número)
 * - Transação para garantir consistência dos dados
 * - Validação de que apenas um campo de resposta por pergunta está preenchido
 * - Transformação automática de números para string
 * - Validação de UUID para parâmetros
 * - Logs de erro para debugging
 */
dealAnswersRouter.post(
  "/deals/:dealId/answers",
  validateParams(dealAnswersParamsSchema),
  validateBody(saveDealAnswersBodySchema),
  saveDealAnswersController
);

/**
 * GET /api/deals/:dealId/complete
 *
 * Busca um deal completo com todas as suas respostas
 *
 * Esta rota permite recuperar um deal com todas as informações,
 * incluindo todas as respostas associadas às perguntas configuradas.
 * É útil para visualização completa de um deal em uma única requisição.
 *
 * Middleware aplicado:
 * - validateParams: Valida parâmetros da URL (ID do deal)
 *
 * @param {string} dealId - ID único do deal (UUID formato)
 *
 * Respostas:
 * - 200: Deal completo retornado com sucesso
 * - 400: Parâmetros inválidos
 * - 404: Deal não encontrado
 * - 500: Erro interno do servidor
 *
 * @example
 * GET /api/deals/123e4567-e89b-12d3-a456-426614174000/complete
 *
 * Response (200):
 * {
 *   "id": "123e4567-e89b-12d3-a456-426614174000",
 *   "title": "Negócio - Cliente X",
 *   "value": "5000.00",
 *   "funnelId": "funnel-uuid",
 *   "stageId": "stage-uuid",
 *   "clientId": "client-uuid",
 *   "assignedTo": "user-uuid",
 *   "createdAt": "2023-01-01T10:00:00Z",
 *   "answers": [
 *     {
 *       "id": "answer-uuid-1",
 *       "dealId": "123e4567-e89b-12d3-a456-426614174000",
 *       "questionId": "question-uuid-1",
 *       "answerText": "Resposta 1",
 *       "createdAt": "2023-01-01T10:00:00Z"
 *     }
 *   ]
 * }
 *
 * Response (404):
 * {
 *   "error": "Deal não encontrado"
 * }
 *
 * Funcionalidades:
 * - Busca deal com todos os campos
 * - Inclui todas as respostas em um único objeto
 * - Respostas ordenadas por data de criação
 * - Validação de UUID para parâmetros
 * - Reduz número de requisições HTTP necessárias
 */
dealAnswersRouter.get(
  "/deals/:dealId/complete",
  validateParams(dealAnswersParamsSchema),
  getDealWithAnswersController
);

// TODO: Migrar outras rotas de deal-answers para este arquivo:
// - ✅ POST /deals/:dealId/answers (MIGRADO - salvar/atualizar respostas)
// - ✅ GET /deals/:dealId/complete (MIGRADO - deal completo com respostas)

export default dealAnswersRouter;
