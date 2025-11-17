import { db } from "../db";
import {
  clientInteractions,
  type InsertClientInteraction,
  type ClientInteraction,
} from "../../shared/schema";

/**
 * Repository responsável por operações de banco de dados relacionadas a interações com clientes
 */
class InteractionsRepository {
  /**
   * Cria uma nova interação com cliente ou empresa
   *
   * @param data - Dados da interação a ser criada
   * @returns Interação criada com todos os campos
   *
   * @example
   * const interaction = await repository.createInteraction({
   *   userId: "user-id",
   *   clientId: "client-id",
   *   companyId: null,
   *   type: "call",
   *   description: "Ligação de follow-up",
   *   date: new Date(),
   *   latitude: "-23.5505",
   *   longitude: "-46.6333"
   * });
   *
   * @notes
   * - Pelo menos um de clientId ou companyId deve ser fornecido
   * - userId é obrigatório (obtido do header de autenticação)
   * - date é convertido para Date se fornecido como string
   * - latitude e longitude são opcionais e armazenados como string
   */
  async createInteraction(
    data: InsertClientInteraction
  ): Promise<ClientInteraction> {
    const [newInteraction] = await db
      .insert(clientInteractions)
      .values(data)
      .returning();

    return newInteraction;
  }
}

export const interactionsRepository = new InteractionsRepository();
