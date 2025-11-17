import { db } from "../db";
import {
  cashbackSettings,
  type CashbackSetting,
  type InsertCashbackSetting,
} from "../../shared/schema";
import { eq } from "drizzle-orm";

/**
 * Repository responsável por operações de banco de dados relacionadas a configurações de cashback
 */
class CashbackSettingsRepository {
  /**
   * Busca todas as configurações de cashback
   *
   * @returns Lista de configurações ordenadas por data de criação
   *
   * @example
   * const settings = await repository.getCashbackSettings();
   *
   * @notes
   * - Retorna todas as configurações ativas e inativas
   * - Ordenadas por data de criação (mais antigas primeiro)
   */
  async getCashbackSettings(): Promise<CashbackSetting[]> {
    const result = await db
      .select()
      .from(cashbackSettings)
      .orderBy(cashbackSettings.createdAt);

    return result;
  }

  /**
   * Busca uma configuração de cashback por ID
   *
   * @param id - UUID da configuração
   * @returns Configuração encontrada ou undefined
   *
   * @example
   * const setting = await repository.getCashbackSetting("setting-id");
   */
  async getCashbackSetting(id: string): Promise<CashbackSetting | undefined> {
    const [setting] = await db
      .select()
      .from(cashbackSettings)
      .where(eq(cashbackSettings.id, id));

    return setting || undefined;
  }

  /**
   * Cria uma nova configuração de cashback
   *
   * @param data - Dados da configuração a ser criada
   * @returns Configuração criada
   *
   * @example
   * const setting = await repository.createCashbackSetting({
   *   name: "Cashback Padrão",
   *   percentage: "10",
   *   expirationDays: 90
   * });
   */
  async createCashbackSetting(
    data: InsertCashbackSetting
  ): Promise<CashbackSetting> {
    const [setting] = await db
      .insert(cashbackSettings)
      .values(data)
      .returning();

    return setting;
  }

  /**
   * Atualiza uma configuração de cashback existente
   *
   * @param id - UUID da configuração
   * @param data - Dados parciais para atualização
   * @returns Configuração atualizada ou undefined se não encontrada
   *
   * @example
   * const updated = await repository.updateCashbackSetting("id", {
   *   percentage: "15"
   * });
   */
  async updateCashbackSetting(
    id: string,
    data: Partial<InsertCashbackSetting>
  ): Promise<CashbackSetting | undefined> {
    const [setting] = await db
      .update(cashbackSettings)
      .set(data)
      .where(eq(cashbackSettings.id, id))
      .returning();

    return setting || undefined;
  }

  /**
   * Exclui uma configuração de cashback
   *
   * @param id - UUID da configuração
   * @returns true se excluída com sucesso, false se não encontrada
   *
   * @example
   * const deleted = await repository.deleteCashbackSetting("id");
   */
  async deleteCashbackSetting(id: string): Promise<boolean> {
    const result = await db
      .delete(cashbackSettings)
      .where(eq(cashbackSettings.id, id))
      .returning();

    return result.length > 0;
  }
}

export const cashbackSettingsRepository = new CashbackSettingsRepository();
