import { db } from "../db";
import {
  dealQuestions,
  dealAnswers,
  deals,
  type DealQuestion,
  type InsertDealQuestion,
  type UpdateDealQuestion,
} from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Repository responsável pelo acesso a dados das perguntas de deals
 *
 * Esta classe encapsula todas as operações de banco de dados relacionadas a perguntas de deals,
 * seguindo o padrão Repository para separar a lógica de acesso a dados da lógica de negócio.
 */
export class DealQuestionsRepository {
  private db = db;

  /**
   * Busca todas as perguntas de deals com filtros opcionais
   * @param filters - Filtros opcionais para status ativo
   * @returns Promise<DealQuestion[]> - Lista de perguntas de deals
   */
  async getDealQuestions(filters?: {
    isActive?: boolean;
  }): Promise<DealQuestion[]> {
    try {
      const conditions = [];

      if (filters?.isActive !== undefined) {
        conditions.push(eq(dealQuestions.isActive, filters.isActive));
      }

      if (conditions.length > 0) {
        return await this.db
          .select()
          .from(dealQuestions)
          .where(and(...conditions))
          .orderBy(dealQuestions.createdAt);
      }

      return await this.db
        .select()
        .from(dealQuestions)
        .orderBy(dealQuestions.createdAt);
    } catch (error) {
      console.error("Error fetching deal questions:", error);
      throw error;
    }
  }

  /**
   * Cria uma nova pergunta de deal
   * @param data - Dados da pergunta a ser criada
   * @returns Promise<DealQuestion> - Pergunta criada
   */
  async createDealQuestion(data: InsertDealQuestion): Promise<DealQuestion> {
    try {
      const [question] = await this.db
        .insert(dealQuestions)
        .values(data)
        .returning();
      return question;
    } catch (error) {
      console.error("Error creating deal question:", error);
      throw error;
    }
  }

  /**
   * Atualiza uma pergunta de deal existente
   * @param id - ID da pergunta a ser atualizada
   * @param data - Dados parciais para atualização
   * @returns Promise<DealQuestion | null> - Pergunta atualizada ou null se não encontrada
   */
  async updateDealQuestion(
    id: string,
    data: UpdateDealQuestion
  ): Promise<DealQuestion | null> {
    try {
      const [question] = await this.db
        .update(dealQuestions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(dealQuestions.id, id))
        .returning();
      return question || null;
    } catch (error) {
      console.error("Error updating deal question:", error);
      throw error;
    }
  }

  /**
   * Exclui uma pergunta de deal
   * Nota: As respostas relacionadas (dealAnswers) são excluídas automaticamente
   * devido ao cascade delete configurado na foreign key
   * @param id - ID da pergunta a ser excluída
   * @returns Promise<boolean> - true se excluída com sucesso
   */
  async deleteDealQuestion(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(dealQuestions)
        .where(eq(dealQuestions.id, id))
        .returning();

      return result.length > 0;
    } catch (error) {
      console.error("Error deleting deal question:", error);
      throw error;
    }
  }

  /**
   * Busca estatísticas sobre perguntas de deals
   * @returns Promise com estatísticas de perguntas e uso
   */
  async getDealQuestionsStats(): Promise<{
    totalQuestions: number;
    activeQuestions: number;
    categoriesCount: number;
    usageStats: Array<{
      questionId: string;
      question: string;
      answeredCount: number;
      totalDeals: number;
      completionRate: number;
    }>;
  }> {
    try {
      // Get total and active questions count
      const [questionsStats] = await this.db
        .select({
          total: sql<number>`count(*)`,
          active: sql<number>`count(*) filter (where ${dealQuestions.isActive} = true)`,
          categories: sql<number>`count(distinct ${dealQuestions.category})`,
        })
        .from(dealQuestions);

      // Get usage statistics for each question
      const usageStats = await this.db
        .select({
          questionId: dealQuestions.id,
          question: dealQuestions.question,
          answeredCount: sql<number>`count(${dealAnswers.id})`,
          totalDeals: sql<number>`(select count(*) from ${deals})`,
        })
        .from(dealQuestions)
        .leftJoin(dealAnswers, eq(dealQuestions.id, dealAnswers.questionId))
        .where(eq(dealQuestions.isActive, true))
        .groupBy(dealQuestions.id, dealQuestions.question);

      const statsWithCompletionRate = usageStats.map((stat) => ({
        ...stat,
        completionRate:
          stat.totalDeals > 0
            ? Math.round((stat.answeredCount / stat.totalDeals) * 100)
            : 0,
      }));

      return {
        totalQuestions: questionsStats.total,
        activeQuestions: questionsStats.active,
        categoriesCount: questionsStats.categories,
        usageStats: statsWithCompletionRate,
      };
    } catch (error) {
      console.error("Error fetching deal questions stats:", error);
      throw error;
    }
  }

  /**
   * Popula o banco com perguntas padrão de deals
   * @returns Promise<void>
   */
  async seedDefaultDealQuestions(): Promise<void> {
    try {
      // Check if questions already exist
      const existingQuestions = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(dealQuestions);

      if (existingQuestions[0]?.count > 0) {
        // Questions already exist, don't seed again
        return;
      }

      const defaultQuestions = [
        {
          question: "O cliente já conhece nossos vinhos?",
          questionType: "boolean" as const,
          category: "Conhecimento do Produto",
          isRequired: true,
          displayOrder: 1,
          isActive: true,
          helpText:
            "Verificar se o cliente já teve contato anterior com nossos produtos",
        },
        {
          question: "Quantos rótulos nossos tem na carta atual?",
          questionType: "number" as const,
          category: "Conhecimento do Produto",
          isRequired: true,
          displayOrder: 2,
          isActive: true,
          placeholder: "0",
          helpText: "Número de vinhos da nossa marca que o cliente já oferece",
        },
        {
          question: "Há quanto tempo é nosso cliente?",
          questionType: "select" as const,
          category: "Conhecimento do Produto",
          options: [
            "Cliente novo",
            "Menos de 6 meses",
            "6 meses a 1 ano",
            "1 a 2 anos",
            "Mais de 2 anos",
          ],
          isRequired: false,
          displayOrder: 3,
          isActive: true,
        },
        {
          question: "Tipos de vinho preferidos",
          questionType: "multiselect" as const,
          category: "Perfil de Consumo",
          options: [
            "Tinto",
            "Branco",
            "Rosé",
            "Espumante",
            "Pós-refeição",
            "Orgânicos",
          ],
          isRequired: false,
          displayOrder: 4,
          isActive: true,
          helpText:
            "Selecione todos os tipos que o cliente demonstra interesse",
        },
        {
          question: "Faixa de preço de trabalho",
          questionType: "select" as const,
          category: "Perfil de Consumo",
          options: [
            "Até R$ 50",
            "R$ 51 a R$ 100",
            "R$ 101 a R$ 200",
            "R$ 201 a R$ 300",
            "Acima de R$ 300",
          ],
          isRequired: false,
          displayOrder: 5,
          isActive: true,
        },
        {
          question: "Volume mensal estimado (garrafas)",
          questionType: "number" as const,
          category: "Perfil de Consumo",
          isRequired: false,
          displayOrder: 6,
          isActive: true,
          placeholder: "Ex: 50",
          helpText: "Estimativa de consumo mensal em garrafas",
        },
        {
          question: "Principais concorrentes atuais",
          questionType: "text" as const,
          category: "Competitividade",
          isRequired: false,
          displayOrder: 7,
          isActive: true,
          placeholder: "Ex: Marca A, Marca B...",
          helpText: "Outras marcas de vinho que o cliente trabalha",
        },
        {
          question: "Nosso diferencial percebido pelo cliente",
          questionType: "text" as const,
          category: "Competitividade",
          isRequired: false,
          displayOrder: 8,
          isActive: true,
          helpText: "O que o cliente enxerga como vantagem em nossos produtos",
        },
        {
          question: "Potencial de crescimento do cliente",
          questionType: "select" as const,
          category: "Potencial de Negócio",
          options: [
            "Baixo potencial",
            "Médio potencial de crescimento",
            "Alto potencial de crescimento",
            "Potencial excepcional",
          ],
          isRequired: false,
          displayOrder: 9,
          isActive: true,
        },
        {
          question: "Sazonalidade do negócio",
          questionType: "select" as const,
          category: "Potencial de Negócio",
          options: [
            "Constante o ano todo",
            "Maior no verão",
            "Maior no inverno",
            "Eventos específicos",
            "Fim de ano",
          ],
          isRequired: false,
          displayOrder: 10,
          isActive: true,
        },
        {
          question: "Nível de relacionamento atual",
          questionType: "select" as const,
          category: "Relacionamento",
          options: [
            "Primeiro contato",
            "Relacionamento inicial",
            "Relacionamento estabelecido",
            "Parceria consolidada",
          ],
          isRequired: false,
          displayOrder: 11,
          isActive: true,
        },
        {
          question: "Observações importantes sobre o cliente/deal",
          questionType: "text" as const,
          category: "Relacionamento",
          isRequired: false,
          displayOrder: 12,
          isActive: true,
          placeholder: "Informações adicionais relevantes...",
          helpText:
            "Qualquer informação adicional que possa ser relevante para o fechamento do deal",
        },
      ];

      // Insert default questions
      await this.db.insert(dealQuestions).values(defaultQuestions);
    } catch (error) {
      console.error("Error seeding default deal questions:", error);
      throw error;
    }
  }
}

// Instância singleton do repository
export const dealQuestionsRepository = new DealQuestionsRepository();
