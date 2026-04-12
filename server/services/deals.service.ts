import { dealsRepository } from "../repositories/deals.repository";
import {
  updateDealSchema,
  type DealWithClient,
  type Deal,
  type InsertDeal,
} from "../../shared/schema";

/**
 * Interface para parâmetros de busca de deals
 */
export interface GetDealsParams {
  funnelId?: string;
  userId?: string;
  userRole?: string;
}

/**
 * Interface para parâmetros de atualização de deal
 */
export interface UpdateDealParams {
  dealId: string;
  dealData: Partial<InsertDeal>;
  userId?: string;
  userRole?: string;
}

/**
 * Interface para parâmetros de criação de deal
 */
export interface CreateDealParams {
  dealData: InsertDeal;
  userId?: string;
  userRole?: string;
}

/**
 * Interface para parâmetros de criação de deals em lote
 */
export interface CreateBulkDealsParams {
  companies: string[];
  funnelId: string;
  stageId: string;
  value: string;
  assignedTo: string;
  notes?: string;
  title?: string;
  userId?: string;
  userRole?: string;
}

/**
 * Interface para parâmetros de criação de deals em lote para clientes
 */
export interface CreateBulkDealsClientsParams {
  clients: string[];
  funnelId: string;
  stageId: string;
  value: string;
  assignedTo: string;
  notes?: string;
  title?: string;
  userId?: string;
  userRole?: string;
}

/**
 * Interface para resultado da criação em lote
 */
export interface BulkCreateResult {
  success: boolean;
  created: number;
  total: number;
  deals: Deal[];
  errors?: string[];
}

/**
 * Interface para parâmetros de exclusão de deal
 */
export interface DeleteDealParams {
  dealId: string;
  userId?: string;
  userRole?: string;
}

/**
 * Service responsável pela lógica de negócio dos deals (negócios)
 *
 * Esta classe contém toda a lógica de negócio relacionada a deals,
 * validações, processamento de parâmetros e coordenação entre diferentes camadas.
 */
export class DealsService {
  private dealsRepository = dealsRepository;

  /**
   * Busca todos os deals com dados relacionados
   * @param params - Parâmetros de busca (incluindo filtros e dados do usuário)
   * @returns Promise<DealWithClient[]> - Lista de deals com dados relacionados
   */
  async getDeals(params: GetDealsParams): Promise<DealWithClient[]> {
    const { funnelId, userId, userRole } = params;

    try {
      const deals = await this.dealsRepository.getDealsWithClients(
        funnelId,
        userId,
        userRole
      );
      return deals;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao buscar deals");
    }
  }

  /**
   * Processa parâmetros da requisição para busca de deals
   * @param req - Objeto de requisição
   * @returns GetDealsParams - Parâmetros processados
   */
  processGetDealsParams(req: any): GetDealsParams {
    const userId = (req.query.userId as string) || req.user?.userId;
    const userRole = req.user?.role;
    const funnelId = req.query.funnelId;

    return {
      funnelId,
      userId,
      userRole,
    };
  }

  /**
   * Cria um novo deal
   * @param params - Parâmetros de criação do deal
   * @returns Promise<Deal> - Deal criado
   */
  async createDeal(params: CreateDealParams): Promise<Deal> {
    const { dealData } = params;

    try {
      // Validações específicas para criação
      const validatedData = { ...dealData };

      // Validar o valor se estiver presente
      if (validatedData.value !== undefined && validatedData.value !== null) {
        const numeric = parseFloat(validatedData.value.toString());

        if (isNaN(numeric)) {
          throw new Error("Valor inválido");
        }

        validatedData.value = numeric.toString();
      }

      // Gerar título se não fornecido
      if (!validatedData.title) {
        if (validatedData.clientId) {
          const client = await this.dealsRepository.getClientById(
            validatedData.clientId
          );
          validatedData.title = client
            ? `Negócio - ${client.name}`
            : "Novo Negócio";
        } else if (validatedData.companyId) {
          const company = await this.dealsRepository.getCompanyById(
            validatedData.companyId
          );
          validatedData.title = company
            ? `Negócio - ${company.nomeFantasia || company.razaoSocial}`
            : "Novo Negócio";
        } else {
          validatedData.title = "Novo Negócio";
        }
      }

      const deal = await this.dealsRepository.createDeal(validatedData);
      return deal;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao criar deal");
    }
  }

  /**
   * Processa parâmetros da requisição para criação de deal
   * @param req - Objeto de requisição
   * @returns CreateDealParams - Parâmetros processados
   */
  processCreateDealParams(req: any): CreateDealParams {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    return {
      dealData: req.body,
      userId,
      userRole,
    };
  }

  /**
   * Cria múltiplos deals em lote para empresas
   * @param params - Parâmetros de criação em lote
   * @returns Promise<BulkCreateResult> - Resultado da operação em lote
   */
  async createBulkDeals(
    params: CreateBulkDealsParams
  ): Promise<BulkCreateResult> {
    const { companies, funnelId, stageId, value, assignedTo, notes, title } =
      params;

    // Validações básicas
    if (!companies || !Array.isArray(companies) || companies.length === 0) {
      throw new Error("Empresas são obrigatórias");
    }

    if (!assignedTo) {
      throw new Error("Responsável é obrigatório");
    }

    if (!funnelId || !stageId) {
      throw new Error("Funil e estágio são obrigatórios");
    }

    const dealsToCreate: InsertDeal[] = [];
    const errors: string[] = [];

    // Preparar dados para cada empresa
    for (const companyId of companies) {
      try {
        const company = await this.dealsRepository.getCompanyById(companyId);
        if (!company) {
          errors.push(`Empresa com ID ${companyId} não encontrada`);
          continue;
        }

        const dealTitle =
          title || `Negócio - ${company.nomeFantasia || company.razaoSocial}`;

        const dealData: InsertDeal = {
          companyId,
          funnelId,
          stageId,
          value,
          assignedTo,
          notes: notes || null,
          title: dealTitle,
          createdBy: assignedTo,
        };

        dealsToCreate.push(dealData);
      } catch (error) {
        errors.push(
          `Erro ao processar empresa ${companyId}: ${
            error instanceof Error ? error.message : "Erro desconhecido"
          }`
        );
      }
    }

    // Se não há deals para criar, retornar erro
    if (dealsToCreate.length === 0) {
      return {
        success: false,
        created: 0,
        total: companies.length,
        deals: [],
        errors,
      };
    }

    try {
      // Criar deals em lote
      const createdDeals = await this.dealsRepository.createDealsInBulk(
        dealsToCreate
      );

      return {
        success: true,
        created: createdDeals.length,
        total: companies.length,
        deals: createdDeals,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      throw new Error(
        `Erro ao criar deals em lote: ${
          error instanceof Error ? error.message : "Erro desconhecido"
        }`
      );
    }
  }

  /**
   * Processa parâmetros da requisição para criação de deals em lote
   * @param req - Objeto de requisição
   * @returns CreateBulkDealsParams - Parâmetros processados
   */
  processCreateBulkDealsParams(req: any): CreateBulkDealsParams {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    return {
      companies: req.body.companies,
      funnelId: req.body.funnelId,
      stageId: req.body.stageId,
      value: req.body.value,
      assignedTo: req.body.assignedTo,
      notes: req.body.notes,
      title: req.body.title,
      userId,
      userRole,
    };
  }

  /**
   * Cria múltiplos deals em lote para clientes
   * @param params - Parâmetros de criação em lote para clientes
   * @returns Promise<BulkCreateResult> - Resultado da operação em lote
   */
  async createBulkDealsForClients(
    params: CreateBulkDealsClientsParams
  ): Promise<BulkCreateResult> {
    const { clients, funnelId, stageId, value, assignedTo, notes, title } =
      params;

    // Validações básicas
    if (!clients || !Array.isArray(clients) || clients.length === 0) {
      throw new Error("Clientes são obrigatórios");
    }

    if (!assignedTo) {
      throw new Error("Responsável é obrigatório");
    }

    if (!funnelId || !stageId) {
      throw new Error("Funil e estágio são obrigatórios");
    }

    const dealsToCreate: InsertDeal[] = [];
    const errors: string[] = [];

    // Preparar dados para cada cliente
    for (const clientId of clients) {
      try {
        const client = await this.dealsRepository.getClientById(clientId);
        if (!client) {
          errors.push(`Cliente com ID ${clientId} não encontrado`);
          continue;
        }

        const dealTitle = title || `Negócio - ${client.name}`;

        const dealData: InsertDeal = {
          clientId,
          funnelId,
          stageId,
          value,
          assignedTo,
          notes: notes || null,
          title: dealTitle,
          createdBy: assignedTo,
        };

        dealsToCreate.push(dealData);
      } catch (error) {
        errors.push(
          `Erro ao processar cliente ${clientId}: ${
            error instanceof Error ? error.message : "Erro desconhecido"
          }`
        );
      }
    }

    // Se não há deals para criar, retornar erro
    if (dealsToCreate.length === 0) {
      return {
        success: false,
        created: 0,
        total: clients.length,
        deals: [],
        errors,
      };
    }

    try {
      // Criar deals em lote
      const createdDeals = await this.dealsRepository.createDealsInBulk(
        dealsToCreate
      );

      return {
        success: true,
        created: createdDeals.length,
        total: clients.length,
        deals: createdDeals,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error) {
      throw new Error(
        `Erro ao criar deals em lote para clientes: ${
          error instanceof Error ? error.message : "Erro desconhecido"
        }`
      );
    }
  }

  /**
   * Processa parâmetros da requisição para criação de deals em lote para clientes
   * @param req - Objeto de requisição
   * @returns CreateBulkDealsClientsParams - Parâmetros processados
   */
  processCreateBulkDealsClientsParams(req: any): CreateBulkDealsClientsParams {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    return {
      clients: req.body.clients,
      funnelId: req.body.funnelId,
      stageId: req.body.stageId,
      value: req.body.value,
      assignedTo: req.body.assignedTo,
      notes: req.body.notes,
      title: req.body.title,
      userId,
      userRole,
    };
  }

  /**
   * Atualiza um deal existente
   * @param params - Parâmetros de atualização do deal
   * @returns Promise<Deal> - Deal atualizado
   */
  async updateDeal(params: UpdateDealParams): Promise<Deal> {
    const { dealId, dealData } = params;

    // Validações básicas
    if (!dealId || dealId.trim() === "") {
      throw new Error("ID do deal é obrigatório");
    }

    try {
      // Validação com Zod schema
      const validatedData = updateDealSchema.parse(dealData);

      // Validar o valor se estiver presente
      if (validatedData.value !== undefined && validatedData.value !== null) {
        const numeric = parseFloat(validatedData.value.toString());

        if (isNaN(numeric)) {
          throw new Error("Valor inválido");
        }

        validatedData.value = numeric.toString();
      }

      const deal = await this.dealsRepository.updateDeal(dealId, validatedData);

      if (!deal) {
        throw new Error("Deal não encontrado");
      }

      return deal;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao atualizar deal");
    }
  }

  /**
   * Processa parâmetros da requisição para atualização de deal
   * @param req - Objeto de requisição
   * @returns UpdateDealParams - Parâmetros processados
   */
  processUpdateDealParams(req: any): UpdateDealParams {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    return {
      dealId: req.params.dealId,
      dealData: req.body,
      userId,
      userRole,
    };
  }

  /**
   * Exclui um deal existente
   * @param params - Parâmetros de exclusão do deal
   * @returns Promise<void> - Operação concluída sem retorno
   */
  async deleteDeal(params: DeleteDealParams): Promise<void> {
    const { dealId } = params;

    // Validações básicas
    if (!dealId || dealId.trim() === "") {
      throw new Error("ID do deal é obrigatório");
    }

    try {
      const success = await this.dealsRepository.deleteDeal(dealId);

      if (!success) {
        throw new Error("Deal não encontrado");
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao excluir deal");
    }
  }

  /**
   * Processa parâmetros da requisição para exclusão de deal
   * @param req - Objeto de requisição
   * @returns DeleteDealParams - Parâmetros processados
   */
  processDeleteDealParams(req: any): DeleteDealParams {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    return {
      dealId: req.params.id,
      userId,
      userRole,
    };
  }
}

// Instância singleton do service
export const dealsService = new DealsService();
