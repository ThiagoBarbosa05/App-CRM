import { Request, Response } from "express";
import { dealAnswersService } from "../../services/deal-answers.service";

/**
 * Controlador para busca de respostas de deal
 *
 * Esta função gerencia requisições GET para /api/deals/:dealId/answers,
 * processando os parâmetros da requisição através do service layer
 * e retornando uma resposta HTTP apropriada.
 *
 * @route GET /api/deals/:dealId/answers
 * @param req - Objeto de requisição Express
 * @param res - Objeto de resposta Express
 * @returns Promise<Response> - Resposta HTTP
 *
 * @throws {400} Quando parâmetros são inválidos
 * @throws {404} Quando deal não é encontrado
 * @throws {500} Quando ocorre erro interno do servidor
 *
 * @example
 * // Requisição
 * GET /api/deals/123e4567-e89b-12d3-a456-426614174000/answers
 *
 * // Resposta de sucesso
 * HTTP 200 OK
 * [
 *   {
 *     "id": "answer-1",
 *     "dealId": "deal-123",
 *     "questionId": "question-1",
 *     "answerText": "Resposta exemplo",
 *     "createdAt": "2023-01-01T00:00:00Z"
 *   }
 * ]
 *
 * // Resposta de erro (deal não encontrado)
 * HTTP 404 Not Found
 * {
 *   "error": "Deal não encontrado"
 * }
 */
export async function getDealAnswersController(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    // Processar parâmetros da requisição através do service
    const params = dealAnswersService.processGetDealAnswersParams(req);

    // Executar busca das respostas
    const answers = await dealAnswersService.getDealAnswers(params);

    // Retornar lista de respostas
    return res.status(200).json(answers);
  } catch (error) {
    // Log do erro para debugging
    console.error("Erro no controller de busca de respostas:", error);

    // Tratamento de erros específicos
    if (error instanceof Error) {
      // Erro de deal não encontrado
      if (error.message.includes("não encontrado")) {
        return res.status(404).json({
          error: error.message,
        });
      }

      // Erro de validação
      if (error.message.includes("obrigatório")) {
        return res.status(400).json({
          error: error.message,
        });
      }
    }

    // Erro interno do servidor
    return res.status(500).json({
      error: "Erro interno do servidor ao buscar respostas",
    });
  }
}
