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
  sales,
  clientDebts,
  messageJobsLogs,
  calls,
  callNotifications,
  blingOrders,
  eventParticipants,
} from "@shared/schema";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "server/db";
import { ClientFilters } from "server/storage";
import { ensureClientInDesvendandoVinhoFunnel } from "../services/desvendando-vinho-funnel.service";

// Tipo para tags otimizado
export interface ClientTag {
  id: string;
  externalId: string | null;
  name: string | null;
}

export class ClientsRepository {
  private db = db;

  private buildClientFilterConditions(
    userId?: string,
    userRole?: string,
    filters: ClientFilters = {},
    overrideResponsavelId?: string,
  ) {
    const conditions = [];

    if (userRole === "vendedor" && userId) {
      conditions.push(eq(clients.responsavelId, userId));
    } else if (overrideResponsavelId) {
      conditions.push(eq(clients.responsavelId, overrideResponsavelId));
    }

    if (filters.name) {
      conditions.push(ilike(clients.name, `%${filters.name}%`));
    }

    if (filters.phone) {
      const normalizedPhone = filters.phone.replace(/\D/g, "");
      conditions.push(
        sql`regexp_replace(${clients.phone}, '\\D', '', 'g') LIKE ${
          "%" + normalizedPhone + "%"
        }`,
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

    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      const normalizedSearchPhone = filters.search.replace(/\D/g, "");
      conditions.push(
        or(
          ilike(clients.name, searchTerm),
          ilike(clients.email, searchTerm),
          ilike(clients.phone, searchTerm),
          ilike(clients.cpf, searchTerm),
          ...(normalizedSearchPhone.length >= 5
            ? [
                sql`regexp_replace(COALESCE(${clients.phone}, ''), '\\D', '', 'g') LIKE ${
                  "%" + normalizedSearchPhone + "%"
                }`,
              ]
            : []),
        ),
      );
    }

    if (filters.purchaseStatus && filters.purchaseStatus !== "all") {
      const days = filters.purchaseStatusDays ?? 60;
      if (filters.purchaseStatus === "ativo") {
        conditions.push(sql`EXISTS (
          SELECT 1 FROM (
            SELECT app_client_id FROM bling_orders
            WHERE app_client_id = ${clients.id} AND deleted_at IS NULL
              AND TO_DATE(sale_date, 'YYYY-MM-DD') >= CURRENT_DATE - (${String(days)} || ' days')::interval
            UNION ALL
            SELECT app_client_id FROM connect_orders
            WHERE app_client_id = ${clients.id}
              AND sale_date::date >= CURRENT_DATE - (${String(days)} || ' days')::interval
          ) AS p
        )`);
      } else if (filters.purchaseStatus === "inativo") {
        conditions.push(sql`NOT EXISTS (
          SELECT 1 FROM (
            SELECT app_client_id FROM bling_orders
            WHERE app_client_id = ${clients.id} AND deleted_at IS NULL
              AND TO_DATE(sale_date, 'YYYY-MM-DD') >= CURRENT_DATE - (${String(days)} || ' days')::interval
            UNION ALL
            SELECT app_client_id FROM connect_orders
            WHERE app_client_id = ${clients.id}
              AND sale_date::date >= CURRENT_DATE - (${String(days)} || ' days')::interval
          ) AS p
        )`);
      }
    }

    if (filters.wineGrape) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(${clients.wineProfile}->'uvas_favoritas') AS uva
          WHERE uva ILIKE ${"%" + filters.wineGrape + "%"}
        )`,
      );
    }

    if (filters.wineRegion) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(${clients.wineProfile}->'regioes_favoritas') AS regiao
          WHERE regiao ILIKE ${"%" + filters.wineRegion + "%"}
        )`,
      );
    }

    if (filters.wineType && filters.wineType !== "all") {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(${clients.wineProfile}->'tipos_preferidos') AS tipo
          WHERE tipo ILIKE ${"%" + filters.wineType + "%"}
        )`,
      );
    }

    if (filters.rfmSegment && filters.rfmSegment !== "all") {
      conditions.push(eq(clients.rfmSegment, filters.rfmSegment));
    }

    if (filters.hasWineProfile) {
      conditions.push(sql`${clients.wineProfile} IS NOT NULL`);
    }

    if (filters.eventId && filters.eventId !== "all") {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${eventParticipants}
          WHERE ${eventParticipants.clientId} = ${clients.id}
            AND ${eventParticipants.eventId} = ${filters.eventId}
        )`,
      );
    }

    return conditions;
  }

  /**
   * Método otimizado que busca tags para múltiplos clientes em uma única query
   * Usa INNER JOIN para pegar todas as tags de uma vez, evitando problema N+1
   * Performance: O(n) vs O(n*m) do método anterior com Promise.all
   */
  private async getClientsLastPurchaseDates(
    clientIds: string[]
  ): Promise<Map<string, string | null>> {
    if (clientIds.length === 0) return new Map();
    // IDs are NanoIDs/UUIDs — safe to inline (no SQL injection risk)
    const safeList = clientIds.map((id) => `'${id.replace(/'/g, "")}'`).join(",");
    const result = await this.db.execute(
      sql.raw(`
        SELECT client_id, MAX(sale_date)::text AS last_purchase_date
        FROM (
          SELECT app_client_id AS client_id, sale_date::text AS sale_date
          FROM bling_orders
          WHERE deleted_at IS NULL AND app_client_id IN (${safeList})
          UNION ALL
          SELECT app_client_id AS client_id, to_char(sale_date, 'YYYY-MM-DD') AS sale_date
          FROM connect_orders
          WHERE app_client_id IN (${safeList})
        ) AS purchases
        GROUP BY client_id
      `)
    );
    const map = new Map<string, string | null>();
    for (const clientId of clientIds) map.set(clientId, null);
    for (const row of result.rows as { client_id: string; last_purchase_date: string }[]) {
      map.set(row.client_id, row.last_purchase_date);
    }
    return map;
  }

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
    const conditions = this.buildClientFilterConditions(userId, userRole, filters);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const offset = (page - 1) * pageSize;

    const result = await query
      .orderBy(desc(clients.createdAt))
      .limit(pageSize)
      .offset(offset);

    // Buscar tags de forma otimizada (1 query para todos os clientes)
    const clientsWithTags = await this.getClientsWithTags(result);

    // Enriquecer com lastPurchaseDate
    const lastPurchaseDates = await this.getClientsLastPurchaseDates(result.map((c) => c.id));
    return clientsWithTags.map((client) => ({
      ...client,
      lastPurchaseDate: lastPurchaseDates.get(client.id) ?? null,
    }));
  }

  async getClientsCount(
    userId?: string,
    userRole?: string,
    filters: ClientFilters = {}
  ): Promise<number> {
    const conditions = this.buildClientFilterConditions(userId, userRole, filters);

    let countQuery = this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients);

    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
    }

    const result = await countQuery;
    return result[0]?.count || 0;
  }

  async getFilteredClientIds(
    userId?: string,
    userRole?: string,
    filters: ClientFilters = {},
    overrideResponsavelId?: string,
  ): Promise<string[]> {
    let query = this.db.select({ id: clients.id }).from(clients);
    const conditions = this.buildClientFilterConditions(
      userId,
      userRole,
      filters,
      overrideResponsavelId,
    );

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const result = await query;
    return result.map((client) => client.id);
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
    if (!client) return undefined;
    const lastPurchaseDates = await this.getClientsLastPurchaseDates([client.id]);
    return { ...client, lastPurchaseDate: lastPurchaseDates.get(client.id) ?? null } as any;
  }

  async getClientsWithoutRecentContact(
    userId?: string,
    userRole?: string,
    daysThreshold: number = 1
  ) {
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - daysThreshold);

    // Buscar clientes
    const baseClientsQuery = this.db
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

    const clientsQuery =
      userRole !== "admin" && userRole !== "administrador" && userId
        ? baseClientsQuery.where(eq(clients.responsavelId, userId))
        : baseClientsQuery;

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
      await this.db.delete(cashbackUsage).where(eq(cashbackUsage.clientId, id));
      await this.db.delete(clientCashbackBalance).where(eq(clientCashbackBalance.clientId, id));
      await this.db.delete(cashbackTransactions).where(eq(cashbackTransactions.clientId, id));
      await this.db.delete(deals).where(eq(deals.clientId, id));
      await this.db.delete(clientInteractions).where(eq(clientInteractions.clientId, id));
      await this.db.delete(sales).where(eq(sales.clientId, id));
      await this.db.delete(clientDebts).where(eq(clientDebts.clientId, id));
      await this.db.delete(messageJobsLogs).where(eq(messageJobsLogs.clientId, id));
      await this.db.delete(callNotifications).where(eq(callNotifications.clientId, id));
      await this.db.delete(calls).where(eq(calls.clientId, id));
      await this.db.update(blingOrders).set({ appClientId: null }).where(eq(blingOrders.appClientId, id));

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
      await this.db.delete(cashbackUsage).where(inArray(cashbackUsage.clientId, ids));
      await this.db.delete(clientCashbackBalance).where(inArray(clientCashbackBalance.clientId, ids));
      await this.db.delete(cashbackTransactions).where(inArray(cashbackTransactions.clientId, ids));
      await this.db.delete(deals).where(inArray(deals.clientId, ids));
      await this.db.delete(clientInteractions).where(inArray(clientInteractions.clientId, ids));
      await this.db.delete(sales).where(inArray(sales.clientId, ids));
      await this.db.delete(clientDebts).where(inArray(clientDebts.clientId, ids));
      await this.db.delete(messageJobsLogs).where(inArray(messageJobsLogs.clientId, ids));
      await this.db.delete(callNotifications).where(inArray(callNotifications.clientId, ids));
      await this.db.delete(calls).where(inArray(calls.clientId, ids));
      await this.db.update(blingOrders).set({ appClientId: null }).where(inArray(blingOrders.appClientId, ids));

      const result = await this.db.delete(clients).where(inArray(clients.id, ids));

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

      void ensureClientInDesvendandoVinhoFunnel(clientId).catch((err) =>
        console.error("[DesvendandoVinhoFunnel] Erro ao incluir cliente por tag externa:", err),
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
