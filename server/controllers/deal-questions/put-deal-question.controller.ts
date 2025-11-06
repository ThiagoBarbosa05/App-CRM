import type { Request, Response } from "express";
import { dealQuestionsService } from "../../services/deal-questions.service";

/**
 * Controller para atualização de perguntas de deals
 *
 * **Endpoint:** `PUT /api/deal-questions/:id`
 *
 * **Funcionalidades:**
 * - Atualiza uma pergunta de deal existente no sistema
 * - Valida dados de entrada usando middleware validateBody(updateDealQuestionSchema)
 * - Valida parâmetros de rota usando middleware validateParams(dealQuestionParamsSchema)
 * - Verifica se a pergunta existe antes de tentar atualizar
 * - Atualização parcial (apenas campos fornecidos são atualizados)
 *
 * **Validações:**
 * - ID deve ser um UUID válido (validado por middleware)
 * - Pergunta deve existir no sistema
 * - Campos opcionais seguem as mesmas regras do schema de criação
 * - updatedAt é automaticamente atualizado
 *
 * **Comportamentos Especiais:**
 * - Atualização parcial: apenas campos fornecidos no body são atualizados
 * - updatedAt é automaticamente definido para data/hora atual
 * - Validação de existência antes da atualização
 * - Preserva campos não fornecidos
 *
 * **Códigos de Resposta:**
 * - 200: Pergunta atualizada com sucesso
 * - 400: ID inválido ou dados de validação inválidos (handled by middleware)
 * - 404: Pergunta não encontrada
 * - 500: Erro interno do servidor
 *
 * @param req - Objeto de requisição Express contendo ID nos params e dados no body
 * @param res - Objeto de resposta Express
 */
export async function updateDealQuestionController(
  req: Request,
  res: Response
) {
  try {
    // Processa parâmetros da requisição
    const params = dealQuestionsService.processUpdateDealQuestionParams(req);

    // Atualiza a pergunta através do service
    const question = await dealQuestionsService.updateDealQuestion(params);

    // Retorna a pergunta atualizada
    res.json(question);
  } catch (error) {
    // Tratamento para erros conhecidos do service
    if (error instanceof Error) {
      // Tratamento específico para pergunta não encontrada
      if (error.message === "Pergunta não encontrada") {
        return res.status(404).json({ message: error.message });
      }

      console.error("Erro ao atualizar pergunta do deal:", error);
      return res.status(500).json({
        message: "Erro interno do servidor ao atualizar pergunta",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }

    // Erro genérico do servidor
    console.error("Erro ao atualizar pergunta do deal:", error);
    res.status(500).json({
      message: "Erro interno do servidor ao atualizar pergunta",
    });
  }
}
