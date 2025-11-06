import type { Request, Response } from "express";
import { dealQuestionsService } from "../../services/deal-questions.service";

/**
 * Controller para busca de perguntas de deals
 *
 * **Endpoint:** `GET /api/deal-questions`
 *
 * **Funcionalidades:**
 * - Busca todas as perguntas de deals configuradas no sistema
 * - Aplica filtros opcionais por categoria e status ativo
 * - Retorna perguntas ordenadas por ordem de exibição e data de criação
 * - Suporte a query parameters para filtragem
 *
 * **Query Parameters:**
 * - category: Filtra perguntas por categoria específica
 * - isActive: Filtra perguntas ativas/inativas ("true" ou "false")
 *
 * **Validações:**
 * - Query parameters são opcionais
 * - isActive deve ser "true" ou "false" se fornecido
 * - Validação é feita via middleware validateQuery(dealQuestionsQuerySchema)
 *
 * **Comportamentos Especiais:**
 * - Sem filtros: retorna todas as perguntas
 * - Ordenação: por displayOrder (ordem de exibição) e createdAt
 * - Filtros combinados: category AND isActive quando ambos fornecidos
 *
 * **Códigos de Resposta:**
 * - 200: Lista de perguntas retornada com sucesso
 * - 400: Query parameters inválidos (handled by middleware)
 * - 500: Erro interno do servidor
 *
 * @param req - Objeto de requisição Express com query parameters
 * @param res - Objeto de resposta Express
 */
export async function getDealQuestionsController(req: Request, res: Response) {
  try {
    // Processa parâmetros da requisição
    const params = dealQuestionsService.processGetDealQuestionsParams(req);

    // Busca as perguntas através do service
    const questions = await dealQuestionsService.getDealQuestions(params);

    // Retorna as perguntas encontradas
    res.json(questions);
  } catch (error) {
    // Tratamento para erros conhecidos do service
    if (error instanceof Error) {
      console.error("Erro ao buscar perguntas dos deals:", error);
      return res.status(500).json({
        message: "Erro interno do servidor ao buscar perguntas",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }

    // Erro genérico do servidor
    console.error("Erro ao buscar perguntas dos deals:", error);
    res.status(500).json({
      message: "Erro interno do servidor ao buscar perguntas",
    });
  }
}
