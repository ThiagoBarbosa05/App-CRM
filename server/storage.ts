import { type Client, type InsertClient, type Deal, type InsertDeal, type DealWithClient, clients, deals } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Clients
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  getClientByCpf(cpf: string): Promise<Client | undefined>;
  getClientByPhone(phone: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;
  
  // Deals
  getDeals(): Promise<Deal[]>;
  getDealsWithClients(): Promise<DealWithClient[]>;
  getDeal(id: string): Promise<Deal | undefined>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDeal(id: string, deal: Partial<InsertDeal>): Promise<Deal | undefined>;
  deleteDeal(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  // Client methods
  async getClients(): Promise<Client[]> {
    const result = await db.select().from(clients).orderBy(clients.createdAt);
    return result.reverse(); // Most recent first
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async getClientByCpf(cpf: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.cpf, cpf));
    return client || undefined;
  }

  async getClientByPhone(phone: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.phone, phone));
    return client || undefined;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await db
      .insert(clients)
      .values({
        ...insertClient,
        markers: insertClient.markers || [],
      })
      .returning();
    return client;
  }

  async updateClient(id: string, updateData: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, id))
      .returning();
    return client || undefined;
  }

  async deleteClient(id: string): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Deal methods
  async getDeals(): Promise<Deal[]> {
    const result = await db.select().from(deals).orderBy(deals.createdAt);
    return result.reverse(); // Most recent first
  }

  async getDealsWithClients(): Promise<DealWithClient[]> {
    const allDeals = await db.select().from(deals).orderBy(deals.createdAt);
    const dealsWithClients: DealWithClient[] = [];

    for (const deal of allDeals.reverse()) {
      const [client] = await db.select().from(clients).where(eq(clients.id, deal.clientId));
      if (client) {
        dealsWithClients.push({
          ...deal,
          client,
        });
      }
    }

    return dealsWithClients;
  }

  async getDeal(id: string): Promise<Deal | undefined> {
    const [deal] = await db.select().from(deals).where(eq(deals.id, id));
    return deal || undefined;
  }

  async createDeal(insertDeal: InsertDeal): Promise<Deal> {
    const [deal] = await db
      .insert(deals)
      .values({
        ...insertDeal,
        stage: insertDeal.stage || "prospeccao",
      })
      .returning();
    return deal;
  }

  async updateDeal(id: string, updateData: Partial<InsertDeal>): Promise<Deal | undefined> {
    const [deal] = await db
      .update(deals)
      .set(updateData)
      .where(eq(deals.id, id))
      .returning();
    return deal || undefined;
  }

  async deleteDeal(id: string): Promise<boolean> {
    const result = await db.delete(deals).where(eq(deals.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }
}

export const storage = new DatabaseStorage();
