import { eq, and } from "drizzle-orm";
import { db } from "server/db";
import { dealAnswers, dealQuestions, deals, companies } from "@shared/schema";

/**
 * Interface para representar uma pergunta respondida de um deal
 */
export interface DealAnsweredQuestion {
  id: string;
  question: string;
  questionType: "boolean" | "number" | "text" | "select" | "multiselect";
  category: string;
  answer: boolean | number | string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Busca todas as perguntas respondidas de um deal específico de uma empresa
 *
 * @param dealId - ID do deal
 * @param companyId - ID da empresa
 * @returns Promise<DealAnsweredQuestion[]> - Array de perguntas respondidas
 * @throws Error se houver problemas na consulta ao banco
 */
export async function getDealAnsweredQuestions(
  dealId: string,
  companyId: string
): Promise<DealAnsweredQuestion[]> {
  try {
    // Verifica se o deal pertence à empresa especificada
    const dealExists = await db
      .select({ id: deals.id })
      .from(deals)
      .where(and(eq(deals.id, dealId), eq(deals.companyId, companyId)))
      .limit(1);

    if (dealExists.length === 0) {
      throw new Error(
        "Deal não encontrado ou não pertence à empresa especificada"
      );
    }

    // Busca as perguntas respondidas com JOIN
    const answeredQuestions = await db
      .select({
        id: dealQuestions.id,
        question: dealQuestions.question,
        questionType: dealQuestions.questionType,
        answerBoolean: dealAnswers.answerBoolean,
        answerNumber: dealAnswers.answerNumber,
        answerText: dealAnswers.answerText,
        createdAt: dealAnswers.createdAt,
        updatedAt: dealAnswers.updatedAt,
      })
      .from(dealAnswers)
      .innerJoin(dealQuestions, eq(dealAnswers.questionId, dealQuestions.id))
      .where(eq(dealAnswers.dealId, dealId))
      .orderBy(dealQuestions.createdAt);

    // Mapeia os resultados para o formato esperado
    const formattedResults: DealAnsweredQuestion[] = answeredQuestions.map(
      (item) => {
        let answer: boolean | number | string | null = null;

        // Determina o valor da resposta baseado no tipo da pergunta
        if (item.answerBoolean !== null) {
          answer = item.answerBoolean;
        } else if (item.answerNumber !== null) {
          answer = Number(item.answerNumber);
        } else if (item.answerText !== null) {
          answer = item.answerText;
        }

        return {
          id: item.id,
          question: item.question,
          questionType: item.questionType,
          category: item.category,
          answer,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      }
    );

    return formattedResults;
  } catch (error) {
    console.error("Erro ao buscar perguntas respondidas do deal:", error);

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Erro interno ao consultar perguntas respondidas do deal");
  }
}

/**
 * Busca informações básicas do deal e empresa para validação
 *
 * @param dealId - ID do deal
 * @param companyId - ID da empresa
 * @returns Promise<{ dealTitle: string; companyName: string } | null>
 */
export async function getDealAndCompanyInfo(
  dealId: string,
  companyId: string
): Promise<{ dealTitle: string; companyName: string } | null> {
  try {
    const result = await db
      .select({
        dealTitle: deals.title,
        companyName: companies.nomeFantasia,
      })
      .from(deals)
      .innerJoin(companies, eq(deals.companyId, companies.id))
      .where(and(eq(deals.id, dealId), eq(deals.companyId, companyId)))
      .limit(1);

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("Erro ao buscar informações do deal e empresa:", error);
    throw new Error("Erro interno ao consultar informações do deal e empresa");
  }
}
