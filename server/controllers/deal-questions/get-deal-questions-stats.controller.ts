import { Request, Response } from "express";
import { dealQuestionsService } from "../../services/deal-questions.service";

/**
 * Controller: GET /api/deal-questions/stats
 *
 * Retorna estatísticas sobre as perguntas de deals
 *
 * Esta rota fornece uma visão geral sobre o uso e a eficácia das perguntas de deals,
 * incluindo contadores gerais e estatísticas de uso individual por pergunta.
 *
 * @param {Request} req - Objeto de requisição Express (sem parâmetros)
 * @param {Response} res - Objeto de resposta Express
 *
 * @returns {Promise<Response>} JSON com estatísticas de perguntas
 *
 * Response Codes:
 * - 200: Estatísticas retornadas com sucesso
 * - 500: Erro interno do servidor
 *
 * @example Response 200:
 * {
 *   "totalQuestions": 10,
 *   "activeQuestions": 8,
 *   "categoriesCount": 3,
 *   "usageStats": [
 *     {
 *       "questionId": "123e4567-e89b-12d3-a456-426614174000",
 *       "question": "Qual é o orçamento?",
 *       "answeredCount": 45,
 *       "totalDeals": 100,
 *       "completionRate": 45
 *     },
 *     {
 *       "questionId": "223e4567-e89b-12d3-a456-426614174001",
 *       "question": "Prazo de entrega?",
 *       "answeredCount": 38,
 *       "totalDeals": 100,
 *       "completionRate": 38
 *     }
 *   ]
 * }
 *
 * @example Response 500:
 * {
 *   "message": "Erro ao buscar estatísticas das perguntas"
 * }
 *
 * @notes
 * - totalQuestions: Número total de perguntas cadastradas
 * - activeQuestions: Número de perguntas marcadas como ativas
 * - categoriesCount: Número de categorias únicas de perguntas
 * - usageStats: Array com estatísticas de uso de cada pergunta ativa
 * - completionRate: Porcentagem de deals que responderam a pergunta
 * - Apenas perguntas ativas são incluídas nas usageStats
 */
export async function getDealQuestionsStatsController(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    const stats = await dealQuestionsService.getDealQuestionsStats();

    return res.status(200).json(stats);
  } catch (error) {
    console.error("Erro ao buscar estatísticas das perguntas:", error);

    // Retornar mensagem de erro genérica em produção
    return res.status(500).json({
      message: "Erro ao buscar estatísticas das perguntas",
    });
  }
}
