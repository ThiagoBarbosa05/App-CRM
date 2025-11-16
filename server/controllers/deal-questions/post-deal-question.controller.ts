import type { Request, Response } from "express";
import { dealQuestionsService } from "../../services/deal-questions.service";

/**
 * Controller para criação de perguntas de deals
 *
 * **Endpoint:** `POST /api/deal-questions`
 *
 * **Funcionalidades:**
 * - Cria uma nova pergunta de deal no sistema
 * - Valida dados de entrada usando middleware validateBody(insertDealQuestionSchema)
 * - Aplica validações específicas via Zod schema
 * - Requer autenticação via middleware requireAuth
 *
 * **Validações:**
 * - question (texto da pergunta) é obrigatório
 * - type (tipo da pergunta: text, select, textarea, etc.) é obrigatório
 * - isRequired (se a pergunta é obrigatória) é boolean
 * - isActive (se a pergunta está ativa) é boolean, padrão true
 * - options (opções para select/radio) é array opcional
 *
 * **Comportamentos Especiais:**
 * - ID é gerado automaticamente
 * - createdAt e updatedAt são definidos automaticamente
 * - Validação completa via insertDealQuestionSchema
 * - Requer autenticação de usuário
 *
 * **Códigos de Resposta:**
 * - 201: Pergunta criada com sucesso
 * - 400: Dados inválidos ou erro de validação (handled by middleware)
 * - 401: Não autenticado (handled by requireAuth middleware)
 * - 500: Erro interno do servidor
 *
 * @param req - Objeto de requisição Express contendo os dados da pergunta no body
 * @param res - Objeto de resposta Express
 */
export async function createDealQuestionController(
  req: Request,
  res: Response
) {
  try {
    // Processa parâmetros da requisição
    const params = dealQuestionsService.processCreateDealQuestionParams(req);

    // Cria a pergunta através do service
    const question = await dealQuestionsService.createDealQuestion(params);

    // Retorna a pergunta criada
    res.status(201).json(question);
  } catch (error) {
    // Tratamento para erros conhecidos do service
    if (error instanceof Error) {
      console.error("Erro ao criar pergunta do deal:", error);
      return res.status(500).json({
        message: "Erro interno do servidor ao criar pergunta",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }

    // Erro genérico do servidor
    console.error("Erro ao criar pergunta do deal:", error);
    res.status(500).json({
      message: "Erro interno do servidor ao criar pergunta",
    });
  }
}
