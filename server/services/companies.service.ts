import { CompaniesRepository } from "../repositories/companies.repository";
import { CompanyFilters } from "server/storage";
import { InsertCompany, Company } from "@shared/schema";

/**
 * Interface para parâmetros de busca de empresas
 */
export interface GetCompaniesParams {
  // userId: string;
  // userRole: string;
  filters: CompanyFilters;
  page: number;
  pageSize: number;
}

/**
 * Interface para parâmetros de criação de empresa
 */
export interface CreateCompanyParams {
  companyData: InsertCompany;
  userId?: string;
  userRole?: string;
}

/**
 * Interface para parâmetros de atualização de empresa
 */
export interface UpdateCompanyParams {
  id: string;
  updateData: Partial<InsertCompany>;
  userId?: string;
  userRole?: string;
}

/**
 * Interface para parâmetros de exclusão de empresa
 */
export interface DeleteCompanyParams {
  id: string;
  userId?: string;
  userRole?: string;
}

/**
 * Interface para parâmetros de exclusão em lote de empresas
 */
export interface DeleteCompaniesBulkParams {
  companyIds: string[];
  userId?: string;
  userRole?: string;
}

/**
 * Service para lógica de negócio de empresas
 * Responsável por processar regras de negócio e validações
 */
export class CompaniesService {
  constructor(private companiesRepository = new CompaniesRepository()) {}

  /**
   * Busca empresas com filtros, paginação e controle de acesso baseado em role
   * @param params - Parâmetros de busca
   * @returns Promise<{data: Company[], total: number}> - Empresas e total
   */
  async getCompanies(params: GetCompaniesParams) {
    const { filters, page, pageSize } = params;

    // Validações de entrada
    // if (!userId || !userRole) {
    //   throw new Error("ID do usuário e role são obrigatórios");
    // }

    if (page < 1 || pageSize < 1) {
      throw new Error("Página e tamanho da página devem ser positivos");
    }

    if (pageSize > 100) {
      throw new Error("Tamanho máximo da página é 100");
    }

    try {
      return await this.companiesRepository.getCompanies(
        // userId,
        // userRole,
        filters,
        page,
        pageSize
      );
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao buscar empresas");
    }
  }

  /**
   * Processa parâmetros da requisição para busca de empresas
   * @param req - Objeto de requisição
   * @returns GetCompaniesParams - Parâmetros processados
   */
  processGetCompaniesParams(req: any): GetCompaniesParams {
    // Extrair dados do usuário dos headers ou do objeto user
    const userId =
      req.user?.id ||
      req.user?.userId ||
      req.userId ||
      (req.query?.userId as string);
    const userRole =
      req.user?.role ||
      req.user?.userRole ||
      req.userRole ||
      (req.query?.userRole as string);

    // Processar paginação
    const page = Math.max(1, parseInt(req.query?.page as string) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(req.query?.pageSize as string) || 20)
    );

    // Processar filtros
    const filters: CompanyFilters = {
      search: req.query?.search as string | undefined,
      nomeFantasia: req.query?.nomeFantasia as string | undefined,
      razaoSocial: req.query?.razaoSocial as string | undefined,
      cnpj: req.query?.cnpj as string | undefined,
      responsavelId: req.query?.responsavelId as string | undefined,
    };

    // Remover filtros vazios
    Object.keys(filters).forEach((key) => {
      if (!filters[key as keyof CompanyFilters]) {
        delete filters[key as keyof CompanyFilters];
      }
    });

    return {
      // userId,
      // userRole,
      filters,
      page,
      pageSize,
    };
  }

  /**
   * Cria uma nova empresa
   * @param params - Parâmetros de criação
   * @returns Promise<Company> - Empresa criada
   */
  async createCompany(params: CreateCompanyParams): Promise<Company> {
    const { companyData } = params;

    // Validações básicas
    if (!companyData.nomeFantasia || !companyData.razaoSocial) {
      throw new Error("Nome fantasia e razão social são obrigatórios");
    }

    try {
      return await this.companiesRepository.createCompany(companyData);
    } catch (error) {
      if (error instanceof Error) {
        // Tratar erro de CNPJ duplicado
        if (error.message.includes("companies_cnpj_unique")) {
          throw new Error("CNPJ já cadastrado");
        }
        throw error;
      }
      throw new Error("Erro ao criar empresa");
    }
  }

  /**
   * Processa parâmetros para criação de empresa
   * @param req - Objeto de requisição
   * @returns CreateCompanyParams - Parâmetros processados
   */
  processCreateCompanyParams(req: any): CreateCompanyParams {
    const userId = req.user?.id || req.user?.userId || req.userId;
    const userRole = req.user?.role || req.user?.userRole || req.userRole;
    const companyData = req.body;

    return {
      companyData,
      userId,
      userRole,
    };
  }

  /**
   * Atualiza uma empresa existente
   * @param params - Parâmetros de atualização
   * @returns Promise<Company> - Empresa atualizada
   */
  async updateCompany(params: UpdateCompanyParams): Promise<Company> {
    const { id, updateData } = params;

    // Validações básicas
    if (!id) {
      throw new Error("ID da empresa é obrigatório");
    }

    try {
      const company = await this.companiesRepository.updateCompany(
        id,
        updateData
      );

      if (!company) {
        throw new Error("Empresa não encontrada");
      }

      return company;
    } catch (error) {
      if (error instanceof Error) {
        // Tratar erro de CNPJ duplicado
        if (error.message.includes("companies_cnpj_unique")) {
          throw new Error("CNPJ já cadastrado");
        }
        throw error;
      }
      throw new Error("Erro ao atualizar empresa");
    }
  }

  /**
   * Processa parâmetros para atualização de empresa
   * @param req - Objeto de requisição
   * @returns UpdateCompanyParams - Parâmetros processados
   */
  processUpdateCompanyParams(req: any): UpdateCompanyParams {
    const userId = req.user?.id || req.user?.userId || req.userId;
    const userRole = req.user?.role || req.user?.userRole || req.userRole;
    const id = req.params?.id;
    const updateData = req.body;

    return {
      id,
      updateData,
      userId,
      userRole,
    };
  }

  /**
   * Exclui uma empresa existente
   * @param params - Parâmetros de exclusão
   * @returns Promise<boolean> - true se excluída com sucesso
   */
  async deleteCompany(params: DeleteCompanyParams): Promise<boolean> {
    const { id } = params;

    // Validações básicas
    if (!id) {
      throw new Error("ID da empresa é obrigatório");
    }

    try {
      const success = await this.companiesRepository.deleteCompany(id);

      if (!success) {
        throw new Error("Empresa não encontrada");
      }

      return success;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao excluir empresa");
    }
  }

  /**
   * Processa parâmetros para exclusão de empresa
   * @param req - Objeto de requisição
   * @returns DeleteCompanyParams - Parâmetros processados
   */
  processDeleteCompanyParams(req: any): DeleteCompanyParams {
    const userId = req.user?.id || req.user?.userId || req.userId;
    const userRole = req.user?.role || req.user?.userRole || req.userRole;
    const id = req.params?.id;

    return {
      id,
      userId,
      userRole,
    };
  }

  /**
   * Exclui múltiplas empresas em lote
   * @param params - Parâmetros de exclusão em lote
   * @returns Promise<{deletedCount: number}> - Resultado da operação
   */
  async deleteCompaniesBulk(
    params: DeleteCompaniesBulkParams
  ): Promise<{ deletedCount: number }> {
    const { companyIds } = params;

    // Validações básicas
    if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
      throw new Error("Lista de IDs de empresas é obrigatória");
    }

    // Verifica se todos os IDs são válidos
    const invalidIds = companyIds.filter((id) => !id || typeof id !== "string");
    if (invalidIds.length > 0) {
      throw new Error("IDs de empresas inválidos encontrados");
    }

    // Limite de segurança
    if (companyIds.length > 100) {
      throw new Error("Máximo de 100 empresas podem ser excluídas por vez");
    }

    try {
      const deletedCount = await this.companiesRepository.deleteCompanies(
        companyIds
      );
      return { deletedCount };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("Erro ao excluir empresas em lote");
    }
  }

  /**
   * Processa parâmetros para exclusão em lote de empresas
   * @param req - Objeto de requisição
   * @returns DeleteCompaniesBulkParams - Parâmetros processados
   */
  processDeleteCompaniesBulkParams(req: any): DeleteCompaniesBulkParams {
    const userId = req.user?.id || req.user?.userId || req.userId;
    const userRole = req.user?.role || req.user?.userRole || req.userRole;
    const { ids } = req.body;

    return {
      companyIds: ids,
      userId,
      userRole,
    };
  }
}

// Instância singleton do service
export const companiesService = new CompaniesService();
