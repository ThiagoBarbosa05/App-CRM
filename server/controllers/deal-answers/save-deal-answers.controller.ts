import { Request, Response } from "express";
import { dealAnswersService } from "../../services/deal-answers.service";

/**
 * Controlador para salvamento de respostas de deal
 *
 * Esta função gerencia requisições POST para /api/deals/:dealId/answers,
 * processando os parâmetros da requisição através do service layer
 * e retornando uma resposta HTTP apropriada.
 *
 * @route POST /api/deals/:dealId/answers
 * @param req - Objeto de requisição Express
 * @param res - Objeto de resposta Express
 * @returns Promise<Response> - Resposta HTTP
 *
 * @throws {400} Quando parâmetros são inválidos ou perguntas não existem
 * @throws {404} Quando deal não é encontrado
 * @throws {500} Quando ocorre erro interno do servidor
 *
 * @example
 * // Requisição
 * POST /api/deals/123e4567-e89b-12d3-a456-426614174000/answers
 * Content-Type: application/json
 * {
 *   "answers": [
 *     {
 *       "questionId": "question-uuid-1",
 *       "answerText": "Resposta de texto"
 *     },
 *     {
 *       "questionId": "question-uuid-2",
 *       "answerBoolean": true
 *     }
 *   ]
 * }
 *
 * // Resposta de sucesso
 * HTTP 200 OK
 * [
 *   {
 *     "id": "answer-uuid-1",
 *     "dealId": "123e4567-e89b-12d3-a456-426614174000",
 *     "questionId": "question-uuid-1",
 *     "answerText": "Resposta de texto",
 *     "answerBoolean": null,
 *     "answerNumber": null,
 *     "createdAt": "2023-01-01T10:00:00Z",
 *     "updatedAt": "2023-01-01T10:00:00Z"
 *   }
 * ]
 *
 * // Resposta de erro (perguntas inválidas)
 * HTTP 400 Bad Request
 * {
 *   "error": "Algumas perguntas não existem: question-invalid-1"
 * }
 */
export async function saveDealAnswersController(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    // Processar parâmetros da requisição através do service
    const params = dealAnswersService.processSaveDealAnswersParams(req);

    // Executar salvamento das respostas
    const savedAnswers = await dealAnswersService.saveDealAnswers(params);

    // Retornar respostas salvas
    return res.status(200).json(savedAnswers);
  } catch (error) {
    // Log do erro para debugging
    console.error("Erro no controller de salvamento de respostas:", error);

    // Tratamento de erros específicos
    if (error instanceof Error) {
      // Erro de deal não encontrado
      if (error.message.includes("não encontrado")) {
        return res.status(404).json({
          error: error.message,
        });
      }

      // Erro de validação (perguntas não existem, dados obrigatórios, etc.)
      if (
        error.message.includes("obrigatório") ||
        error.message.includes("não existem") ||
        error.message.includes("pelo menos uma")
      ) {
        return res.status(400).json({
          error: error.message,
        });
      }
    }

    // Erro interno do servidor
    return res.status(500).json({
      error: "Erro interno do servidor ao salvar respostas",
    });
  }
}
