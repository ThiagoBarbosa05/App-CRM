import {
  dealAnswersRepository,
  type DealAnswersRepository,
} from "../repositories/deal-answers.repository";
import type { DealAnswer, InsertDealAnswer } from "../../shared/schema";

/**
 * Interface para parâmetros de busca de respostas de deal
 */
export interface GetDealAnswersParams {
  dealId: string;
  userId?: string;
  userRole?: string;
}

/**
 * Interface para parâmetros de salvamento de respostas de deal
 */
export interface SaveDealAnswersParams {
  dealId: string;
  answers: Array<{
    questionId: string;
    answerBoolean?: boolean;
    answerNumber?: string;
    answerText?: string;
  }>;
  userId?: string;
  userRole?: string;
}

/**
 * Serviço responsável pela lógica de negócio das respostas de deals
 *
 * Esta classe contém todas as regras de negócio relacionadas a respostas de deals,
 * servindo como uma camada intermediária entre os controllers e repositories.
 */
export class DealAnswersService {
  private dealAnswersRepository: DealAnswersRepository;

  constructor(dealAnswersRepository: DealAnswersRepository) {
    this.dealAnswersRepository = dealAnswersRepository;
  }

  /**
   * Busca todas as respostas de um deal específico
   * @param params - Parâmetros de busca das respostas
   * @returns Promise<DealAnswer[]> - Lista de respostas do deal
   */
  async getDealAnswers(params: GetDealAnswersParams): Promise<DealAnswer[]> {
    const { dealId } = params;

    // Validações básicas
    if (!dealId || dealId.trim() === "") {
      throw new Error("ID do deal é obrigatório");
    }

    try {
      // Verificar se o deal existe
      const dealExists = await this.dealAnswersRepository.dealExists(dealId);
      if (!dealExists) {
        throw new Error("Deal não encontrado");
      }

      // Buscar as respostas
      const answers = await this.dealAnswersRepository.getDealAnswers(dealId);
      return answers || [];
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao buscar respostas do deal");
    }
  }

  /**
   * Salva ou atualiza respostas de um deal
   * @param params - Parâmetros de salvamento das respostas
   * @returns Promise<DealAnswer[]> - Respostas salvas
   */
  async saveDealAnswers(params: SaveDealAnswersParams): Promise<DealAnswer[]> {
    const { dealId, answers } = params;

    // Validações básicas
    if (!dealId || dealId.trim() === "") {
      throw new Error("ID do deal é obrigatório");
    }

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      throw new Error("Pelo menos uma resposta deve ser fornecida");
    }

    try {
      // Verificar se o deal existe
      const dealExists = await this.dealAnswersRepository.dealExists(dealId);
      if (!dealExists) {
        throw new Error("Deal não encontrado");
      }

      // Extrair IDs das perguntas
      const questionIds = answers.map((a) => a.questionId);

      // Verificar se todas as perguntas existem
      const existingQuestionIds =
        await this.dealAnswersRepository.getExistingQuestionIds(questionIds);
      const invalidQuestionIds = questionIds.filter(
        (id) => !existingQuestionIds.includes(id)
      );

      if (invalidQuestionIds.length > 0) {
        throw new Error(
          `Algumas perguntas não existem: ${invalidQuestionIds.join(", ")}`
        );
      }

      // Preparar dados para inserção
      const answersToInsert: InsertDealAnswer[] = answers.map((answer) => ({
        dealId,
        questionId: answer.questionId,
        answerBoolean: answer.answerBoolean,
        answerNumber: answer.answerNumber,
        answerText: answer.answerText,
      }));

      // Salvar respostas
      const savedAnswers = await this.dealAnswersRepository.saveDealAnswers(
        dealId,
        answersToInsert
      );

      return savedAnswers;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao salvar respostas do deal");
    }
  }

  /**
   * Processa parâmetros da requisição para busca de respostas de deal
   * @param req - Objeto de requisição
   * @returns GetDealAnswersParams - Parâmetros processados
   */
  processGetDealAnswersParams(req: any): GetDealAnswersParams {
    const userId = req.user?.id || req.user?.userId || req.userId;
    const userRole = req.user?.role || req.user?.userRole || req.userRole;

    return {
      dealId: req.params.dealId,
      userId,
      userRole,
    };
  }

  /**
   * Processa parâmetros da requisição para salvamento de respostas de deal
   * @param req - Objeto de requisição
   * @returns SaveDealAnswersParams - Parâmetros processados
   */
  processSaveDealAnswersParams(req: any): SaveDealAnswersParams {
    const userId = req.user?.id || req.user?.userId || req.userId;
    const userRole = req.user?.role || req.user?.userRole || req.userRole;

    return {
      dealId: req.params.dealId,
      answers: req.body.answers,
      userId,
      userRole,
    };
  }
}

// Instância singleton do service
export const dealAnswersService = new DealAnswersService(dealAnswersRepository);
