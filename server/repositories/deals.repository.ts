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
import { eq, and, or, ilike, sql, desc, type SQL } from "drizzle-orm";

/**
 * Filtros aceitos na listagem de deals. Todos opcionais: sem nenhum deles a
 * consulta devolve o comportamento antigo (todos os deals visíveis).
 */
export interface DealsQueryFilters {
  funnelId?: string;
  userId?: string;
  userRole?: string;
  search?: string;
  valueMin?: number;
  valueMax?: number;
  dateFrom?: string;
  dateTo?: string;
  assignedTo?: string;
  /**
   * Máximo de negócios carregados por estágio. O board é um kanban: um limite
   * global truncaria colunas inteiras, então o corte é por coluna.
   */
  perStageLimit?: number;
}

/**
 * Contagem e soma de valores por estágio, para os totais do cabeçalho de cada
 * coluna continuarem corretos mesmo quando a lista vem truncada.
 */
export interface DealsStageSummary {
  stageId: string;
  count: number;
  totalValue: string;
}

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
  private buildDealsConditions(filters: DealsQueryFilters): SQL[] {
    const conditions: SQL[] = [];
    const {
      funnelId,
      userId,
      userRole,
      search,
      valueMin,
      valueMax,
      dateFrom,
      dateTo,
      assignedTo,
    } = filters;

    if (funnelId) conditions.push(eq(deals.funnelId, funnelId));

    // Vendedor só enxerga a própria carteira
    if (userRole === "vendedor" && userId) {
      conditions.push(eq(deals.assignedTo, userId));
    }

    if (assignedTo) conditions.push(eq(deals.assignedTo, assignedTo));

    if (search) {
      const term = `%${search}%`;
      const searchCondition = or(
        ilike(deals.title, term),
        ilike(deals.notes, term)
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    if (valueMin !== undefined) {
      conditions.push(sql`${deals.value} >= ${valueMin}`);
    }

    if (valueMax !== undefined) {
      conditions.push(sql`${deals.value} <= ${valueMax}`);
    }

    if (dateFrom) {
      conditions.push(sql`${deals.createdAt} >= ${dateFrom}`);
    }

    // dateTo é uma data (YYYY-MM-DD) e o filtro é inclusivo: pega o dia inteiro
    if (dateTo) {
      conditions.push(
        sql`${deals.createdAt} < (${dateTo}::date + interval '1 day')`
      );
    }

    return conditions;
  }

  async getDealsWithClients(
    filters: DealsQueryFilters = {}
  ): Promise<DealWithClient[]> {
    const conditions = this.buildDealsConditions(filters);
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const { perStageLimit } = filters;

    // Com limite por estágio, primeiro numera os deals dentro de cada coluna
    // e só então busca os relacionamentos dos que entram no corte — evita
    // trazer (e fazer JOIN de) o funil inteiro para exibir 100 cards.
    let idFilter: SQL | undefined;
    if (perStageLimit !== undefined) {
      const ranked = this.db
        .select({
          id: deals.id,
          rowNumber:
            sql<number>`row_number() over (partition by ${deals.stageId} order by ${deals.createdAt} desc)`.as(
              "row_number"
            ),
        })
        .from(deals)
        .where(where)
        .as("ranked");

      idFilter = sql`${deals.id} in (select ${ranked.id} from ${ranked} where ${ranked.rowNumber} <= ${perStageLimit})`;
    }

    const results = await this.db
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
      .leftJoin(salesFunnels, eq(deals.funnelId, salesFunnels.id))
      .where(idFilter ? and(where, idFilter) : where)
      .orderBy(desc(deals.createdAt));

    return results.map((row) => ({
      ...row.deal,
      client: row.client,
      company: row.company,
      assignedUser: row.assignedUser,
      stage: row.stage,
      funnel: row.funnel,
    }));
  }

  /**
   * Agrega contagem e valor total por estágio, respeitando os mesmos filtros
   * da listagem (mas ignorando o limite por estágio).
   * @param filters - Filtros da consulta
   * @returns Promise<DealsStageSummary[]>
   */
  async getDealsSummaryByStage(
    filters: DealsQueryFilters = {}
  ): Promise<DealsStageSummary[]> {
    const conditions = this.buildDealsConditions(filters);

    const rows = await this.db
      .select({
        stageId: deals.stageId,
        count: sql<number>`count(*)::int`,
        totalValue: sql<string>`coalesce(sum(${deals.value}), 0)::text`,
      })
      .from(deals)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(deals.stageId);

    return rows;
  }

  /**
   * Busca um único deal (com dados relacionados) pelo ID, sem aplicar
   * filtro de visibilidade por role/usuário. Útil para abrir os detalhes
   * de um negócio específico já conhecido (ex.: vindo do perfil do cliente),
   * independentemente de quem é o responsável pelo negócio.
   * @param id - ID do deal
   * @returns Promise<DealWithClient | undefined>
   */
  async getDealWithClientById(id: string): Promise<DealWithClient | undefined> {
    const [row] = await this.db
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
      .leftJoin(salesFunnels, eq(deals.funnelId, salesFunnels.id))
      .where(eq(deals.id, id));

    if (!row) return undefined;

    return {
      ...row.deal,
      client: row.client,
      company: row.company,
      assignedUser: row.assignedUser,
      stage: row.stage,
      funnel: row.funnel,
    };
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
