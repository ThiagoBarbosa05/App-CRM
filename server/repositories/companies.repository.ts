import {
  Company,
  companies,
  sectors,
  users,
  InsertCompany,
} from "@shared/schema";
import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "server/db";
import { CompanyFilters } from "server/storage";

/**
 * Repository para operações de empresas
 * Responsável pelo acesso aos dados de empresas
 */
export class CompaniesRepository {
  private db;

  constructor(database = db) {
    this.db = database;
  }

  /**
   * Busca empresas com filtros, paginação e controle de acesso
   * @param userId - ID do usuário
   * @param userRole - Role do usuário (admin, gerente, vendedor)
   * @param filters - Filtros de busca
   * @param page - Página atual
   * @param pageSize - Tamanho da página
   * @returns Promise<{data: Company[], total: number}> - Empresas e total
   */
  async getCompanies(
    // userId?: string,
    // userRole?: string,
    filters: CompanyFilters = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ data: Company[]; total: number }> {
    try {
      let query = this.db.select().from(companies);
      const conditions: any[] = [];

      // if (userRole === "vendedor" && userId) {
      //   conditions.push(eq(companies.responsavelId, userId));
      // }

      if (filters.nomeFantasia) {
        conditions.push(
          ilike(companies.nomeFantasia, `%${filters.nomeFantasia}%`)
        );
      }
      if (filters.razaoSocial) {
        conditions.push(
          ilike(companies.razaoSocial, `%${filters.razaoSocial}%`)
        );
      }
      if (filters.cnpj) {
        conditions.push(ilike(companies.cnpj, `%${filters.cnpj}%`));
      }
      if (filters.responsavelId) {
        conditions.push(eq(companies.responsavelId, filters.responsavelId));
      }

      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        conditions.push(
          or(
            ilike(companies.nomeFantasia, searchTerm),
            ilike(companies.razaoSocial, searchTerm),
            ilike(companies.cnpj, searchTerm)
          )
        );
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      const totalQuery = this.db
        .select({ count: count() })
        .from(companies)
        .where(and(...conditions));

      const offset = (page - 1) * pageSize;
      const result = await query
        .orderBy(desc(companies.createdAt))
        .limit(pageSize)
        .offset(offset);
      const total = await totalQuery;

      return { data: result, total: total[0].count };
    } catch (error) {
      console.error("Erro na query getCompanies:", error);
      throw error;
    }
  }
  // async getCompanies(
  //   userId: string,
  //   userRole: string,
  //   filters: CompanyFilters = {},
  //   page: number = 1,
  //   pageSize: number = 20
  // ): Promise<{ data: Company[]; total: number }> {
  //   try {
  //     // Condições para filtros e controle de acesso
  //     const conditions = [];

  //     // Controle de acesso baseado em role
  //     if (userRole === "vendedor") {
  //       conditions.push(eq(companies.responsavelId, userId));
  //     }

  //     // Filtro de busca geral
  //     if (filters.search) {
  //       conditions.push(
  //         or(
  //           ilike(companies.nomeFantasia, `%${filters.search}%`),
  //           ilike(companies.razaoSocial, `%${filters.search}%`),
  //           ilike(companies.cnpj, `%${filters.search}%`),
  //           ilike(companies.email, `%${filters.search}%`),
  //           ilike(companies.phone, `%${filters.search}%`)
  //         )
  //       );
  //     }

  //     // Filtros específicos
  //     if (filters.nomeFantasia) {
  //       conditions.push(
  //         ilike(companies.nomeFantasia, `%${filters.nomeFantasia}%`)
  //       );
  //     }

  //     if (filters.razaoSocial) {
  //       conditions.push(
  //         ilike(companies.razaoSocial, `%${filters.razaoSocial}%`)
  //       );
  //     }

  //     if (filters.cnpj) {
  //       conditions.push(ilike(companies.cnpj, `%${filters.cnpj}%`));
  //     }

  //     if (filters.responsavelId) {
  //       conditions.push(eq(companies.responsavelId, filters.responsavelId));
  //     }

  //     // Query base com joins para setor e responsável
  //     const baseQuery = this.db
  //       .select({
  //         id: companies.id,
  //         nomeFantasia: companies.nomeFantasia,
  //         razaoSocial: companies.razaoSocial,
  //         cnpj: companies.cnpj,
  //         inscricaoEstadual: companies.inscricaoEstadual,
  //         nomeComprador: companies.nomeComprador,
  //         phone: companies.phone,
  //         fixedPhone: companies.fixedPhone,
  //         email: companies.email,
  //         website: companies.website,
  //         cep: companies.cep,
  //         address: companies.address,
  //         neighborhood: companies.neighborhood,
  //         city: companies.city,
  //         state: companies.state,
  //         sectorId: companies.sectorId,
  //         responsavelId: companies.responsavelId,
  //         notes: companies.notes,
  //         active: companies.active,
  //         createdAt: companies.createdAt,
  //         updatedAt: companies.updatedAt,
  //         // Dados do setor
  //         sectorName: sectors.name,
  //         sectorColor: sectors.color,
  //         // Dados do responsável
  //         responsavelName: users.name,
  //         responsavelEmail: users.email,
  //       })
  //       .from(companies)
  //       .leftJoin(sectors, eq(companies.sectorId, sectors.id))
  //       .leftJoin(users, eq(companies.responsavelId, users.id));

  //     // Query de contagem
  //     const baseCountQuery = this.db
  //       .select({ count: sql<number>`count(*)` })
  //       .from(companies)
  //       .leftJoin(sectors, eq(companies.sectorId, sectors.id))
  //       .leftJoin(users, eq(companies.responsavelId, users.id));

  //     // Executar consultas
  //     const [companiesResult, totalResult] = await Promise.all([
  //       conditions.length > 0
  //         ? baseQuery
  //             .where(and(...conditions))
  //             .orderBy(desc(companies.createdAt))
  //             .limit(pageSize)
  //             .offset((page - 1) * pageSize)
  //         : baseQuery
  //             .orderBy(desc(companies.createdAt))
  //             .limit(pageSize)
  //             .offset((page - 1) * pageSize),
  //       conditions.length > 0
  //         ? baseCountQuery.where(and(...conditions))
  //         : baseCountQuery,
  //     ]);

  //     const total = totalResult[0]?.count || 0;

  //     return {
  //       data: companiesResult as Company[],
  //       total,
  //     };
  //   } catch (error) {
  //     console.error("Erro ao buscar empresas:", error);
  //     throw error;
  //   }
  // }

  /**
   * Cria uma nova empresa
   * @param insertCompany - Dados da empresa para criação
   * @returns Promise<Company> - Empresa criada
   */
  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    try {
      const [company] = await this.db
        .insert(companies)
        .values({
          ...insertCompany,
          sectorId:
            insertCompany.sectorId && insertCompany.sectorId.trim() !== ""
              ? insertCompany.sectorId
              : null,
          responsavelId:
            insertCompany.responsavelId &&
            insertCompany.responsavelId.trim() !== ""
              ? insertCompany.responsavelId
              : null,
        })
        .returning();

      return company;
    } catch (error) {
      console.error("Erro ao criar empresa:", error);
      throw error;
    }
  }

  /**
   * Atualiza uma empresa existente
   * @param id - ID da empresa
   * @param updateData - Dados para atualização
   * @returns Promise<Company | undefined> - Empresa atualizada ou undefined se não encontrada
   */
  async updateCompany(
    id: string,
    updateData: Partial<InsertCompany>
  ): Promise<Company | undefined> {
    try {
      // Handle empty string conversion to null for foreign keys
      const processedData = {
        ...updateData,
        updatedAt: new Date(),
      };

      if ("sectorId" in updateData) {
        processedData.sectorId =
          updateData.sectorId && updateData.sectorId.trim() !== ""
            ? updateData.sectorId
            : null;
      }

      if ("responsavelId" in updateData) {
        processedData.responsavelId =
          updateData.responsavelId && updateData.responsavelId.trim() !== ""
            ? updateData.responsavelId
            : null;
      }

      const [company] = await this.db
        .update(companies)
        .set(processedData)
        .where(eq(companies.id, id))
        .returning();

      return company;
    } catch (error) {
      console.error("Erro ao atualizar empresa:", error);
      throw error;
    }
  }

  /**
   * Exclui uma empresa existente
   * @param id - ID da empresa
   * @returns Promise<boolean> - true se a empresa foi excluída, false se não foi encontrada
   */
  async deleteCompany(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(companies)
        .where(eq(companies.id, id));
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Erro ao excluir empresa:", error);
      throw error;
    }
  }

  /**
   * Exclui múltiplas empresas em lote
   * @param ids - Array de IDs das empresas
   * @returns Promise<number> - Número de empresas excluídas
   */
  async deleteCompanies(ids: string[]): Promise<number> {
    try {
      const result = await this.db
        .delete(companies)
        .where(inArray(companies.id, ids));
      return result.rowCount || 0;
    } catch (error) {
      console.error("Erro ao excluir empresas em lote:", error);
      throw error;
    }
  }
}
