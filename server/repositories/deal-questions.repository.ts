import { db } from "../db";
import {
  dealQuestions,
  type DealQuestion,
  type InsertDealQuestion,
  type UpdateDealQuestion,
} from "../../shared/schema";
import { eq, and } from "drizzle-orm";

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
   * @param filters - Filtros opcionais para categoria e status ativo
   * @returns Promise<DealQuestion[]> - Lista de perguntas de deals
   */
  async getDealQuestions(filters?: {
    category?: string;
    isActive?: boolean;
  }): Promise<DealQuestion[]> {
    try {
      const conditions = [];

      if (filters?.category) {
        conditions.push(eq(dealQuestions.category, filters.category));
      }

      if (filters?.isActive !== undefined) {
        conditions.push(eq(dealQuestions.isActive, filters.isActive));
      }

      if (conditions.length > 0) {
        return await this.db
          .select()
          .from(dealQuestions)
          .where(and(...conditions))
          .orderBy(dealQuestions.displayOrder, dealQuestions.createdAt);
      }

      return await this.db
        .select()
        .from(dealQuestions)
        .orderBy(dealQuestions.displayOrder, dealQuestions.createdAt);
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
}

// Instância singleton do repository
export const dealQuestionsRepository = new DealQuestionsRepository();
