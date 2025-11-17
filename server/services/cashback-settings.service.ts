import { cashbackSettingsRepository } from "../repositories/cashback-settings.repository";
import type {
  CashbackSetting,
  InsertCashbackSetting,
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
}

export const cashbackSettingsService = new CashbackSettingsService();
