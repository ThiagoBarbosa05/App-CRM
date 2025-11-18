import { cashbackSettingsRepository } from "../repositories/cashback-settings.repository";
import type {
  CashbackSetting,
  InsertCashbackSetting,
  CashbackTransaction,
  InsertCashbackTransaction,
} from "../../shared/schema";

/**
 * Service responsável pela lógica de negócio relacionada a configurações de cashback
 */
class CashbackSettingsService {
  /**
   * Busca todas as configurações de cashback
   *
   * @returns Lista de configurações ordenadas por data de criação
   *
   * @example
   * const settings = await service.getCashbackSettings();
   *
   * @notes
   * - Retorna todas as configurações (ativas e inativas)
   * - Útil para listar opções de cashback disponíveis
   */
  async getCashbackSettings(): Promise<CashbackSetting[]> {
    return await cashbackSettingsRepository.getCashbackSettings();
  }

  /**
   * Busca uma configuração de cashback por ID
   *
   * @param id - UUID da configuração
   * @returns Configuração encontrada ou undefined
   */
  async getCashbackSetting(id: string): Promise<CashbackSetting | undefined> {
    return await cashbackSettingsRepository.getCashbackSetting(id);
  }

  /**
   * Cria uma nova configuração de cashback
   *
   * @param data - Dados da configuração
   * @returns Configuração criada
   *
   * @example
   * const setting = await service.createCashbackSetting({
   *   name: "Cashback Premium",
   *   percentage: "15",
   *   expirationDays: 120
   * });
   */
  async createCashbackSetting(
    data: InsertCashbackSetting
  ): Promise<CashbackSetting> {
    return await cashbackSettingsRepository.createCashbackSetting(data);
  }

  /**
   * Atualiza uma configuração de cashback existente
   *
   * @param id - UUID da configuração
   * @param data - Dados parciais para atualização
   * @returns Configuração atualizada ou undefined se não encontrada
   */
  async updateCashbackSetting(
    id: string,
    data: Partial<InsertCashbackSetting>
  ): Promise<CashbackSetting | undefined> {
    return await cashbackSettingsRepository.updateCashbackSetting(id, data);
  }

  /**
   * Exclui uma configuração de cashback
   *
   * @param id - UUID da configuração
   * @returns true se excluída com sucesso, false se não encontrada
   */
  async deleteCashbackSetting(id: string): Promise<boolean> {
    return await cashbackSettingsRepository.deleteCashbackSetting(id);
  }

  /**
   * Cria uma nova transação de cashback
   *
   * @param data - Dados da transação a ser criada
   * @returns Transação criada
   *
   * @example
   * const transaction = await service.createCashbackTransaction({
   *   clientId: "client-id",
   *   purchaseAmount: "1000",
   *   cashbackAmount: "100",
   *   cashbackRate: "10",
   *   status: "approved"
   * });
   *
   * @notes
   * - Calcula automaticamente a data de expiração se não fornecida
   * - Atualiza o saldo do cliente após criar a transação
   * - Retorna a transação criada completa
   */
  async createCashbackTransaction(
    data: InsertCashbackTransaction
  ): Promise<CashbackTransaction> {
    // Criar a transação (repository já calcula expiresAt se necessário)
    const transaction =
      await cashbackSettingsRepository.createCashbackTransaction(data);

    // Atualizar saldo do cliente
    await cashbackSettingsRepository.updateClientCashbackBalance(data.clientId);

    return transaction;
  }
}

export const cashbackSettingsService = new CashbackSettingsService();
