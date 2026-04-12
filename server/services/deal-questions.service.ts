import { dealQuestionsRepository } from "../repositories/deal-questions.repository";
import {
  type DealQuestion,
  type InsertDealQuestion,
  type UpdateDealQuestion,
} from "../../shared/schema";

/**
 * Interface para parâmetros de busca de perguntas de deals
 */
export interface GetDealQuestionsParams {
  isActive?: boolean;
}

/**
 * Interface para parâmetros de criação de pergunta de deal
 */
export interface CreateDealQuestionParams {
  questionData: InsertDealQuestion;
  userId?: string;
  userRole?: string;
}

/**
 * Interface para parâmetros de atualização de pergunta de deal
 */
export interface UpdateDealQuestionParams {
  questionId: string;
  questionData: UpdateDealQuestion;
  userId?: string;
  userRole?: string;
}

/**
 * Interface para parâmetros de exclusão de pergunta de deal
 */
export interface DeleteDealQuestionParams {
  questionId: string;
  userId?: string;
  userRole?: string;
}

/**
 * Service responsável pela lógica de negócio das perguntas de deals
 *
 * Esta classe contém toda a lógica de negócio relacionada a perguntas de deals,
 * validações, processamento de parâmetros e coordenação entre diferentes camadas.
 */
export class DealQuestionsService {
  private dealQuestionsRepository = dealQuestionsRepository;

  /**
   * Busca todas as perguntas de deals com filtros opcionais
   * @param params - Parâmetros de busca (incluindo filtros opcionais)
   * @returns Promise<DealQuestion[]> - Lista de perguntas de deals
   */
  async getDealQuestions(
    params: GetDealQuestionsParams
  ): Promise<DealQuestion[]> {
    const { isActive } = params;

    try {
      const filters: { isActive?: boolean } = {};

      if (isActive !== undefined) {
        filters.isActive = isActive;
      }

      const questions = await this.dealQuestionsRepository.getDealQuestions(
        filters
      );
      return questions;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao buscar perguntas dos deals");
    }
  }

  /**
   * Processa parâmetros da requisição para busca de perguntas de deals
   * @param req - Objeto de requisição
   * @returns GetDealQuestionsParams - Parâmetros processados
   */
  processGetDealQuestionsParams(req: any): GetDealQuestionsParams {
    const { isActive } = req.query;

    return {
      isActive: isActive ? isActive === "true" : undefined,
    };
  }

  /**
   * Cria uma nova pergunta de deal
   * @param params - Parâmetros de criação da pergunta
   * @returns Promise<DealQuestion> - Pergunta criada
   */
  async createDealQuestion(
    params: CreateDealQuestionParams
  ): Promise<DealQuestion> {
    const { questionData } = params;

    try {
      const question = await this.dealQuestionsRepository.createDealQuestion(
        questionData
      );
      return question;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao criar pergunta do deal");
    }
  }

  /**
   * Processa parâmetros da requisição para criação de pergunta de deal
   * @param req - Objeto de requisição
   * @returns CreateDealQuestionParams - Parâmetros processados
   */
  processCreateDealQuestionParams(req: any): CreateDealQuestionParams {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    return {
      questionData: req.body,
      userId,
      userRole,
    };
  }

  /**
   * Atualiza uma pergunta de deal existente
   * @param params - Parâmetros de atualização da pergunta
   * @returns Promise<DealQuestion> - Pergunta atualizada
   */
  async updateDealQuestion(
    params: UpdateDealQuestionParams
  ): Promise<DealQuestion> {
    const { questionId, questionData } = params;

    // Validações básicas
    if (!questionId || questionId.trim() === "") {
      throw new Error("ID da pergunta é obrigatório");
    }

    try {
      // Verificar se a pergunta existe antes de atualizar
      const existingQuestions =
        await this.dealQuestionsRepository.getDealQuestions();
      const existingQuestion = existingQuestions.find(
        (q) => q.id === questionId
      );

      if (!existingQuestion) {
        throw new Error("Pergunta não encontrada");
      }

      const question = await this.dealQuestionsRepository.updateDealQuestion(
        questionId,
        questionData
      );

      if (!question) {
        throw new Error("Pergunta não encontrada");
      }

      return question;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao atualizar pergunta do deal");
    }
  }

  /**
   * Processa parâmetros da requisição para atualização de pergunta de deal
   * @param req - Objeto de requisição
   * @returns UpdateDealQuestionParams - Parâmetros processados
   */
  processUpdateDealQuestionParams(req: any): UpdateDealQuestionParams {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    return {
      questionId: req.params.id,
      questionData: req.body,
      userId,
      userRole,
    };
  }

  /**
   * Exclui uma pergunta de deal existente
   * @param params - Parâmetros de exclusão da pergunta
   * @returns Promise<void> - Operação concluída sem retorno
   */
  async deleteDealQuestion(params: DeleteDealQuestionParams): Promise<void> {
    const { questionId } = params;

    // Validações básicas
    if (!questionId || questionId.trim() === "") {
      throw new Error("ID da pergunta é obrigatório");
    }

    try {
      const success = await this.dealQuestionsRepository.deleteDealQuestion(
        questionId
      );

      if (!success) {
        throw new Error("Pergunta não encontrada ou falha ao deletar");
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao deletar pergunta do deal");
    }
  }

  /**
   * Processa parâmetros da requisição para exclusão de pergunta de deal
   * @param req - Objeto de requisição
   * @returns DeleteDealQuestionParams - Parâmetros processados
   */
  processDeleteDealQuestionParams(req: any): DeleteDealQuestionParams {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    return {
      questionId: req.params.id,
      userId,
      userRole,
    };
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
      return await this.dealQuestionsRepository.getDealQuestionsStats();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao buscar estatísticas das perguntas");
    }
  }

  /**
   * Popula o banco com perguntas padrão de deals
   * @returns Promise<void>
   */
  async seedDefaultDealQuestions(): Promise<void> {
    try {
      await this.dealQuestionsRepository.seedDefaultDealQuestions();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao popular perguntas padrão");
    }
  }
}

// Instância singleton do service
export const dealQuestionsService = new DealQuestionsService();
