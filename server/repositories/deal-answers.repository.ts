import { db } from "../db";
import {
  dealAnswers,
  deals,
  dealQuestions,
  type DealAnswer,
  type InsertDealAnswer,
} from "../../shared/schema";
import { eq, inArray } from "drizzle-orm";

/**
 * Repository responsável pelo acesso a dados das respostas de deals
 *
 * Esta classe encapsula todas as operações de banco de dados relacionadas a respostas de deals,
 * seguindo o padrão Repository para separar a lógica de acesso a dados da lógica de negócio.
 */
export class DealAnswersRepository {
  private db = db;

  /**
   * Busca todas as respostas de um deal específico
   * @param dealId - ID único do deal
   * @returns Promise<DealAnswer[]> - Lista de respostas do deal
   */
  async getDealAnswers(dealId: string): Promise<DealAnswer[]> {
    try {
      return await this.db
        .select()
        .from(dealAnswers)
        .where(eq(dealAnswers.dealId, dealId))
        .orderBy(dealAnswers.createdAt);
    } catch (error) {
      console.error("Error fetching deal answers:", error);
      throw error;
    }
  }

  /**
   * Verifica se um deal existe no banco de dados
   * @param dealId - ID único do deal
   * @returns Promise<boolean> - true se o deal existir
   */
  async dealExists(dealId: string): Promise<boolean> {
    try {
      const result = await this.db
        .select({ id: deals.id })
        .from(deals)
        .where(eq(deals.id, dealId))
        .limit(1);

      return result.length > 0;
    } catch (error) {
      console.error("Error checking if deal exists:", error);
      throw error;
    }
  }

  /**
   * Verifica quais perguntas existem no banco de dados
   * @param questionIds - Array de IDs das perguntas
   * @returns Promise<string[]> - Array com IDs das perguntas que existem
   */
  async getExistingQuestionIds(questionIds: string[]): Promise<string[]> {
    try {
      if (questionIds.length === 0) return [];

      const result = await this.db
        .select({ id: dealQuestions.id })
        .from(dealQuestions)
        .where(inArray(dealQuestions.id, questionIds));

      return result.map((q) => q.id);
    } catch (error) {
      console.error("Error checking existing questions:", error);
      throw error;
    }
  }

  /**
   * Salva ou atualiza respostas de um deal
   * Remove respostas existentes e insere as novas
   * @param dealId - ID único do deal
   * @param answers - Array de respostas para salvar
   * @returns Promise<DealAnswer[]> - Respostas salvas
   */
  async saveDealAnswers(
    dealId: string,
    answers: InsertDealAnswer[]
  ): Promise<DealAnswer[]> {
    try {
      // Usar transação para garantir consistência
      return await this.db.transaction(async (tx) => {
        // Remover respostas existentes para este deal
        await tx.delete(dealAnswers).where(eq(dealAnswers.dealId, dealId));

        // Se não há respostas para inserir, retornar array vazio
        if (answers.length === 0) {
          return [];
        }

        // Inserir novas respostas
        const insertedAnswers = await tx
          .insert(dealAnswers)
          .values(answers)
          .returning();

        return insertedAnswers;
      });
    } catch (error) {
      console.error("Error saving deal answers:", error);
      throw error;
    }
  }

  /**
   * Busca um deal com todas as suas respostas
   * @param dealId - ID único do deal
   * @returns Promise<any | null> - Deal completo com respostas ou null se não encontrado
   */
  async getDealWithAnswers(dealId: string): Promise<any | null> {
    try {
      // Buscar o deal
      const dealResult = await this.db
        .select()
        .from(deals)
        .where(eq(deals.id, dealId))
        .limit(1);

      if (dealResult.length === 0) {
        return null;
      }

      const deal = dealResult[0];

      // Buscar as respostas do deal
      const answers = await this.db
        .select()
        .from(dealAnswers)
        .where(eq(dealAnswers.dealId, dealId))
        .orderBy(dealAnswers.createdAt);

      // Retornar deal com respostas
      return {
        ...deal,
        answers,
      };
    } catch (error) {
      console.error("Error fetching deal with answers:", error);
      throw error;
    }
  }
}

// Instância singleton do repository
export const dealAnswersRepository = new DealAnswersRepository();
