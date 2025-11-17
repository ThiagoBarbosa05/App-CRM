import { db } from "../db";
import { clients, users } from "../../shared/schema";
import { eq, isNotNull, and } from "drizzle-orm";

/**
 * Interface para o resultado de cliente com aniversário próximo
 */
export interface UpcomingBirthdayClient {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  responsavelId: string | null;
  responsavelName: string | null;
  nextBirthday: Date;
}

/**
 * Repository responsável por operações de banco de dados relacionadas a aniversários
 */
class BirthdaysRepository {
  /**
   * Busca clientes com data de aniversário cadastrada
   *
   * @param responsibleId - ID do responsável para filtrar (opcional)
   * @returns Lista de clientes com informações de aniversário
   *
   * @example
   * // Buscar todos os clientes com aniversário
   * const allClients = await repository.getClientsWithBirthday();
   *
   * // Buscar clientes de um responsável específico
   * const vendorClients = await repository.getClientsWithBirthday("user-id");
   *
   * @notes
   * - Retorna apenas clientes com campo birthday preenchido
   * - Inclui nome do responsável via LEFT JOIN
   * - Se responsibleId fornecido, filtra apenas clientes daquele responsável
   */
  async getClientsWithBirthday(responsibleId?: string) {
    let query = db
      .select({
        id: clients.id,
        name: clients.name,
        phone: clients.phone,
        email: clients.email,
        birthday: clients.birthday,
        responsavelId: clients.responsavelId,
        responsavelName: users.name,
      })
      .from(clients)
      .leftJoin(users, eq(clients.responsavelId, users.id))
      .where(isNotNull(clients.birthday));

    // Se responsibleId for fornecido, filtrar por ele
    if (responsibleId) {
      query = query.where(
        and(
          isNotNull(clients.birthday),
          eq(clients.responsavelId, responsibleId)
        )
      ) as typeof query;
    }

    return await query;
  }
}

export const birthdaysRepository = new BirthdaysRepository();
