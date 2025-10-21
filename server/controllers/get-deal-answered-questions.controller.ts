import { Request, Response } from "express";
import { z } from "zod";
import {
  getDealAnsweredQuestions,
  getDealAndCompanyInfo,
  type DealAnsweredQuestion,
} from "../db/functions/get-deal-answered-questions";

/**
 * Schema de validação para os parâmetros da rota
 */
const getDealAnsweredQuestionsSchema = z.object({
  dealId: z
    .string()
    .min(1, "ID do deal é obrigatório")
    .uuid("ID do deal deve ser um UUID válido"),
  companyId: z
    .string()
    .min(1, "ID da empresa é obrigatório")
    .uuid("ID da empresa deve ser um UUID válido"),
});

/**
 * Interface para a resposta da API
 */
interface DealAnsweredQuestionsResponse {
  success: boolean;
  message: string;
  data?: {
    dealId: string;
    companyId: string;
    dealTitle?: string;
    companyName?: string;
    totalAnsweredQuestions: number;
    answeredQuestions: DealAnsweredQuestion[];
  };
  error?: string;
}

/**
 * Controller para buscar perguntas respondidas de um deal de uma empresa específica
 *
 * @route GET /api/companies/:companyId/deals/:dealId/answered-questions
 * @param req - Request object contendo dealId e companyId nos parâmetros
 * @param res - Response object
 * @returns JSON com as perguntas respondidas ou erro
 */
export async function getDealAnsweredQuestionsController(
  req: Request,
  res: Response
): Promise<Response<DealAnsweredQuestionsResponse>> {
  try {
    // Validação dos parâmetros de entrada
    const validationResult = getDealAnsweredQuestionsSchema.safeParse({
      dealId: req.params.dealId,
      companyId: req.params.companyId,
    });

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Parâmetros de entrada inválidos",
        error: "INVALID_PARAMETERS",
      });
    }

    const { dealId, companyId } = validationResult.data;

    // Busca as informações básicas do deal e empresa para validação e contexto
    const dealInfo = await getDealAndCompanyInfo(dealId, companyId);

    if (!dealInfo) {
      return res.status(404).json({
        success: false,
        message: "Deal não encontrado ou não pertence à empresa especificada",
        error: "DEAL_NOT_FOUND",
      });
    }

    // Busca as perguntas respondidas
    const answeredQuestions = await getDealAnsweredQuestions(dealId, companyId);

    // Resposta de sucesso
    return res.status(200).json({
      success: true,
      message: "Perguntas respondidas encontradas com sucesso",
      data: {
        dealId,
        companyId,
        dealTitle: dealInfo.dealTitle,
        companyName: dealInfo.companyName,
        totalAnsweredQuestions: answeredQuestions.length,
        answeredQuestions,
      },
    });
  } catch (error) {
    console.error("Erro no getDealAnsweredQuestionsController:", error);

    // Tratamento específico para erros conhecidos
    if (error instanceof Error) {
      if (error.message.includes("Deal não encontrado")) {
        return res.status(404).json({
          success: false,
          message: error.message,
          error: "DEAL_NOT_FOUND",
        });
      }

      if (error.message.includes("não pertence à empresa")) {
        return res.status(403).json({
          success: false,
          message: "Acesso negado: Deal não pertence à empresa especificada",
          error: "ACCESS_DENIED",
        });
      }
    }

    // Erro genérico
    return res.status(500).json({
      success: false,
      message: "Erro interno do servidor ao buscar perguntas respondidas",
      error: "INTERNAL_SERVER_ERROR",
    });
  }
}
