import { funnelsRepository } from "../repositories/funnels.repository";
import {
  insertSalesFunnelSchema,
  insertFunnelStageSchema,
  type SalesFunnelWithStages,
  type SalesFunnel,
  type InsertSalesFunnel,
  type FunnelStage,
  type InsertFunnelStage,
} from "../../shared/schema";

/**
 * Interface para parâmetros de busca de funis
 */
export interface GetFunnelsParams {
  userId?: string;
  userRole?: string;
}

/**
 * Interface para parâmetros de criação de funil
 */
export interface CreateFunnelParams {
  funnelData: InsertSalesFunnel;
  userId?: string;
  userRole?: string;
}

/**
 * Interface para parâmetros de atualização de funil
 */
export interface UpdateFunnelParams {
  funnelId: string;
  funnelData: Partial<InsertSalesFunnel>;
  userId?: string;
  userRole?: string;
}

/**
 * Interface para parâmetros de exclusão de funil
 */
export interface DeleteFunnelParams {
  funnelId: string;
  userId?: string;
  userRole?: string;
}

/**
 * Interface para parâmetros de busca de estágios do funil
 */
export interface GetFunnelStagesParams {
  funnelId: string;
  userId?: string;
  userRole?: string;
}

/**
 * Interface para parâmetros de criação de estágio
 */
export interface CreateFunnelStageParams {
  funnelId: string;
  stageData: Omit<InsertFunnelStage, "funnelId">;
  userId?: string;
  userRole?: string;
}

/**
 * Interface para parâmetros de reordenação de estágios
 */
export interface ReorderFunnelStagesParams {
  stageUpdates: { id: string; order: number }[];
  userId?: string;
  userRole?: string;
}

/**
 * Service responsável pela lógica de negócio dos funis de vendas
 *
 * Esta classe contém toda a lógica de negócio relacionada a funis,
 * validações, processamento de parâmetros e coordenação entre diferentes camadas.
 */
export class FunnelsService {
  private funnelsRepository = funnelsRepository;

  /**
   * Busca todos os funis de vendas disponíveis
   * @param params - Parâmetros de busca (incluindo dados do usuário)
   * @returns Promise<SalesFunnelWithStages[]> - Lista de funis com estágios e dados do criador
   */
  async getFunnels(params: GetFunnelsParams): Promise<SalesFunnelWithStages[]> {
    try {
      // Por enquanto, retorna todos os funis
      // Futuramente pode incluir filtros baseados no usuário/role
      const funnels = await this.funnelsRepository.getSalesFunnels();
      return funnels;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao buscar funis de vendas");
    }
  }

  /**
   * Cria um novo funil de vendas
   * @param params - Parâmetros de criação do funil
   * @returns Promise<SalesFunnel> - Funil criado
   */
  async createFunnel(params: CreateFunnelParams): Promise<SalesFunnel> {
    const { funnelData } = params;

    // Validações básicas
    if (!funnelData.name || funnelData.name.trim() === "") {
      throw new Error("Nome do funil é obrigatório");
    }

    if (!funnelData.createdBy) {
      throw new Error("Criador do funil é obrigatório");
    }

    try {
      const funnel = await this.funnelsRepository.createSalesFunnel(funnelData);
      return funnel;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao criar funil de vendas");
    }
  }

  /**
   * Processa parâmetros da requisição para busca de funis
   * @param req - Objeto de requisição
   * @returns GetFunnelsParams - Parâmetros processados
   */
  processGetFunnelsParams(req: any): GetFunnelsParams {
    const userId = req.user?.id || req.user?.userId || req.userId;
    const userRole = req.user?.role || req.user?.userRole || req.userRole;

    return {
      userId,
      userRole,
    };
  }

  /**
   * Atualiza um funil de vendas existente
   * @param params - Parâmetros de atualização do funil
   * @returns Promise<SalesFunnel> - Funil atualizado
   */
  async updateFunnel(params: UpdateFunnelParams): Promise<SalesFunnel> {
    const { funnelId, funnelData } = params;

    // Validações básicas
    if (!funnelId || funnelId.trim() === "") {
      throw new Error("ID do funil é obrigatório");
    }

    // Validar nome se fornecido
    if (
      funnelData.name !== undefined &&
      (!funnelData.name || funnelData.name.trim() === "")
    ) {
      throw new Error("Nome do funil não pode estar vazio");
    }

    try {
      const funnel = await this.funnelsRepository.updateSalesFunnel(
        funnelId,
        funnelData
      );

      if (!funnel) {
        throw new Error("Funil não encontrado");
      }

      return funnel;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao atualizar funil de vendas");
    }
  }

  /**
   * Processa parâmetros da requisição para criação de funil
   * @param req - Objeto de requisição
   * @returns CreateFunnelParams - Parâmetros processados
   */
  processCreateFunnelParams(req: any): CreateFunnelParams {
    const userId = req.user?.id || req.user?.userId || req.userId;
    const userRole = req.user?.role || req.user?.userRole || req.userRole;

    return {
      funnelData: req.body,
      userId,
      userRole,
    };
  }

  /**
   * Exclui um funil de vendas e todos os dados relacionados
   * @param params - Parâmetros de exclusão do funil
   * @returns Promise<void> - Operação concluída sem retorno
   */
  async deleteFunnel(params: DeleteFunnelParams): Promise<void> {
    const { funnelId } = params;

    // Validações básicas
    if (!funnelId || funnelId.trim() === "") {
      throw new Error("ID do funil é obrigatório");
    }

    try {
      const success = await this.funnelsRepository.deleteSalesFunnel(funnelId);

      if (!success) {
        throw new Error("Funil não encontrado");
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao excluir funil de vendas");
    }
  }

  /**
   * Processa parâmetros da requisição para atualização de funil
   * @param req - Objeto de requisição
   * @returns UpdateFunnelParams - Parâmetros processados
   */
  processUpdateFunnelParams(req: any): UpdateFunnelParams {
    const userId = req.user?.id || req.user?.userId || req.userId;
    const userRole = req.user?.role || req.user?.userRole || req.userRole;

    return {
      funnelId: req.params.id,
      funnelData: req.body,
      userId,
      userRole,
    };
  }

  /**
   * Busca todos os estágios de um funil específico
   * @param params - Parâmetros de busca dos estágios
   * @returns Promise<FunnelStage[]> - Lista de estágios ordenados por ordem
   */
  async getFunnelStages(params: GetFunnelStagesParams): Promise<FunnelStage[]> {
    const { funnelId } = params;

    // Validações básicas
    if (!funnelId || funnelId.trim() === "") {
      throw new Error("ID do funil é obrigatório");
    }

    try {
      const stages = await this.funnelsRepository.getFunnelStages(funnelId);
      return stages;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao buscar estágios do funil");
    }
  }

  /**
   * Processa parâmetros da requisição para exclusão de funil
   * @param req - Objeto de requisição
   * @returns DeleteFunnelParams - Parâmetros processados
   */
  processDeleteFunnelParams(req: any): DeleteFunnelParams {
    const userId = req.user?.id || req.user?.userId || req.userId;
    const userRole = req.user?.role || req.user?.userRole || req.userRole;

    return {
      funnelId: req.params.id,
      userId,
      userRole,
    };
  }

  /**
   * Processa parâmetros da requisição para busca de estágios do funil
   * @param req - Objeto de requisição
   * @returns GetFunnelStagesParams - Parâmetros processados
   */
  processGetFunnelStagesParams(req: any): GetFunnelStagesParams {
    const userId = req.user?.id || req.user?.userId || req.userId;
    const userRole = req.user?.role || req.user?.userRole || req.userRole;

    return {
      funnelId: req.params.funnelId,
      userId,
      userRole,
    };
  }

  /**
   * Cria um novo estágio em um funil de vendas
   * @param params - Parâmetros de criação do estágio
   * @returns Promise<FunnelStage> - Estágio criado
   */
  async createFunnelStage(
    params: CreateFunnelStageParams
  ): Promise<FunnelStage> {
    const { funnelId, stageData } = params;

    // Validações básicas
    if (!funnelId || funnelId.trim() === "") {
      throw new Error("ID do funil é obrigatório");
    }

    try {
      // Combina dados do estágio com o ID do funil
      const completeStageData: InsertFunnelStage = {
        ...stageData,
        funnelId,
      };

      // Validação com Zod schema
      const validatedData = insertFunnelStageSchema.parse(completeStageData);

      const stage = await this.funnelsRepository.createFunnelStage(
        validatedData
      );
      return stage;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao criar estágio do funil");
    }
  }

  /**
   * Processa parâmetros da requisição para criação de estágio
   * @param req - Objeto de requisição
   * @returns CreateFunnelStageParams - Parâmetros processados
   */
  processCreateFunnelStageParams(req: any): CreateFunnelStageParams {
    const userId = req.user?.id || req.user?.userId || req.userId;
    const userRole = req.user?.role || req.user?.userRole || req.userRole;

    return {
      funnelId: req.params.funnelId,
      stageData: req.body,
      userId,
      userRole,
    };
  }

  /**
   * Reordena múltiplos estágios de funis em uma operação atômica
   * @param params - Parâmetros de reordenação dos estágios
   * @returns Promise<void> - Operação concluída sem retorno
   */
  async reorderFunnelStages(params: ReorderFunnelStagesParams): Promise<void> {
    const { stageUpdates } = params;

    // Validações básicas
    if (!Array.isArray(stageUpdates)) {
      throw new Error("Lista de atualizações de estágios deve ser um array");
    }

    if (stageUpdates.length === 0) {
      throw new Error("Lista de atualizações não pode estar vazia");
    }

    // Validar cada item do array
    for (const update of stageUpdates) {
      if (!update.id || update.id.trim() === "") {
        throw new Error("ID do estágio é obrigatório em todas as atualizações");
      }

      if (update.order === undefined || update.order === null) {
        throw new Error("Ordem é obrigatória em todas as atualizações");
      }

      if (update.order < 1) {
        throw new Error("Ordem deve ser maior que zero");
      }
    }

    try {
      const success = await this.funnelsRepository.reorderFunnelStages(
        stageUpdates
      );

      if (!success) {
        throw new Error("Falha ao reordenar estágios");
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao reordenar estágios do funil");
    }
  }

  /**
   * Processa parâmetros da requisição para reordenação de estágios
   * @param req - Objeto de requisição
   * @returns ReorderFunnelStagesParams - Parâmetros processados
   */
  processReorderFunnelStagesParams(req: any): ReorderFunnelStagesParams {
    const userId = req.user?.id || req.user?.userId || req.userId;
    const userRole = req.user?.role || req.user?.userRole || req.userRole;

    return {
      stageUpdates: req.body.stageUpdates,
      userId,
      userRole,
    };
  }
}

// Instância singleton do service
export const funnelsService = new FunnelsService();
