import {
  Client,
  clientInteractions,
  clients,
  users,
  InsertClient,
  cashbackUsage,
  clientCashbackBalance,
  cashbackTransactions,
  deals,
  userServiceChannel,
  serviceChannels,
  clientTags,
  externalTags,
} from "@shared/schema";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "server/db";
import { ClientFilters } from "server/storage";

// Tipo para tags otimizado
export interface ClientTag {
  id: string;
  externalId: string | null;
  name: string | null;
}

export class ClientsRepository {
  private db = db;

  /**
   * Método otimizado que busca tags para múltiplos clientes em uma única query
   * Usa INNER JOIN para pegar todas as tags de uma vez, evitando problema N+1
   * Performance: O(n) vs O(n*m) do método anterior com Promise.all
   */
  private async getClientsWithTags(clientsList: Client[]): Promise<any[]> {
    if (clientsList.length === 0) {
      return [];
    }

    const clientIds = clientsList.map((c) => c.id);

    // Buscar todas as tags dos clientes em uma única query
    const tagsData = await this.db
      .select({
        clientId: clientTags.clientId,
        tagId: externalTags.id,
        externalId: externalTags.externalId,
        name: externalTags.externalTagName,
      })
      .from(clientTags)
      .innerJoin(externalTags, eq(clientTags.externalTagId, externalTags.id))
      .where(inArray(clientTags.clientId, clientIds));

    // Agrupar tags por cliente usando Map para lookup O(1)
    const tagsByClient = new Map<string, ClientTag[]>();

    for (const tagData of tagsData) {
      const clientId = tagData.clientId!;
      if (!tagsByClient.has(clientId)) {
        tagsByClient.set(clientId, []);
      }
      tagsByClient.get(clientId)!.push({
        id: tagData.tagId,
        externalId: tagData.externalId,
        name: tagData.name,
      });
    }

    // Combinar clientes com suas tags
    return clientsList.map((client) => ({
      ...client,
      tags: tagsByClient.get(client.id) || [],
    }));
  }

  async getClients(
    userId?: string,
    userRole?: string,
    filters: ClientFilters = {},
    page: number = 1,
    pageSize: number = 100
  ): Promise<any[]> {
    let query = this.db.select().from(clients);
    const conditions: any[] = [];

    // Se for vendedor, só mostra clientes onde ele é responsável
    if (userRole === "vendedor" && userId) {
      conditions.push(eq(clients.responsavelId, userId));
    }

    // Filtros específicos
    if (filters.name) {
      conditions.push(ilike(clients.name, `%${filters.name}%`));
    }
    if (filters.phone) {
      const normalizedPhone = filters.phone.replace(/\D/g, ""); // só dígitos
      conditions.push(
        sql`regexp_replace(${clients.phone}, '\\D', '', 'g') LIKE ${
          "%" + normalizedPhone + "%"
        }`
      );
    }
    if (filters.cpf) {
      conditions.push(ilike(clients.cpf, `%${filters.cpf}%`));
    }
    if (filters.responsavelId) {
      conditions.push(eq(clients.responsavelId, filters.responsavelId));
    }
    if (filters.categoria) {
      conditions.push(eq(clients.categoria, filters.categoria));
    }
    if (filters.origem) {
      conditions.push(eq(clients.origem, filters.origem));
    }
    if (filters.markers) {
      conditions.push(sql`${filters.markers} = ANY(${clients.markers})`);
    }

    // Filtro de busca geral (case-insensitive)
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(clients.name, searchTerm),
          ilike(clients.email, searchTerm),
          ilike(clients.phone, searchTerm),
          ilike(clients.cpf, searchTerm)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const offset = (page - 1) * pageSize;

    const result = await query
      .orderBy(desc(clients.createdAt))
      .limit(pageSize)
      .offset(offset);

    // Buscar tags de forma otimizada (1 query para todos os clientes)
    return await this.getClientsWithTags(result);
  }

  async getClientsCount(
    userId?: string,
    userRole?: string,
    filters: ClientFilters = {}
  ): Promise<number> {
    const conditions: any[] = [];

    // Se for vendedor, só mostra clientes onde ele é responsável
    if (userRole === "vendedor" && userId) {
      conditions.push(eq(clients.responsavelId, userId));
    }

    // Filtros específicos
    if (filters.name) {
      conditions.push(ilike(clients.name, `%${filters.name}%`));
    }
    if (filters.phone) {
      const normalizedPhone = filters.phone.replace(/\D/g, ""); // só dígitos
      conditions.push(
        sql`regexp_replace(${clients.phone}, '\\D', '', 'g') LIKE ${
          "%" + normalizedPhone + "%"
        }`
      );
    }
    if (filters.cpf) {
      conditions.push(ilike(clients.cpf, `%${filters.cpf}%`));
    }
    if (filters.responsavelId) {
      conditions.push(eq(clients.responsavelId, filters.responsavelId));
    }
    if (filters.categoria) {
      conditions.push(eq(clients.categoria, filters.categoria));
    }
    if (filters.origem) {
      conditions.push(eq(clients.origem, filters.origem));
    }
    if (filters.markers) {
      conditions.push(sql`${filters.markers} = ANY(${clients.markers})`);
    }

    // Filtro de busca geral (case-insensitive)
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(clients.name, searchTerm),
          ilike(clients.email, searchTerm),
          ilike(clients.phone, searchTerm),
          ilike(clients.cpf, searchTerm)
        )
      );
    }

    let countQuery = this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients);

    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
    }

    const result = await countQuery;
    return result[0]?.count || 0;
  }

  async getClientByPhone(phone: string): Promise<Client | undefined> {
    const [client] = await this.db
      .select()
      .from(clients)
      .where(eq(clients.phone, phone));
    return client || undefined;
  }

  async getClientById(id: string): Promise<Client | undefined> {
    const [client] = await this.db
      .select()
      .from(clients)
      .where(eq(clients.id, id));
    return client || undefined;
  }

  async getClientsWithoutRecentContact(
    userId?: string,
    userRole?: string,
    daysThreshold: number = 1
  ) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    // Buscar clientes
    let clientsQuery = this.db
      .select({
        id: clients.id,
        name: clients.name,
        phone: clients.phone,
        email: clients.email,
        cpf: clients.cpf,
        birthday: clients.birthday,
        categoria: clients.categoria,
        origem: clients.origem,
        markers: clients.markers,
        responsavelId: clients.responsavelId,
        createdAt: clients.createdAt,
        responsavelName: users.name,
      })
      .from(clients)
      .leftJoin(users, eq(clients.responsavelId, users.id));

    // Aplicar filtros de permissão
    if (userRole !== "admin" && userRole !== "administrador" && userId) {
      clientsQuery = clientsQuery.where(eq(clients.responsavelId, userId));
    }

    const allClients = await clientsQuery;

    // Buscar última interação de cada cliente
    const clientsWithLastInteraction = await Promise.all(
      allClients.map(async (client) => {
        const lastInteraction = await this.db
          .select({
            date: clientInteractions.date,
          })
          .from(clientInteractions)
          .where(eq(clientInteractions.clientId, client.id))
          .orderBy(desc(clientInteractions.date))
          .limit(1);

        const lastInteractionDate = lastInteraction[0]?.date;
        const createdDate = new Date(client.createdAt);
        const today = new Date();

        const daysSinceCreated = Math.floor(
          (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Determinar se o cliente precisa ser contactado
        let needsContact = false;

        if (!lastInteractionDate) {
          // Se nunca foi contactado e foi criado há mais de X dias
          needsContact = daysSinceCreated >= daysThreshold;
        } else {
          // Se a última interação foi há mais de X dias
          const daysSinceLastContact = Math.floor(
            (today.getTime() - new Date(lastInteractionDate).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          needsContact = daysSinceLastContact >= daysThreshold;
        }

        return {
          ...client,
          daysSinceCreated,
          lastInteractionDate,
          needsContact,
          daysSinceLastContact: lastInteractionDate
            ? Math.floor(
                (today.getTime() - new Date(lastInteractionDate).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : null,
        };
      })
    );

    // Filtrar apenas clientes que precisam ser contactados
    return clientsWithLastInteraction
      .filter((client) => client.needsContact)
      .sort((a, b) => b.daysSinceCreated - a.daysSinceCreated);
  }

  async getAllClientsForExport(): Promise<Client[]> {
    try {
      const result = await this.db
        .select()
        .from(clients)
        .orderBy(desc(clients.createdAt));
      return result;
    } catch (error) {
      console.error("Erro ao buscar todos os clientes para exportação:", error);
      throw error;
    }
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    try {
      const [client] = await this.db
        .insert(clients)
        .values({
          ...insertClient,
          markers: insertClient.markers || [],
        })
        .returning();
      return client;
    } catch (error) {
      console.error("Erro ao criar cliente:", error);
      throw error;
    }
  }

  async updateClient(
    id: string,
    updateData: Partial<InsertClient>
  ): Promise<Client | undefined> {
    try {
      const [client] = await this.db
        .update(clients)
        .set(updateData)
        .where(eq(clients.id, id))
        .returning();
      return client || undefined;
    } catch (error) {
      console.error("Erro ao atualizar cliente:", error);
      throw error;
    }
  }

  async deleteClient(id: string): Promise<boolean> {
    try {
      // Primeiro, excluir usos de cashback do cliente
      await this.db.delete(cashbackUsage).where(eq(cashbackUsage.clientId, id));

      // Depois, excluir saldo de cashback do cliente
      await this.db
        .delete(clientCashbackBalance)
        .where(eq(clientCashbackBalance.clientId, id));

      // Depois, excluir as transações de cashback do cliente
      await this.db
        .delete(cashbackTransactions)
        .where(eq(cashbackTransactions.clientId, id));

      // Depois, excluir os deals associados ao cliente
      await this.db.delete(deals).where(eq(deals.clientId, id));

      // Depois excluir as interações do cliente
      await this.db
        .delete(clientInteractions)
        .where(eq(clientInteractions.clientId, id));

      // Por fim, excluir o cliente
      const result = await this.db.delete(clients).where(eq(clients.id, id));
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Erro ao excluir cliente:", error);
      throw error;
    }
  }

  /**
   * Exclui múltiplos clientes e dados relacionados
   * @param ids - Array de IDs dos clientes a serem excluídos
   * @returns Promise<{deletedCount: number}> - Número de clientes excluídos
   */
  async deleteClients(ids: string[]): Promise<{ deletedCount: number }> {
    try {
      // Primeiro, excluir usos de cashback dos clientes
      await this.db
        .delete(cashbackUsage)
        .where(inArray(cashbackUsage.clientId, ids));

      // Depois, excluir saldos de cashback dos clientes
      await this.db
        .delete(clientCashbackBalance)
        .where(inArray(clientCashbackBalance.clientId, ids));

      // Depois, excluir as transações de cashback dos clientes
      await this.db
        .delete(cashbackTransactions)
        .where(inArray(cashbackTransactions.clientId, ids));

      // Depois, excluir os deals associados aos clientes
      await this.db.delete(deals).where(inArray(deals.clientId, ids));

      // Depois excluir as interações dos clientes
      await this.db
        .delete(clientInteractions)
        .where(inArray(clientInteractions.clientId, ids));

      // Por fim, excluir os clientes
      const result = await this.db
        .delete(clients)
        .where(inArray(clients.id, ids));

      return { deletedCount: result.rowCount || 0 };
    } catch (error) {
      console.error("Erro ao excluir clientes em lote:", error);
      throw error;
    }
  }

  /**
   * Busca o ID do canal de serviço associado ao usuário
   */
  async getUserServiceChannelId(userId: string): Promise<string | null> {
    try {
      const [result] = await this.db
        .select({
          channelId: serviceChannels.id,
        })
        .from(users)
        .leftJoin(userServiceChannel, eq(users.id, userServiceChannel.userId))
        .leftJoin(
          serviceChannels,
          eq(userServiceChannel.serviceChannelId, serviceChannels.id)
        )
        .where(eq(users.id, userId))
        .limit(1);

      return result?.channelId || null;
    } catch (error) {
      console.error("Erro ao buscar canal de serviço do usuário:", error);
      return null;
    }
  }

  /**
   * Associa tags externas ao cliente
   * @param clientId - ID do cliente
   * @param tagsData - Array de tags com id e name do Umbler
   */
  async syncClientTags(
    clientId: string,
    tagsData: Array<{ id: string; name: string }>
  ): Promise<void> {
    try {
      console.log(
        `[syncClientTags] Iniciando sincronização para cliente ${clientId}`
      );
      console.log(`[syncClientTags] Tags a serem sincronizadas:`, tagsData);

      // Primeiro, remove todas as tags antigas do cliente
      await this.db.delete(clientTags).where(eq(clientTags.clientId, clientId));
      console.log(`[syncClientTags] Tags antigas removidas`);

      // Se não há tags para adicionar, retorna
      if (!tagsData || tagsData.length === 0) {
        console.log(`[syncClientTags] Nenhuma tag para adicionar`);
        return;
      }

      // Para cada tag, verificar se já existe na tabela externalTags
      // Se não existir, criar um registro
      for (const tagData of tagsData) {
        console.log(
          `[syncClientTags] Processando tag externa: ${tagData.id} - ${tagData.name}`
        );

        // Buscar se já existe
        const [existingTag] = await this.db
          .select()
          .from(externalTags)
          .where(eq(externalTags.externalId, tagData.id))
          .limit(1);

        let tagId: string;

        if (existingTag) {
          tagId = existingTag.id;
          console.log(
            `[syncClientTags] Tag externa encontrada com ID: ${tagId}`
          );

          // Atualiza o nome da tag caso tenha mudado
          if (existingTag.externalTagName !== tagData.name) {
            await this.db
              .update(externalTags)
              .set({ externalTagName: tagData.name })
              .where(eq(externalTags.id, tagId));
            console.log(
              `[syncClientTags] Nome da tag atualizado: ${tagData.name}`
            );
          }
        } else {
          // Criar novo registro na tabela externalTags com o nome
          const [newTag] = await this.db
            .insert(externalTags)
            .values({
              externalId: tagData.id,
              externalTagName: tagData.name,
            })
            .returning();

          tagId = newTag.id;
          console.log(
            `[syncClientTags] Nova tag externa criada com ID: ${tagId} - Nome: ${tagData.name}`
          );
        }

        // Criar associação na tabela clientTags
        await this.db.insert(clientTags).values({
          clientId: clientId,
          externalTagId: tagId,
        });
        console.log(
          `[syncClientTags] Associação criada: cliente ${clientId} <-> tag ${tagId}`
        );
      }

      console.log(
        `[syncClientTags] ✅ Tags sincronizadas com sucesso para o cliente ${clientId}: ${tagsData
          .map((t) => t.name)
          .join(", ")}`
      );
    } catch (error) {
      console.error(
        "[syncClientTags] ❌ Erro ao sincronizar tags do cliente:",
        error
      );
      throw error;
    }
  }

  /**
   * Busca as tags externas associadas a um cliente
   * @param clientId - ID do cliente
   * @returns Array de tags com id, externalId e name
   */
  async getClientTags(clientId: string): Promise<ClientTag[]> {
    try {
      const tags = await this.db
        .select({
          id: externalTags.id,
          externalId: externalTags.externalId,
          name: externalTags.externalTagName,
        })
        .from(clientTags)
        .innerJoin(externalTags, eq(clientTags.externalTagId, externalTags.id))
        .where(eq(clientTags.clientId, clientId));

      return tags;
    } catch (error) {
      console.error("Erro ao buscar tags do cliente:", error);
      return [];
    }
  }
}
