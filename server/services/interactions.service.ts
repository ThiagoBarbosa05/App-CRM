import { interactionsRepository } from "../repositories/interactions.repository";
import { insertClientInteractionSchema } from "../../shared/schema";
import type {
  InsertClientInteraction,
  ClientInteraction,
} from "../../shared/schema";

/**
 * Service responsável pela lógica de negócio relacionada a interações com clientes
 */
class InteractionsService {
  /**
   * Cria uma nova interação com cliente ou empresa
   *
   * @param data - Dados da interação (sem validação prévia)
   * @param userId - ID do usuário autenticado (obrigatório)
   * @returns Interação criada
   * @throws {ZodError} Se validação falhar
   *
   * @example
   * const interaction = await service.createInteraction({
   *   clientId: "client-id",
   *   type: "call",
   *   description: "Ligação de follow-up",
   *   date: "2023-01-15T10:30:00.000Z"
   * }, "user-id");
   *
   * @notes
   * - Valida dados com insertClientInteractionSchema (Zod)
   * - Adiciona userId automaticamente aos dados
   * - Converte date de string para Date se necessário
   * - Validação garante que clientId OU companyId estejam presentes
   * - Latitude e longitude são opcionais
   */
  async createInteraction(
    data: Omit<InsertClientInteraction, "userId">,
    userId: string
  ): Promise<ClientInteraction> {
    // Adiciona userId aos dados
    const dataWithUser = { ...data, userId };

    // Converte date para Date se fornecido como string
    if (dataWithUser.date && typeof dataWithUser.date === "string") {
      dataWithUser.date = new Date(dataWithUser.date);
    }

    // Valida dados com schema Zod
    const validatedData = insertClientInteractionSchema.parse(dataWithUser);

    // Cria interação no banco
    return await interactionsRepository.createInteraction(validatedData);
  }
}

export const interactionsService = new InteractionsService();
