import { type Client, type InsertClient, type Deal, type InsertDeal, type DealWithClient } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Clients
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  getClientByCpf(cpf: string): Promise<Client | undefined>;
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

export class MemStorage implements IStorage {
  private clients: Map<string, Client>;
  private deals: Map<string, Deal>;

  constructor() {
    this.clients = new Map();
    this.deals = new Map();
  }

  // Client methods
  async getClients(): Promise<Client[]> {
    return Array.from(this.clients.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getClient(id: string): Promise<Client | undefined> {
    return this.clients.get(id);
  }

  async getClientByCpf(cpf: string): Promise<Client | undefined> {
    return Array.from(this.clients.values()).find(client => client.cpf === cpf);
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const id = randomUUID();
    const client: Client = {
      ...insertClient,
      id,
      createdAt: new Date(),
    };
    this.clients.set(id, client);
    return client;
  }

  async updateClient(id: string, updateData: Partial<InsertClient>): Promise<Client | undefined> {
    const client = this.clients.get(id);
    if (!client) return undefined;

    const updatedClient = { ...client, ...updateData };
    this.clients.set(id, updatedClient);
    return updatedClient;
  }

  async deleteClient(id: string): Promise<boolean> {
    return this.clients.delete(id);
  }

  // Deal methods
  async getDeals(): Promise<Deal[]> {
    return Array.from(this.deals.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getDealsWithClients(): Promise<DealWithClient[]> {
    const deals = await this.getDeals();
    const dealsWithClients: DealWithClient[] = [];

    for (const deal of deals) {
      const client = this.clients.get(deal.clientId);
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
    return this.deals.get(id);
  }

  async createDeal(insertDeal: InsertDeal): Promise<Deal> {
    const id = randomUUID();
    const deal: Deal = {
      ...insertDeal,
      id,
      createdAt: new Date(),
    };
    this.deals.set(id, deal);
    return deal;
  }

  async updateDeal(id: string, updateData: Partial<InsertDeal>): Promise<Deal | undefined> {
    const deal = this.deals.get(id);
    if (!deal) return undefined;

    const updatedDeal = { ...deal, ...updateData };
    this.deals.set(id, updatedDeal);
    return updatedDeal;
  }

  async deleteDeal(id: string): Promise<boolean> {
    return this.deals.delete(id);
  }
}

export const storage = new MemStorage();
