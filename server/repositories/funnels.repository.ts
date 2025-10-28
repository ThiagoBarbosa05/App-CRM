import { db } from "../db";
import {
  salesFunnels,
  funnelStages,
  users,
  deals,
  type SalesFunnelWithStages,
  type SalesFunnel,
  type InsertSalesFunnel,
  type FunnelStage,
  type InsertFunnelStage,
} from "../../shared/schema";
import { eq } from "drizzle-orm";

/**
 * Repository responsável pelo acesso a dados dos funis de vendas
 *
 * Esta classe encapsula todas as operações de banco de dados relacionadas a funis,
 * seguindo o padrão Repository para separar a lógica de acesso a dados da lógica de negócio.
 */
export class FunnelsRepository {
  private db = db;

  /**
   * Busca todos os funis de vendas com seus estágios e criadores
   * @returns Promise<SalesFunnelWithStages[]> - Lista de funis com estágios e dados do criador
   */
  async getSalesFunnels(): Promise<SalesFunnelWithStages[]> {
    const funnels = await this.db
      .select()
      .from(salesFunnels)
      .orderBy(salesFunnels.createdAt);
    const funnelsWithStages: SalesFunnelWithStages[] = [];

    for (const funnel of funnels) {
      const stages = await this.db
        .select()
        .from(funnelStages)
        .where(eq(funnelStages.funnelId, funnel.id))
        .orderBy(funnelStages.order);

      const [creator] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, funnel.createdBy));

      funnelsWithStages.push({
        ...funnel,
        stages,
        creator,
      });
    }

    return funnelsWithStages;
  }

  /**
   * Cria um novo funil de vendas
   * @param insertFunnel - Dados do funil a ser criado
   * @returns Promise<SalesFunnel> - Funil criado
   */
  async createSalesFunnel(
    insertFunnel: InsertSalesFunnel
  ): Promise<SalesFunnel> {
    const [funnel] = await this.db
      .insert(salesFunnels)
      .values(insertFunnel)
      .returning();
    return funnel;
  }

  /**
   * Atualiza um funil de vendas existente
   * @param id - ID do funil a ser atualizado
   * @param updateData - Dados parciais para atualização
   * @returns Promise<SalesFunnel | undefined> - Funil atualizado ou undefined se não encontrado
   */
  async updateSalesFunnel(
    id: string,
    updateData: Partial<InsertSalesFunnel>
  ): Promise<SalesFunnel | undefined> {
    const [funnel] = await this.db
      .update(salesFunnels)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(salesFunnels.id, id))
      .returning();
    return funnel || undefined;
  }

  /**
   * Exclui um funil de vendas e todos os dados relacionados
   * @param id - ID do funil a ser excluído
   * @returns Promise<boolean> - true se o funil foi excluído, false se não foi encontrado
   */
  async deleteSalesFunnel(id: string): Promise<boolean> {
    // Primeiro, exclui todos os deals relacionados ao funil
    await this.db.delete(deals).where(eq(deals.funnelId, id));

    // Em seguida, exclui todos os estágios do funil
    await this.db.delete(funnelStages).where(eq(funnelStages.funnelId, id));

    // Por fim, exclui o funil em si
    const result = await this.db
      .delete(salesFunnels)
      .where(eq(salesFunnels.id, id));

    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Busca todos os estágios de um funil específico
   * @param funnelId - ID do funil
   * @returns Promise<FunnelStage[]> - Lista de estágios ordenados por ordem
   */
  async getFunnelStages(funnelId: string): Promise<FunnelStage[]> {
    return await this.db
      .select()
      .from(funnelStages)
      .where(eq(funnelStages.funnelId, funnelId))
      .orderBy(funnelStages.order);
  }

  /**
   * Cria um novo estágio em um funil de vendas
   * @param insertStage - Dados do estágio a ser criado
   * @returns Promise<FunnelStage> - Estágio criado
   */
  async createFunnelStage(
    insertStage: InsertFunnelStage
  ): Promise<FunnelStage> {
    const [stage] = await this.db
      .insert(funnelStages)
      .values(insertStage)
      .returning();
    return stage;
  }

  /**
   * Reordena múltiplos estágios de funis em uma transação atômica
   * @param stageUpdates - Array com IDs dos estágios e suas novas ordens
   * @returns Promise<boolean> - true se a reordenação foi bem-sucedida
   */
  async reorderFunnelStages(
    stageUpdates: { id: string; order: number }[]
  ): Promise<boolean> {
    try {
      await this.db.transaction(async (tx) => {
        for (const stageUpdate of stageUpdates) {
          await tx
            .update(funnelStages)
            .set({ order: stageUpdate.order })
            .where(eq(funnelStages.id, stageUpdate.id));
        }
      });
      return true;
    } catch (error) {
      console.error("Erro ao reordenar estágios do funil:", error);
      return false;
    }
  }
}

// Instância singleton do repository
export const funnelsRepository = new FunnelsRepository();
