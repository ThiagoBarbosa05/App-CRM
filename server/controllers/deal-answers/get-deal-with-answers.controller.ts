import { Request, Response } from "express";
import { dealAnswersService } from "../../services/deal-answers.service";

/**
 * Controlador para busca de deal completo com respostas
 *
 * Esta função gerencia requisições GET para /api/deals/:dealId/complete,
 * processando os parâmetros da requisição através do service layer
 * e retornando uma resposta HTTP apropriada.
 *
 * @route GET /api/deals/:dealId/complete
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
 * GET /api/deals/123e4567-e89b-12d3-a456-426614174000/complete
 *
 * // Resposta de sucesso
 * HTTP 200 OK
 * {
 *   "id": "123e4567-e89b-12d3-a456-426614174000",
 *   "title": "Negócio - Cliente X",
 *   "value": "5000.00",
 *   "funnelId": "funnel-uuid",
 *   "stageId": "stage-uuid",
 *   "clientId": "client-uuid",
 *   "assignedTo": "user-uuid",
 *   "createdAt": "2023-01-01T10:00:00Z",
 *   "updatedAt": "2023-01-01T10:00:00Z",
 *   "answers": [
 *     {
 *       "id": "answer-uuid-1",
 *       "dealId": "123e4567-e89b-12d3-a456-426614174000",
 *       "questionId": "question-uuid-1",
 *       "answerText": "Resposta para pergunta",
 *       "answerBoolean": null,
 *       "answerNumber": null,
 *       "createdAt": "2023-01-01T10:00:00Z",
 *       "updatedAt": "2023-01-01T10:00:00Z"
 *     }
 *   ]
 * }
 *
 * // Resposta de erro (deal não encontrado)
 * HTTP 404 Not Found
 * {
 *   "error": "Deal não encontrado"
 * }
 */
export async function getDealWithAnswersController(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    // Processar parâmetros da requisição através do service
    const params = dealAnswersService.processGetDealAnswersParams(req);

    // Executar busca do deal completo
    const deal = await dealAnswersService.getDealWithAnswers(params);

    // Verificar se o deal foi encontrado
    if (!deal) {
      return res.status(404).json({
        error: "Deal não encontrado",
      });
    }

    // Retornar deal completo com respostas
    return res.status(200).json(deal);
  } catch (error) {
    // Log do erro para debugging
    console.error("Erro no controller de busca de deal completo:", error);

    // Tratamento de erros específicos
    if (error instanceof Error) {
      // Erro de validação
      if (error.message.includes("obrigatório")) {
        return res.status(400).json({
          error: error.message,
        });
      }
    }

    // Erro interno do servidor
    return res.status(500).json({
      error: "Erro ao buscar deal completo",
    });
  }
}
