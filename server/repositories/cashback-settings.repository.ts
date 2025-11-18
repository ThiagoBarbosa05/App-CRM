import { db } from "../db";
import {
  cashbackSettings,
  cashbackTransactions,
  clientCashbackBalance,
  cashbackUsage,
  type CashbackSetting,
  type InsertCashbackSetting,
  type CashbackTransaction,
  type InsertCashbackTransaction,
} from "../../shared/schema";
import { eq, and, gt, isNull, or } from "drizzle-orm";

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

  /**
   * Cria uma nova transação de cashback
   *
   * @param data - Dados da transação a ser criada
   * @returns Transação criada
   *
   * @example
   * const transaction = await repository.createCashbackTransaction({
   *   clientId: "client-id",
   *   purchaseAmount: "1000",
   *   cashbackAmount: "100",
   *   cashbackRate: "10",
   *   status: "approved"
   * });
   *
   * @notes
   * - Se expiresAt não for fornecido, calcula baseado na configuração da regra (ou 28 dias padrão)
   * - Busca configuração de cashback se settingId estiver presente
   * - Retorna a transação criada com todos os campos
   */
  async createCashbackTransaction(
    data: InsertCashbackTransaction
  ): Promise<CashbackTransaction> {
    // Se não foi fornecida data de validade, calcular baseado na configuração da regra
    if (!data.expiresAt) {
      let expirationDays = 28; // Padrão de 28 dias

      // Se há uma regra de cashback definida, usar os dias de validade dela
      if (data.settingId) {
        const [setting] = await db
          .select()
          .from(cashbackSettings)
          .where(eq(cashbackSettings.id, data.settingId));

        if (setting && setting.expirationDays) {
          expirationDays = setting.expirationDays;
        }
      }

      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expirationDays);
      data.expiresAt = expirationDate;
    }

    const [transaction] = await db
      .insert(cashbackTransactions)
      .values(data)
      .returning();

    return transaction;
  }

  /**
   * Atualiza o saldo de cashback de um cliente
   *
   * @param clientId - UUID do cliente
   * @returns void
   *
   * @example
   * await repository.updateClientCashbackBalance("client-id");
   *
   * @notes
   * - Calcula total ganho (todos os cashbacks aprovados)
   * - Calcula total ganho válido (apenas cashbacks não expirados)
   * - Calcula total usado (soma de todas as utilizações)
   * - Saldo atual = cashback válido - total usado
   * - Cria registro se não existir, atualiza se já existir
   * - Usa transações com status "approved"
   * - Considera apenas cashbacks com expiresAt > agora para saldo válido
   */
  async updateClientCashbackBalance(clientId: string): Promise<void> {
    const now = new Date();

    // Calcular total ganho (todos os cashbacks aprovados, independente de validade)
    const allEarnedTransactions = await db
      .select()
      .from(cashbackTransactions)
      .where(
        and(
          eq(cashbackTransactions.clientId, clientId),
          eq(cashbackTransactions.status, "approved")
        )
      );

    const totalEarned = allEarnedTransactions.reduce(
      (sum, transaction) => sum + Number(transaction.cashbackAmount),
      0
    );

    // Calcular total ganho válido (apenas cashbacks não expirados)
    const validEarnedTransactions = await db
      .select()
      .from(cashbackTransactions)
      .where(
        and(
          eq(cashbackTransactions.clientId, clientId),
          eq(cashbackTransactions.status, "approved"),
          gt(cashbackTransactions.expiresAt, now) // Apenas não expirados
        )
      );

    const totalValidEarned = validEarnedTransactions.reduce(
      (sum, transaction) => sum + Number(transaction.cashbackAmount),
      0
    );

    // Calcular total usado
    const usageTransactions = await db
      .select()
      .from(cashbackUsage)
      .where(eq(cashbackUsage.clientId, clientId));

    const totalUsed = usageTransactions.reduce(
      (sum, usage) => sum + Number(usage.usedAmount),
      0
    );

    // Saldo atual = cashback válido - total usado
    const currentBalance = totalValidEarned - totalUsed;

    // Verificar se já existe um registro de saldo
    const [existingBalance] = await db
      .select()
      .from(clientCashbackBalance)
      .where(eq(clientCashbackBalance.clientId, clientId));

    if (existingBalance) {
      await db
        .update(clientCashbackBalance)
        .set({
          totalEarned: totalEarned.toString(),
          totalUsed: totalUsed.toString(),
          currentBalance: currentBalance.toString(),
          lastUpdated: new Date(),
        })
        .where(eq(clientCashbackBalance.clientId, clientId));
    } else {
      await db.insert(clientCashbackBalance).values({
        clientId,
        totalEarned: totalEarned.toString(),
        totalUsed: totalUsed.toString(),
        currentBalance: currentBalance.toString(),
      });
    }
  }
}

export const cashbackSettingsRepository = new CashbackSettingsRepository();
