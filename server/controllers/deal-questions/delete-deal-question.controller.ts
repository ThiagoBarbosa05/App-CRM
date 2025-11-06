import { Request, Response } from "express";
import { dealQuestionsService } from "../../services/deal-questions.service";

/**
 * Controlador para exclusão de pergunta de deal
 *
 * Esta função gerencia requisições DELETE para /api/deal-questions/:id,
 * processando os parâmetros da requisição através do service layer
 * e retornando uma resposta HTTP apropriada.
 *
 * @route DELETE /api/deal-questions/:id
 * @param req - Objeto de requisição Express
 * @param res - Objeto de resposta Express
 * @returns Promise<Response> - Resposta HTTP
 *
 * @throws {400} Quando parâmetros são inválidos
 * @throws {404} Quando pergunta não é encontrada
 * @throws {500} Quando ocorre erro interno do servidor
 *
 * @example
 * // Requisição
 * DELETE /api/deal-questions/123e4567-e89b-12d3-a456-426614174000
 *
 * // Resposta de sucesso
 * HTTP 204 No Content
 *
 * // Resposta de erro (pergunta não encontrada)
 * HTTP 404 Not Found
 * {
 *   "error": "Pergunta não encontrada"
 * }
 */
export async function deleteDealQuestionController(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    // Processar parâmetros da requisição através do service
    const params = dealQuestionsService.processDeleteDealQuestionParams(req);

    // Executar exclusão da pergunta
    await dealQuestionsService.deleteDealQuestion(params);

    // Retornar resposta de sucesso sem conteúdo
    return res.status(204).send();
  } catch (error) {
    // Log do erro para debugging
    console.error("Erro no controller de exclusão de pergunta:", error);

    // Tratamento de erros específicos
    if (error instanceof Error) {
      // Erro de pergunta não encontrada
      if (error.message.includes("não encontrada")) {
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
      error: "Erro interno do servidor ao deletar pergunta",
    });
  }
}
