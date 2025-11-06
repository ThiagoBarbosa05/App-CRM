import { db } from "../db";
import {
  deals,
  clients,
  companies,
  users,
  funnelStages,
  salesFunnels,
  type Deal,
  type DealWithClient,
  type InsertDeal,
} from "../../shared/schema";
import { eq, and } from "drizzle-orm";

/**
 * Repository responsável pelo acesso a dados dos deals (negócios)
 *
 * Esta classe encapsula todas as operações de banco de dados relacionadas a deals,
 * seguindo o padrão Repository para separar a lógica de acesso a dados da lógica de negócio.
 */
export class DealsRepository {
  private db = db;

  /**
   * Busca todos os deals com dados relacionados (clientes, empresas, usuários, estágios, funis)
   * @param funnelId - ID do funil para filtrar (opcional)
   * @param userId - ID do usuário para filtrar (opcional)
   * @param userRole - Role do usuário para controle de acesso (opcional)
   * @returns Promise<DealWithClient[]> - Lista de deals com dados relacionados
   */
  async getDealsWithClients(
    funnelId?: string,
    userId?: string,
    userRole?: string
  ): Promise<DealWithClient[]> {
    // Usar uma única query com JOINs para otimizar performance
    let query = this.db
      .select({
        deal: deals,
        client: clients,
        company: companies,
        assignedUser: users,
        stage: funnelStages,
        funnel: salesFunnels,
      })
      .from(deals)
      .leftJoin(clients, eq(deals.clientId, clients.id))
      .leftJoin(companies, eq(deals.companyId, companies.id))
      .leftJoin(users, eq(deals.assignedTo, users.id))
      .leftJoin(funnelStages, eq(deals.stageId, funnelStages.id))
      .leftJoin(salesFunnels, eq(deals.funnelId, salesFunnels.id));

    // Aplicar condições de filtro
    const conditions = [];
    if (funnelId) conditions.push(eq(deals.funnelId, funnelId));
    if (userRole === "vendedor" && userId)
      conditions.push(eq(deals.assignedTo, userId));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(deals.createdAt);

    // Mapear resultados para o formato esperado
    const dealsWithClients: DealWithClient[] = results.reverse().map((row) => ({
      ...row.deal,
      client: row.client,
      company: row.company,
      assignedUser: row.assignedUser,
      stage: row.stage,
      funnel: row.funnel,
    }));

    return dealsWithClients;
  }

  /**
   * Atualiza um deal existente
   * @param id - ID do deal a ser atualizado
   * @param updateData - Dados parciais para atualização
   * @returns Promise<Deal | undefined> - Deal atualizado ou undefined se não encontrado
   */
  async updateDeal(
    id: string,
    updateData: Partial<InsertDeal>
  ): Promise<Deal | undefined> {
    const [deal] = await this.db
      .update(deals)
      .set(updateData)
      .where(eq(deals.id, id))
      .returning();
    return deal || undefined;
  }

  /**
   * Cria um novo deal
   * @param insertData - Dados do deal a ser criado
   * @returns Promise<Deal> - Deal criado
   */
  async createDeal(insertData: InsertDeal): Promise<Deal> {
    const [deal] = await this.db.insert(deals).values(insertData).returning();
    return deal;
  }

  /**
   * Busca um cliente por ID
   * @param id - ID do cliente
   * @returns Promise<Client | undefined> - Cliente encontrado ou undefined
   */
  async getClientById(
    id: string
  ): Promise<typeof clients.$inferSelect | undefined> {
    const [client] = await this.db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);
    return client || undefined;
  }

  /**
   * Busca uma empresa por ID
   * @param id - ID da empresa
   * @returns Promise<Company | undefined> - Empresa encontrada ou undefined
   */
  async getCompanyById(
    id: string
  ): Promise<typeof companies.$inferSelect | undefined> {
    const [company] = await this.db
      .select()
      .from(companies)
      .where(eq(companies.id, id))
      .limit(1);
    return company || undefined;
  }

  /**
   * Cria múltiplos deals em lote
   * @param dealsData - Array de dados dos deals a serem criados
   * @returns Promise<Deal[]> - Array de deals criados
   */
  async createDealsInBulk(dealsData: InsertDeal[]): Promise<Deal[]> {
    if (dealsData.length === 0) {
      return [];
    }

    const createdDeals = await this.db
      .insert(deals)
      .values(dealsData)
      .returning();
    return createdDeals;
  }

  /**
   * Exclui um deal existente
   * @param id - ID do deal a ser excluído
   * @returns Promise<boolean> - true se o deal foi excluído, false se não foi encontrado
   */
  async deleteDeal(id: string): Promise<boolean> {
    const result = await this.db.delete(deals).where(eq(deals.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
}

// Instância singleton do repository
export const dealsRepository = new DealsRepository();
