import { Request, Response } from "express";
import { dealQuestionsService } from "../../services/deal-questions.service";

/**
 * Controller: POST /api/deal-questions/seed
 *
 * Popula o banco de dados com perguntas padrão de deals
 *
 * Esta rota insere um conjunto predefinido de perguntas no sistema, útil para
 * inicializar o banco de dados ou resetar as perguntas para os valores padrão.
 * A operação é idempotente - se já existirem perguntas, nada é feito.
 *
 * @param {Request} req - Objeto de requisição Express (sem parâmetros)
 * @param {Response} res - Objeto de resposta Express
 *
 * @returns {Promise<Response>} JSON com mensagem de sucesso
 *
 * Response Codes:
 * - 200: Perguntas padrão criadas com sucesso (ou já existiam)
 * - 500: Erro interno do servidor
 *
 * @example Response 200:
 * {
 *   "message": "Perguntas padrão criadas com sucesso"
 * }
 *
 * @example Response 500:
 * {
 *   "message": "Erro ao popular perguntas padrão"
 * }
 *
 * @notes
 * - A rota verifica se já existem perguntas antes de inserir
 * - Se já houver perguntas, retorna sucesso sem inserir nada
 * - Útil para ambiente de desenvolvimento e testes
 * - As perguntas padrão incluem categorias como:
 *   - Conhecimento do Produto
 *   - Perfil de Consumo
 *   - Competitividade
 *   - Potencial de Negócio
 *   - Relacionamento
 * - Total de 12 perguntas padrão são inseridas
 * - Cada pergunta tem tipo (boolean, number, select, multiselect, text)
 * - Algumas perguntas são obrigatórias (isRequired: true)
 * - Todas as perguntas vêm ativas por padrão (isActive: true)
 * - Display order define a ordem de exibição
 */
export async function seedDealQuestionsController(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    await dealQuestionsService.seedDefaultDealQuestions();

    return res.status(200).json({
      message: "Perguntas padrão criadas com sucesso",
    });
  } catch (error) {
    console.error("Erro ao popular perguntas padrão:", error);

    // Retornar mensagem de erro genérica em produção
    return res.status(500).json({
      message: "Erro ao popular perguntas padrão",
    });
  }
}
