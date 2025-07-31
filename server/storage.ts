import {
  type Client,
  type InsertClient,
  type Deal,
  type InsertDeal,
  type DealWithClient,
  type Company,
  type InsertCompany,
  type User,
  type InsertUser,
  type SalesFunnel,
  type InsertSalesFunnel,
  type FunnelStage,
  type InsertFunnelStage,
  type SalesFunnelWithStages,
  type BirthdayReminder,
  type InsertBirthdayReminder,
  type BirthdayReminderWithClient,
  type BirthdayReminderSettings,
  type InsertBirthdayReminderSettings,
  type Tag,
  type InsertTag,
  type ClientInteraction,
  type InsertClientInteraction,
  type ClientInteractionWithUser,
  type Sector,
  type InsertSector,
  type WeeklyResult,
  type EmailCampaign,
  type UserGoal,
  type LearningImage,
  type InsertLearningImage,
  clients,
  deals,
  companies,
  users,
  salesFunnels,
  funnelStages,
  birthdayReminders,
  birthdayReminderSettings,
  tags,
  clientInteractions,
  emailCampaigns,
  sectors,
  userGoals,
  weeklyResults,
  learningImages,
  cashbackSettings,
  type CashbackSetting,
  type InsertCashbackSetting,
  cashbackTransactions,
  type CashbackTransaction,
  type InsertCashbackTransaction,
  type CashbackTransactionWithClient,
  clientCashbackBalance,
  type ClientCashbackBalance,
  type ClientCashbackBalanceWithClient,
  cashbackUsage,
  type CashbackUsage,
  type InsertCashbackUsage
} from "@shared/schema";
import { db } from "./db";
import {
  and,
  desc,
  eq,
  gte,
  gt,
  lt,
  isNotNull,
  sql,
  inArray,
  or,
  isNull,
} from "drizzle-orm";

export interface IStorage {
  // Users
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Clients
  getClients(userId?: string, userRole?: string): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  getClientByCpf(cpf: string): Promise<Client | undefined>;
  getClientByPhone(phone: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(
    id: string,
    client: Partial<InsertClient>,
  ): Promise<Client | undefined>;
  deleteClient(id: string): Promise<boolean>;
  deleteClients(ids: string[]): Promise<number>;
  getUniqueMarkers(): Promise<string[]>;

  // Companies
  getCompanies(userId?: string, userRole?: string): Promise<Company[]>;
  getCompany(id: string): Promise<Company | undefined>;
  getCompanyByCnpj(cnpj: string): Promise<Company | undefined>;
  getCompanyByPhone(phone: string): Promise<Company | undefined>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(
    id: string,
    company: Partial<InsertCompany>,
  ): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<boolean>;
  deleteCompanies(ids: string[]): Promise<number>;

  // Sectors
  getSectors(): Promise<Sector[]>;
  getSector(id: string): Promise<Sector | undefined>;
  createSector(sector: InsertSector): Promise<Sector>;
  updateSector(
    id: string,
    sector: Partial<InsertSector>,
  ): Promise<Sector | undefined>;
  deleteSector(id: string): Promise<boolean>;

  // Sales Funnels
  getSalesFunnels(): Promise<SalesFunnelWithStages[]>;
  getSalesFunnel(id: string): Promise<SalesFunnelWithStages | undefined>;
  createSalesFunnel(funnel: InsertSalesFunnel): Promise<SalesFunnel>;
  updateSalesFunnel(
    id: string,
    funnel: Partial<InsertSalesFunnel>,
  ): Promise<SalesFunnel | undefined>;
  deleteSalesFunnel(id: string): Promise<boolean>;

  // Funnel Stages
  getFunnelStages(funnelId: string): Promise<FunnelStage[]>;
  createFunnelStage(stage: InsertFunnelStage): Promise<FunnelStage>;
  updateFunnelStage(
    id: string,
    stage: Partial<InsertFunnelStage>,
  ): Promise<FunnelStage | undefined>;
  deleteFunnelStage(id: string): Promise<boolean>;

  // Deals
  getDeals(
    funnelId?: string,
    userId?: string,
    userRole?: string,
  ): Promise<Deal[]>;
  getDealsWithClients(
    funnelId?: string,
    userId?: string,
    userRole?: string,
  ): Promise<DealWithClient[]>;
  getDeal(id: string): Promise<Deal | undefined>;
  createDeal(deal: InsertDeal): Promise<Deal>;
  updateDeal(id: string, deal: Partial<InsertDeal>): Promise<Deal | undefined>;
  deleteDeal(id: string): Promise<boolean>;

  // Birthday Reminder methods
  getBirthdayReminders(): Promise<BirthdayReminderWithClient[]>;
  getBirthdayRemindersForToday(): Promise<BirthdayReminderWithClient[]>;
  createBirthdayReminder(
    reminder: InsertBirthdayReminder,
  ): Promise<BirthdayReminder>;
  updateBirthdayReminder(
    id: string,
    reminder: Partial<InsertBirthdayReminder>,
  ): Promise<BirthdayReminder | undefined>;
  deleteBirthdayReminder(id: string): Promise<boolean>;
  markReminderAsSent(id: string): Promise<boolean>;

  // Birthday Reminder Settings methods
  getBirthdayReminderSettings(): Promise<BirthdayReminderSettings | undefined>;
  updateBirthdayReminderSettings(
    settings: Partial<InsertBirthdayReminderSettings>,
  ): Promise<BirthdayReminderSettings | undefined>;

  // Birthday utility methods
  getUpcomingBirthdays(days?: number): Promise<Client[]>;
  createAutomaticReminders(): Promise<number>; // Returns number of reminders created

  // Tags methods
  getTags(): Promise<Tag[]>;
  getTag(id: string): Promise<Tag | undefined>;
  getTagsByType(type: string): Promise<Tag[]>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: string, tag: Partial<InsertTag>): Promise<Tag | undefined>;
  deleteTag(id: string): Promise<boolean>;

  // Client Interactions methods
  getClientInteractions(clientId: string): Promise<ClientInteractionWithUser[]>;
  getClientInteraction(id: string): Promise<ClientInteraction | undefined>;
  createClientInteraction(
    interaction: InsertClientInteraction,
  ): Promise<ClientInteraction>;
  updateClientInteraction(
    id: string,
    interaction: Partial<InsertClientInteraction>,
  ): Promise<ClientInteraction | undefined>;
  deleteClientInteraction(id: string): Promise<boolean>;

  // Email Campaign methods
  getEmailCampaigns(): Promise<any[]>;
  getEmailCampaign(id: string): Promise<any | undefined>;
  createEmailCampaign(campaign: any): Promise<any>;
  updateEmailCampaign(id: string, campaign: any): Promise<any | undefined>;
  deleteEmailCampaign(id: string): Promise<boolean>;
  sendEmailCampaign(
    id: string,
  ): Promise<{ success: boolean; sentCount: number; errors: string[] }>;

  // User Goals methods
  getUserGoals(): Promise<any[]>;
  getUserGoalById(id: string): Promise<any | null>;
  getUserGoalByUserId(userId: string): Promise<any | null>;
  getUserGoalsWithResults(month: number, year: number): Promise<any[]>;
  createUserGoal(goal: any): Promise<any>;
  updateUserGoal(id: string, goal: any): Promise<any>;
  deleteUserGoal(id: string): Promise<boolean>;

  // Weekly Results methods
  getWeeklyResultsByGoalId(goalId: string): Promise<any[]>;
  createWeeklyResult(result: any): Promise<any>;
  updateWeeklyResult(id: string, result: any): Promise<any>;
  getUserGoalByUserIdMonthYear(
    userId: string,
    month: number,
    year: number,
  ): Promise<any | null>;
  getWeeklyResult(goalId: string, week: number): Promise<any | null>;

  // Learning Images methods
  getLearningImages(): Promise<LearningImage[]>;
  getLearningImage(id: string): Promise<LearningImage | undefined>;
  createLearningImage(image: InsertLearningImage): Promise<LearningImage>;
  updateLearningImage(
    id: string,
    image: Partial<InsertLearningImage>,
  ): Promise<LearningImage | undefined>;
  deleteLearningImage(id: string): Promise<boolean>;

  // Cashback Settings methods
  getCashbackSettings(): Promise<CashbackSetting[]>;
  getCashbackSetting(id: string): Promise<CashbackSetting | undefined>;
  createCashbackSetting(
    insertSetting: InsertCashbackSetting,
  ): Promise<CashbackSetting>;
  updateCashbackSetting(
    id: string,
    updateData: Partial<InsertCashbackSetting>,
  ): Promise<CashbackSetting | undefined>;
  deleteCashbackSetting(id: string): Promise<boolean>;

  // Cashback Transactions methods
  getCashbackTransactions(): Promise<CashbackTransactionWithClient[]>;
  createCashbackTransaction(
    insertTransaction: InsertCashbackTransaction,
  ): Promise<CashbackTransaction>;
  updateCashbackTransaction(
    id: string,
    updateData: Partial<InsertCashbackTransaction>,
  ): Promise<CashbackTransaction | undefined>;

  // Client Cashback Balance methods
  getClientCashbackBalance(clientId: string): Promise<ClientCashbackBalance | undefined>;
  getAllClientCashbackBalances(): Promise<ClientCashbackBalanceWithClient[]>;
  getAllCashbackBalances(): Promise<ClientCashbackBalanceWithClient[]>;
  updateClientCashbackBalance(clientId: string): Promise<void>;

  // Cashback Usage methods
  createCashbackUsage(
    insertUsage: InsertCashbackUsage,
  ): Promise<CashbackUsage>;
  getClientCashbackUsage(clientId: string): Promise<CashbackUsage[]>;
  getAllCashbackUsage(): Promise<CashbackUsage[]>;

  // Método para calcular cashback baseado nas regras ativas
  calculateCashback(purchaseAmount: number): Promise<{
    setting: CashbackSetting | null;
    cashbackAmount: number;
    rate: number;
  }>;

  getUserRegistrationStats(): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUsers(): Promise<User[]> {
    const result = await db.select().from(users).orderBy(users.createdAt);
    return result.reverse();
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Hash password before saving
    if (insertUser.password) {
      const bcrypt = await import("bcrypt");
      insertUser.password = await bcrypt.hash(insertUser.password, 10);
    }

    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(
    id: string,
    updateData: Partial<InsertUser>,
  ): Promise<User | undefined> {
    // Hash password if provided
    if (updateData.password) {
      const bcrypt = await import("bcrypt");
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }

    const [user] = await db
      .update(users)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Client methods
  async getClients(userId?: string, userRole?: string): Promise<Client[]> {
    let query = db.select().from(clients);

    // Se for vendedor, só mostra clientes onde ele é responsável
    if (userRole === "vendedor" && userId) {
      query = query.where(eq(clients.responsavelId, userId)) as typeof query;
    }

    const result = await query.orderBy(clients.createdAt);
    return result.reverse(); // Most recent first
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async getClientByCpf(cpf: string): Promise<Client | undefined> {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.cpf, cpf));
    return client || undefined;
  }

  async getClientByPhone(phone: string): Promise<Client | undefined> {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.phone, phone));
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

  async updateClient(
    id: string,
    updateData: Partial<InsertClient>,
  ): Promise<Client | undefined> {
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

  async deleteClients(ids: string[]): Promise<number> {
    const result = await db.delete(clients).where(inArray(clients.id, ids));
    return result.rowCount || 0;
  }

  async getUniqueMarkers(): Promise<string[]> {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT unnest(markers) as marker 
        FROM clients 
        WHERE markers IS NOT NULL AND array_length(markers, 1) > 0
        ORDER BY marker
      `);

      return result.rows.map((row: any) => row.marker);
    } catch (error) {
      console.error("Erro ao buscar marcadores únicos:", error);
      return [];
    }
  }

  // Company methods
  async getCompanies(userId?: string, userRole?: string): Promise<Company[]> {
    try {
      console.log("Executando query para buscar empresas...");
      let query = db.select().from(companies);

      // Se for vendedor, só mostra empresas onde ele é responsável
      if (userRole === "vendedor" && userId) {
        query = query.where(eq(companies.responsavelId, userId)) as typeof query;
      }

      const result = await query.orderBy(companies.createdAt);
      console.log("Query executada com sucesso, resultados:", result.length);
      return result.reverse();
    } catch (error) {
      console.error("Erro na query getCompanies:", error);
      throw error;
    }
  }

  async getCompany(id: string): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.id, id));
    return company || undefined;
  }

  async getCompanyByCnpj(cnpj: string): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.cnpj, cnpj));
    return company || undefined;
  }

  async getCompanyByPhone(phone: string): Promise<Company | undefined> {
    const [company] = await db
      .select()
      .from(companies)
      .where(eq(companies.phone, phone));
    return company || undefined;
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const [company] = await db
      .insert(companies)
      .values({
        ...insertCompany,
        sectorId: insertCompany.sectorId && insertCompany.sectorId.trim() !== '' ? insertCompany.sectorId : null,
        responsavelId: insertCompany.responsavelId && insertCompany.responsavelId.trim() !== '' ? insertCompany.responsavelId : null,
      })
      .returning();
    return company;
  }

  async updateCompany(
    id: string,
    updateData: Partial<InsertCompany>,
  ): Promise<Company | undefined> {
    // Handle empty string conversion to null for foreign keys
    const processedData = {
      ...updateData,
      updatedAt: new Date()
    };

    if ('sectorId' in updateData) {
      processedData.sectorId = updateData.sectorId && updateData.sectorId.trim() !== '' ? updateData.sectorId : null;
    }

    if ('responsavelId' in updateData) {
      processedData.responsavelId = updateData.responsavelId && updateData.responsavelId.trim() !== '' ? updateData.responsavelId : null;
    }

    const [company] = await db
      .update(companies)
      .set(processedData)
      .where(eq(companies.id, id))
      .returning();
    return company || undefined;
  }

  async deleteCompany(id: string): Promise<boolean> {
    const result = await db.delete(companies).where(eq(companies.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteCompanies(ids: string[]): Promise<number> {
    const result = await db.delete(companies).where(inArray(companies.id, ids));
    return result.rowCount || 0;
  }

  // Sector methods
  async getSectors(): Promise<Sector[]> {
    const result = await db.select().from(sectors).orderBy(sectors.name);
    return result;
  }

  async getSector(id: string): Promise<Sector | undefined> {
    const [sector] = await db.select().from(sectors).where(eq(sectors.id, id));
    return sector || undefined;
  }

  async createSector(insertSector: InsertSector): Promise<Sector> {
    const [sector] = await db.insert(sectors).values(insertSector).returning();
    return sector;
  }

  async updateSector(
    id: string,
    updateData: Partial<InsertSector>,
  ): Promise<Sector | undefined> {
    const [sector] = await db
      .update(sectors)
      .set(updateData)
      .where(eq(sectors.id, id))
      .returning();
    return sector || undefined;
  }

  async deleteSector(id: string): Promise<boolean> {
    const result = await db.delete(sectors).where(eq(sectors.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Sales Funnel methods
  async getSalesFunnels(): Promise<SalesFunnelWithStages[]> {
    const funnels = await db
      .select()
      .from(salesFunnels)
      .orderBy(salesFunnels.createdAt);
    const funnelsWithStages: SalesFunnelWithStages[] = [];

    for (const funnel of funnels) {
      const stages = await db
        .select()
        .from(funnelStages)
        .where(eq(funnelStages.funnelId, funnel.id))
        .orderBy(funnelStages.order);

      const [creator] = await db
        .select()
        .from(users)
        .where(eq(users.id, funnel.createdBy));

      funnelsWithStages.push({
        ...funnel,
        stages,
        creator,
      });
    }

    return funnelsWithStages;
  }

  async getSalesFunnel(id: string): Promise<SalesFunnelWithStages | undefined> {
    const [funnel] = await db
      .select()
      .from(salesFunnels)
      .where(eq(salesFunnels.id, id));
    if (!funnel) return undefined;

    const stages = await db
      .select()
      .from(funnelStages)
      .where(eq(funnelStages.funnelId, funnel.id))
      .orderBy(funnelStages.order);

    const [creator] = await db
      .select()
      .from(users)
      .where(eq(users.id, funnel.createdBy));

    return {
      ...funnel,
      stages,
      creator,
    };
  }

  async createSalesFunnel(
    insertFunnel: InsertSalesFunnel,
  ): Promise<SalesFunnel> {
    const [funnel] = await db
      .insert(salesFunnels)
      .values(insertFunnel)
      .returning();
    return funnel;
  }

  async updateSalesFunnel(
    id: string,
    updateData: Partial<InsertSalesFunnel>,
  ): Promise<SalesFunnel | undefined> {
    const [funnel] = await db
      .update(salesFunnels)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(salesFunnels.id, id))
      .returning();
    return funnel || undefined;
  }

  async deleteSalesFunnel(id: string): Promise<boolean> {
    const result = await db.delete(salesFunnels).where(eq(salesFunnels.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Funnel Stage methods
  async getFunnelStages(funnelId: string): Promise<FunnelStage[]> {
    return await db
      .select()
      .from(funnelStages)
      .where(eq(funnelStages.funnelId, funnelId))
      .orderBy(funnelStages.order);
  }

  async createFunnelStage(
    insertStage: InsertFunnelStage,
  ): Promise<FunnelStage> {
    const [stage] = await db
      .insert(funnelStages)
      .values(insertStage)
      .returning();
    return stage;
  }

  async updateFunnelStage(
    id: string,
    updateData: Partial<InsertFunnelStage>,
  ): Promise<FunnelStage | undefined> {
    const [stage] = await db
      .update(funnelStages)
      .set(updateData)
      .where(eq(funnelStages.id, id))
      .returning();
    return stage || undefined;
  }

  async deleteFunnelStage(id: string): Promise<boolean> {
    const result = await db.delete(funnelStages).where(eq(funnelStages.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Deal methods
  async getDeals(
    funnelId?: string,
    userId?: string,
    userRole?: string,
  ): Promise<Deal[]> {
    let query = db.select().from(deals);

    const conditions = [];
    if (funnelId) conditions.push(eq(deals.funnelId, funnelId));
    if (userRole === "vendedor" && userId)
      conditions.push(eq(deals.assignedTo, userId));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const result = await query.orderBy(deals.createdAt);
    return result.reverse(); // Most recent first
  }

  async getDealsWithClients(
    funnelId?: string,
    userId?: string,
    userRole?: string,
  ): Promise<DealWithClient[]> {
    const dealsWithClients: DealWithClient[] = [];
    let dealsResult;

    if (userRole === "vendedor" && userId) {
      // Vendedores só veem deals que eles criaram ou foram atribuídos a eles
      dealsResult = await db
        .select()
        .from(deals)
        .where(or(eq(deals.createdBy, userId), eq(deals.assignedTo, userId)))
        .orderBy(deals.createdAt);
    } else {
      // Admins e gerentes veem todos os deals
      dealsResult = await db.select().from(deals).orderBy(deals.createdAt);
    }

    for (const deal of dealsResult) {
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, deal.clientId));
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
    const [deal] = await db.insert(deals).values(insertDeal).returning();
    return deal;
  }

  async updateDeal(
    id: string,
    updateData: Partial<InsertDeal>,
  ): Promise<Deal | undefined> {
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

  // Birthday Reminder methods
  async getBirthdayReminders(): Promise<BirthdayReminderWithClient[]> {
    const reminders = await db
      .select()
      .from(birthdayReminders)
      .orderBy(birthdayReminders.reminderDate);

    const remindersWithClients: BirthdayReminderWithClient[] = [];

    for (const reminder of reminders) {
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, reminder.clientId));
      const [creator] = await db
        .select()
        .from(users)
        .where(eq(users.id, reminder.createdBy));

      if (client && creator) {
        remindersWithClients.push({
          ...reminder,
          client,
          creator,
        });
      }
    }

    return remindersWithClients;
  }

  async getBirthdayRemindersForToday(): Promise<BirthdayReminderWithClient[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const reminders = await db
      .select()
      .from(birthdayReminders)
      .where(
        and(
          gte(birthdayReminders.reminderDate, today),
          lt(birthdayReminders.reminderDate, tomorrow),
          eq(birthdayReminders.isSent, "false"),
        ),
      );

    const remindersWithClients: BirthdayReminderWithClient[] = [];

    for (const reminder of reminders) {
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, reminder.clientId));
      const [creator] = await db
        .select()
        .from(users)
        .where(eq(users.id, reminder.createdBy));

      if (client && creator) {
        remindersWithClients.push({
          ...reminder,
          client,
          creator,
        });
      }
    }

    return remindersWithClients;
  }

  async createBirthdayReminder(
    insertReminder: InsertBirthdayReminder,
  ): Promise<BirthdayReminder> {
    const [reminder] = await db
      .insert(birthdayReminders)
      .values(insertReminder)
      .returning();
    return reminder;
  }

  async updateBirthdayReminder(
    id: string,
    updateData: Partial<InsertBirthdayReminder>,
  ): Promise<BirthdayReminder | undefined> {
    const [reminder] = await db
      .update(birthdayReminders)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(birthdayReminders.id, id))
      .returning();
    return reminder || undefined;
  }

  async deleteBirthdayReminder(id: string): Promise<boolean> {
    const result = await db
      .delete(birthdayReminders)
      .where(eq(birthdayReminders.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async markReminderAsSent(id: string): Promise<boolean> {
    const [reminder] = await db
      .update(birthdayReminders)
      .set({
        isSent: "true",
        sentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(birthdayReminders.id, id))
      .returning();
    return !!reminder;
  }

  // Birthday Reminder Settings methods
  async getBirthdayReminderSettings(): Promise<
    BirthdayReminderSettings | undefined
  > {
    const [settings] = await db
      .select()
      .from(birthdayReminderSettings)
      .limit(1);
    return settings || undefined;
  }

  async updateBirthdayReminderSettings(
    updateData: Partial<InsertBirthdayReminderSettings>,
  ): Promise<BirthdayReminderSettings | undefined> {
    const existingSettings = await this.getBirthdayReminderSettings();

    if (existingSettings) {
      const [settings] = await db
        .update(birthdayReminderSettings)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(birthdayReminderSettings.id, existingSettings.id))
        .returning();
      return settings || undefined;
    } else {
      const [settings] = await db
        .insert(birthdayReminderSettings)
        .values(updateData as InsertBirthdayReminderSettings)
        .returning();
      return settings;
    }
  }

  // Birthday utility methods
  async getUpcomingBirthdays(days: number = 7): Promise<Client[]> {
    const today = new Date();
    const upcomingClients: Client[] = [];

    const allClients = await db
      .select()
      .from(clients)
      .where(isNotNull(clients.birthday));

    console.log(`Verificando aniversários próximos para ${allClients.length} clientes nos próximos ${days} dias`);

    for (const client of allClients) {
      if (client.birthday) {
        let birthday: Date;
        
        // Parse different date formats
        if (client.birthday.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Format: YYYY-MM-DD
          birthday = new Date(client.birthday);
        } else if (client.birthday.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          // Format: DD/MM/YYYY
          const [day, month, year] = client.birthday.split('/');
          birthday = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        } else {
          console.log(`Formato de data inválido para cliente ${client.name}: ${client.birthday}`);
          continue;
        }

        if (isNaN(birthday.getTime())) {
          console.log(`Data inválida para cliente ${client.name}: ${client.birthday}`);
          continue;
        }

        const thisYearBirthday = new Date(
          today.getFullYear(),
          birthday.getMonth(),
          birthday.getDate(),
        );

        // Se o aniversário já passou este ano, considere o do próximo ano
        if (thisYearBirthday < today) {
          thisYearBirthday.setFullYear(today.getFullYear() + 1);
        }

        const diffTime = thisYearBirthday.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        console.log(`Cliente ${client.name}: aniversário em ${diffDays} dias (${client.birthday})`);

        if (diffDays <= days && diffDays >= 0) {
          upcomingClients.push(client);
        }
      }
    }

    return upcomingClients.sort((a, b) => {
      const aBirthday = new Date(a.birthday!);
      const bBirthday = new Date(b.birthday!);
      const aThisYear = new Date(
        today.getFullYear(),
        aBirthday.getMonth(),
        aBirthday.getDate(),
      );
      const bThisYear = new Date(
        today.getFullYear(),
        bBirthday.getMonth(),
        bBirthday.getDate(),
      );

      if (aThisYear < today) aThisYear.setFullYear(today.getFullYear() + 1);
      if (bThisYear < today) bThisYear.setFullYear(today.getFullYear() + 1);

      return aThisYear.getTime() - bThisYear.getTime();
    });
  }

  async createAutomaticReminders(): Promise<number> {
    const settings = await this.getBirthdayReminderSettings();
    if (!settings || settings.isEnabled !== "true") {
      return 0;
    }

    const upcomingClients = await this.getUpcomingBirthdays(
      settings.defaultDaysBeforeBirthday,
    );
    let remindersCreated = 0;

    for (const client of upcomingClients) {
      if (!client.birthday) continue;

      const birthday = new Date(client.birthday);
      const today = new Date();
      const thisYearBirthday = new Date(
        today.getFullYear(),
        birthday.getMonth(),
        birthday.getDate(),
      );

      if (thisYearBirthday < today) {
        thisYearBirthday.setFullYear(today.getFullYear() + 1);
      }

      const reminderDate = new Date(thisYearBirthday);
      reminderDate.setDate(
        reminderDate.getDate() - settings.defaultDaysBeforeBirthday,
      );

      // Verificar se já existe um lembrete para este cliente nesta data
      const existingReminder = await db
        .select()
        .from(birthdayReminders)
        .where(
          and(
            eq(birthdayReminders.clientId, client.id),
            gte(birthdayReminders.reminderDate, reminderDate),
            lt(
              birthdayReminders.reminderDate,
              new Date(reminderDate.getTime() + 24 * 60 * 60 * 1000),
            ),
          ),
        )
        .limit(1);

      if (existingReminder.length === 0) {
        // Buscar um usuário administrador para criar o lembrete
        const [adminUser] = await db
          .select()
          .from(users)
          .where(eq(users.role, "admin"))
          .limit(1);

        if (adminUser) {
          await this.createBirthdayReminder({
            clientId: client.id,
            reminderDate,
            reminderType: "email",
            daysBeforeBirthday: settings.defaultDaysBeforeBirthday,
            isSent: "false",
            createdBy: adminUser.id,
          });
          remindersCreated++;
        }
      }
    }

    // Atualizar a data da última verificação
    await this.updateBirthdayReminderSettings({
      lastProcessedDate: new Date(),
    });

    return remindersCreated;
  }

  // Tags methods
  async getTags(): Promise<Tag[]> {
    const result = await db.select().from(tags).orderBy(tags.createdAt);
    return result.reverse();
  }

  async getTag(id: string): Promise<Tag | undefined> {
    const [tag] = await db.select().from(tags).where(eq(tags.id, id));
    return tag || undefined;
  }

  async getTagsByType(type: string): Promise<Tag[]> {
    const result = await db.select().from(tags).where(eq(tags.type, type as "marcador" | "origem" | "categoria")).orderBy(tags.createdAt);
    return result.reverse();
  }

  async createTag(insertTag: InsertTag): Promise<Tag> {
    const [tag] = await db.insert(tags).values(insertTag).returning();
    return tag;
  }

  async updateTag(
    id: string,
    updateData: Partial<InsertTag>,
  ): Promise<Tag | undefined> {
    try {
      const [tag] = await db
        .update(tags)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(tags.id, id))
        .returning();
      return tag || undefined;
    } catch (error) {
      console.error("Error in updateTag:", error);
      throw error;
    }
  }

  async deleteTag(id: string): Promise<boolean> {
    const result = await db.delete(tags).where(eq(tags.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Client Interactions methods
  async getClientInteractions(
    clientId: string,
  ): Promise<ClientInteractionWithUser[]> {
    const interactions = await db
      .select({
        id: clientInteractions.id,
        clientId: clientInteractions.clientId,
        userId: clientInteractions.userId,
        type: clientInteractions.type,
        subject: clientInteractions.subject,
        description: clientInteractions.description,
        date: clientInteractions.date,
        duration: clientInteractions.duration,
        status: clientInteractions.status,
        attachments: clientInteractions.attachments,
        createdAt: clientInteractions.createdAt,
        updatedAt: clientInteractions.updatedAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        },
      })
      .from(clientInteractions)
      .innerJoin(users, eq(clientInteractions.userId, users.id))
      .where(eq(clientInteractions.clientId, clientId))
      .orderBy(clientInteractions.date);

    return interactions.map((interaction) => ({
      ...interaction,
      user: interaction.user as User,
    })) as ClientInteractionWithUser[];
  }

  async getClientInteraction(
    id: string,
  ): Promise<ClientInteraction | undefined> {
    const [interaction] = await db
      .select()
      .from(clientInteractions)
      .where(eq(clientInteractions.id, id));
    return interaction || undefined;
  }

  async createClientInteraction(
    insertInteraction: InsertClientInteraction,
  ): Promise<ClientInteraction> {
    const [interaction] = await db
      .insert(clientInteractions)
      .values(insertInteraction)
      .returning();
    return interaction;
  }

  async updateClientInteraction(
    id: string,
    updateData: Partial<InsertClientInteraction>,
  ): Promise<ClientInteraction | undefined> {
    const [interaction] = await db
      .update(clientInteractions)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(clientInteractions.id, id))
      .returning();
    return interaction || undefined;
  }

  async deleteClientInteraction(id: string): Promise<boolean> {
    const result = await db
      .delete(clientInteractions)
      .where(eq(clientInteractions.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Email Campaign methods
  async getEmailCampaigns(): Promise<any[]> {
    const campaigns = await db
      .select({
        id: emailCampaigns.id,
        name: emailCampaigns.name,
        subject: emailCampaigns.subject,
        content: emailCampaigns.content,
        templateType: emailCampaigns.templateType,
        status: emailCampaigns.status,
        targetType: emailCampaigns.targetType,
        targetCriteria: emailCampaigns.targetCriteria,
        totalRecipients: emailCampaigns.totalRecipients,
        sentCount: emailCampaigns.sentCount,
        createdAt: emailCampaigns.createdAt,
        creator: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(emailCampaigns)
      .innerJoin(users, eq(emailCampaigns.createdBy, users.id))
      .orderBy(emailCampaigns.createdAt);

    return campaigns;
  }

  async getEmailCampaign(id: string): Promise<any | undefined> {
    const [campaign] = await db
      .select({
        id: emailCampaigns.id,
        name: emailCampaigns.name,
        subject: emailCampaigns.subject,
        content: emailCampaigns.content,
        templateType: emailCampaigns.templateType,
        status: emailCampaigns.status,
        targetType: emailCampaigns.targetType,
        targetCriteria: emailCampaigns.targetCriteria,
        totalRecipients: emailCampaigns.totalRecipients,
        sentCount: emailCampaigns.sentCount,
        createdAt: emailCampaigns.createdAt,
        creator: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(emailCampaigns)
      .innerJoin(users, eq(emailCampaigns.createdBy, users.id))
      .where(eq(emailCampaigns.id, id));

    return campaign || undefined;
  }

  async createEmailCampaign(insertCampaign: any): Promise<any> {
    const [campaign] = await db
      .insert(emailCampaigns)
      .values(insertCampaign)
      .returning();
    return campaign;
  }

  async updateEmailCampaign(
    id: string,
    updateData: any,
  ): Promise<any | undefined> {
    const [campaign] = await db
      .update(emailCampaigns)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(emailCampaigns.id, id))
      .returning();
    return campaign || undefined;
  }

  async deleteEmailCampaign(id: string): Promise<boolean> {
    const result = await db
      .delete(emailCampaigns)
      .where(eq(emailCampaigns.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async sendEmailCampaign(
    id: string,
  ): Promise<{ success: boolean; sentCount: number; errors: string[] }> {
    // Simula o envio de email (sem SendGrid)
    const campaign = await this.getEmailCampaign(id);
    if (!campaign) {
      return {
        success: false,
        sentCount: 0,
        errors: ["Campanha não encontrada"],
      };
    }

    // Buscar destinatários baseado no targetType
    let recipients: Client[] = [];

    if (campaign.targetType === "all") {
      recipients = await this.getClients();
    } else if (campaign.targetType === "category" && campaign.targetCriteria) {
      recipients = (await this.getClients()).filter(
        (c) => c.categoria === campaign.targetCriteria,
      );
    } else if (campaign.targetType === "origin" && campaign.targetCriteria) {
      recipients = (await this.getClients()).filter(
        (c) => c.origem === campaign.targetCriteria,
      );
    } else if (campaign.targetType === "markers" && campaign.targetCriteria) {
      recipients = (await this.getClients()).filter(
        (c) =>
          c.markers &&
          c.markers.some((m) => m.includes(campaign.targetCriteria)),
      );
    }

    // Filtrar apenas clientes com email
    const recipientsWithEmail = recipients.filter(
      (c) => c.email && c.email.trim() !== "",
    );
    const sentCount = recipientsWithEmail.length;

    // Atualizar campanha com dados do envio
    await this.updateEmailCampaign(id, {
      status: "sent",
      sentAt: new Date(),
      totalRecipients: sentCount,
      sentCount: sentCount,
    });

    return {
      success: true,
      sentCount: sentCount,
      errors: [],
    };
  }

  // User Goals methods
  async getUserGoals(): Promise<any[]> {
    const result = await db
      .select({
        id: userGoals.id,
        userId: userGoals.userId,
        salesGoal: userGoals.salesGoal,
        averageTicket: userGoals.averageTicket,
        itemsPerSale: userGoals.itemsPerSale,
        month: userGoals.month,
        year: userGoals.year,
        createdAt: userGoals.createdAt,
        updatedAt: userGoals.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(userGoals)
      .leftJoin(users, eq(userGoals.userId, users.id))
      .orderBy(users.name);

    return result;
  }

  async getUserGoalById(id: string): Promise<any | null> {
    const [result] = await db
      .select({
        id: userGoals.id,
        userId: userGoals.userId,
        salesGoal: userGoals.salesGoal,
        averageTicket: userGoals.averageTicket,
        itemsPerSale: userGoals.itemsPerSale,
        month: userGoals.month,
        year: userGoals.year,
        createdAt: userGoals.createdAt,
        updatedAt: userGoals.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(userGoals)
      .leftJoin(users, eq(userGoals.userId, users.id))
      .where(eq(userGoals.id, id));

    return result || null;
  }

  async getUserGoalByUserId(userId: string): Promise<any | null> {
    const [result] = await db
      .select()
      .from(userGoals)
      .where(eq(userGoals.userId, userId));

    return result || null;
  }

  async createUserGoal(goal: any): Promise<any> {
    const [result] = await db.insert(userGoals).values(goal).returning();

    return result;
  }

  async updateUserGoal(id: string, goal: any): Promise<any> {
    const [result] = await db
      .update(userGoals)
      .set({ ...goal, updatedAt: new Date() })
      .where(eq(userGoals.id, id))
      .returning();

    return result;
  }

  async deleteUserGoal(id: string): Promise<boolean> {
    const result = await db.delete(userGoals).where(eq(userGoals.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getUserGoalsWithResults(month: number, year: number): Promise<any[]> {
    const result = await db
      .select({
        id: userGoals.id,
        userId: userGoals.userId,
        salesGoal: userGoals.salesGoal,
        averageTicket: userGoals.averageTicket,
        itemsPerSale: userGoals.itemsPerSale,
        month: userGoals.month,
        year: userGoals.year,
        createdAt: userGoals.createdAt,
        updatedAt: userGoals.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(userGoals)
      .leftJoin(users, eq(userGoals.userId, users.id))
      .where(and(eq(userGoals.month, month), eq(userGoals.year, year)))
      .orderBy(users.name);

    return result;
  }

  // Weekly Results methods
  async getWeeklyResultsByGoalId(goalId: string): Promise<any[]> {
    const results = await db
      .select()
      .from(weeklyResults)
      .where(eq(weeklyResults.goalId, goalId))
      .orderBy(weeklyResults.week);

    return results;
  }

  async createWeeklyResult(result: any): Promise<any> {
    const [createdResult] = await db
      .insert(weeklyResults)
      .values(result)
      .returning();

    return createdResult;
  }

  async updateWeeklyResult(id: string, result: any): Promise<any> {
    const [updatedResult] = await db
      .update(weeklyResults)
      .set({ ...result, updatedAt: new Date() })
      .where(eq(weeklyResults.id, id))
      .returning();

    return updatedResult;
  }

  async getUserGoalByUserIdMonthYear(
    userId: string,
    month: number,
    year: number,
  ): Promise<any | null> {
    const [result] = await db
      .select()
      .from(userGoals)
      .where(
        and(
          eq(userGoals.userId, userId),
          eq(userGoals.month, month),
          eq(userGoals.year, year),
        ),
      );

    return result || null;
  }

  async getWeeklyResult(goalId: string, week: number): Promise<any | null> {
    const [result] = await db
      .select()
      .from(weeklyResults)
      .where(
        and(eq(weeklyResults.goalId, goalId), eq(weeklyResults.week, week)),
      );

    return result || null;
  }

  // Learning Images methods
  async getLearningImages(): Promise<LearningImage[]> {
    const result = await db
      .select()
      .from(learningImages)
      .orderBy(learningImages.createdAt);
    return result.reverse();
  }

  async getLearningImage(id: string): Promise<LearningImage | undefined> {
    const [image] = await db
      .select()
      .from(learningImages)
      .where(eq(learningImages.id, id));
    return image || undefined;
  }

  async createLearningImage(
    insertImage: InsertLearningImage,
  ): Promise<LearningImage> {
    const [image] = await db
      .insert(learningImages)
      .values(insertImage)
      .returning();
    return image;
  }

  async updateLearningImage(
    id: string,
    updateData: Partial<InsertLearningImage>,
  ): Promise<LearningImage | undefined> {
    const [image] = await db
      .update(learningImages)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(learningImages.id, id))
      .returning();
    return image || undefined;
  }

  async deleteLearningImage(id: string): Promise<boolean> {
    const [deletedImage] = await db
      .delete(learningImages)
      .where(eq(learningImages.id, id))
      .returning();
    return !!deletedImage;
  }

  // Cashback Settings methods
  async getCashbackSettings(): Promise<CashbackSetting[]> {
    const result = await db
      .select()
      .from(cashbackSettings)
      .orderBy(cashbackSettings.createdAt);
    return result;
  }

  async getCashbackSetting(id: string): Promise<CashbackSetting | undefined> {
    const [setting] = await db
      .select()
      .from(cashbackSettings)
      .where(eq(cashbackSettings.id, id));
    return setting || undefined;
  }

  async createCashbackSetting(
    insertSetting: InsertCashbackSetting,
  ): Promise<CashbackSetting> {
    const [setting] = await db
      .insert(cashbackSettings)
      .values(insertSetting)
      .returning();
    return setting;
  }

  async updateCashbackSetting(
    id: string,
    updateData: Partial<InsertCashbackSetting>,
  ): Promise<CashbackSetting | undefined> {
    const [setting] = await db
      .update(cashbackSettings)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(cashbackSettings.id, id))
      .returning();
    return setting || undefined;
  }

  async deleteCashbackSetting(id: string): Promise<boolean> {
    const [deletedSetting] = await db
      .delete(cashbackSettings)
      .where(eq(cashbackSettings.id, id))
      .returning();
    return !!deletedSetting;
  }

  // Cashback Transactions methods
  async getCashbackTransactions(): Promise<CashbackTransactionWithClient[]> {
    const transactions = await db
      .select()
      .from(cashbackTransactions)
      .orderBy(cashbackTransactions.createdAt);

    const transactionsWithDetails: CashbackTransactionWithClient[] = [];

    for (const transaction of transactions) {
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, transaction.clientId));

      let deal = undefined;
      if (transaction.dealId) {
        const [dealResult] = await db
          .select()
          .from(deals)
          .where(eq(deals.id, transaction.dealId));
        deal = dealResult;
      }

      let setting = undefined;
      if (transaction.settingId) {
        const [settingResult] = await db
          .select()
          .from(cashbackSettings)
          .where(eq(cashbackSettings.id, transaction.settingId));
        setting = settingResult;
      }

      let processedByUser = undefined;
      if (transaction.processedBy) {
        const [userResult] = await db
          .select()
          .from(users)
          .where(eq(users.id, transaction.processedBy));
        processedByUser = userResult;
      }

      transactionsWithDetails.push({
        ...transaction,
        client,
        deal,
        setting,
        processedByUser,
      });
    }

    return transactionsWithDetails;
  }

  async createCashbackTransaction(
    insertTransaction: InsertCashbackTransaction,
  ): Promise<CashbackTransaction> {
    // Se não foi fornecida data de validade, definir 28 dias a partir de agora
    if (!insertTransaction.expiresAt) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 28);
      insertTransaction.expiresAt = expirationDate;
    }

    const [transaction] = await db
      .insert(cashbackTransactions)
      .values(insertTransaction)
      .returning();

    // Atualizar saldo do cliente
    await this.updateClientCashbackBalance(insertTransaction.clientId);

    return transaction;
  }

  async updateCashbackTransaction(
    id: string,
    updateData: Partial<InsertCashbackTransaction>,
  ): Promise<CashbackTransaction | undefined> {
    const [transaction] = await db
      .update(cashbackTransactions)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(cashbackTransactions.id, id))
      .returning();

    if (transaction) {
      // Atualizar saldo do cliente
      await this.updateClientCashbackBalance(transaction.clientId);
    }

    return transaction || undefined;
  }

  // Client Cashback Balance methods
  async getClientCashbackBalance(clientId: string): Promise<ClientCashbackBalance | undefined> {
    const [balance] = await db
      .select()
      .from(clientCashbackBalance)
      .where(eq(clientCashbackBalance.clientId, clientId));
    return balance || undefined;
  }

  async getAllClientCashbackBalances(): Promise<ClientCashbackBalanceWithClient[]> {
    const balances = await db
      .select({
        id: clientCashbackBalance.id,
        clientId: clientCashbackBalance.clientId,
        totalEarned: clientCashbackBalance.totalEarned,
        totalUsed: clientCashbackBalance.totalUsed,
        currentBalance: clientCashbackBalance.currentBalance,
        lastUpdated: clientCashbackBalance.lastUpdated,
        client: {
          id: clients.id,
          name: clients.name,
          phone: clients.phone,
          cpf: clients.cpf,
          email: clients.email,
          birthday: clients.birthday,
          cep: clients.cep,
          address: clients.address,
          number: clients.number,
          neighborhood: clients.neighborhood,
          city: clients.city,
          state: clients.state,
          markers: clients.markers,
          responsavelId: clients.responsavelId,
          categoria: clients.categoria,
          origem: clients.origem,
          createdAt: clients.createdAt,
        },
        responsibleUser: {
          id: users.id,
          name: users.name,
          email: users.email,
        }
      })
      .from(clientCashbackBalance)
      .leftJoin(clients, eq(clients.id, clientCashbackBalance.clientId))
      .leftJoin(users, eq(users.id, clients.responsavelId))
      .orderBy(clientCashbackBalance.currentBalance);

    // Para cada saldo, buscar informações das transações de cashback
    const balancesWithDates = await Promise.all(
      balances.map(async (balance) => {
        // Buscar primeira transação de cashback (data de criação)
        const [firstTransaction] = await db
          .select()
          .from(cashbackTransactions)
          .where(
            and(
              eq(cashbackTransactions.clientId, balance.clientId),
              eq(cashbackTransactions.status, "approved")
            )
          )
          .orderBy(cashbackTransactions.createdAt)
          .limit(1);

        // Buscar próxima data de vencimento (menor data de expiração futura)
        const [nextExpiring] = await db
          .select()
          .from(cashbackTransactions)
          .where(
            and(
              eq(cashbackTransactions.clientId, balance.clientId),
              eq(cashbackTransactions.status, "approved"),
              gt(cashbackTransactions.expiresAt, new Date())
            )
          )
          .orderBy(cashbackTransactions.expiresAt)
          .limit(1);

        return {
          id: balance.id,
          clientId: balance.clientId,
          totalEarned: balance.totalEarned,
          totalUsed: balance.totalUsed,
          currentBalance: balance.currentBalance,
          lastUpdated: balance.lastUpdated,
          client: balance.client!,
          responsibleUser: balance.responsibleUser,
          firstCashbackDate: firstTransaction?.createdAt || null,
          nextExpiryDate: nextExpiring?.expiresAt || null,
        };
      })
    );

    return balancesWithDates;
  }

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
    const existingBalance = await this.getClientCashbackBalance(clientId);

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
      await db
        .insert(clientCashbackBalance)
        .values({
          clientId,
          totalEarned: totalEarned.toString(),
          totalUsed: totalUsed.toString(),
          currentBalance: currentBalance.toString(),
        });
    }
  }

  // Cashback Usage methods
  async createCashbackUsage(
    insertUsage: InsertCashbackUsage,
  ): Promise<CashbackUsage> {
    const [usage] = await db
      .insert(cashbackUsage)
      .values(insertUsage)
      .returning();

    // Atualizar saldo do cliente
    await this.updateClientCashbackBalance(insertUsage.clientId);

    return usage;
  }

  async getClientCashbackUsage(clientId: string): Promise<CashbackUsage[]> {
    const usage = await db
      .select()
      .from(cashbackUsage)
      .where(eq(cashbackUsage.clientId, clientId))
      .orderBy(cashbackUsage.createdAt);
    return usage;
  }

  async getAllCashbackBalances(): Promise<ClientCashbackBalanceWithClient[]> {
    return this.getAllClientCashbackBalances();
  }

  async getAllCashbackUsage(): Promise<CashbackUsage[]> {
    const usage = await db
      .select()
      .from(cashbackUsage)
      .orderBy(cashbackUsage.createdAt);
    return usage;
  }

  // Método para calcular cashback baseado nas regras ativas
  async calculateCashback(purchaseAmount: number): Promise<{
    setting: CashbackSetting | null;
    cashbackAmount: number;
    rate: number;
  }> {
    // Buscar regras ativas ordenadas por maior percentual
    const activeSettings = await db
      .select()
      .from(cashbackSettings)
      .where(
        and(
          eq(cashbackSettings.isActive, "true"),
          or(
            isNull(cashbackSettings.validUntil),
            gte(cashbackSettings.validUntil, new Date())
          )
        )
      )
      .orderBy(sql`${cashbackSettings.percentageRate} DESC`);

    for (const setting of activeSettings) {
      const minimumPurchase = Number(setting.minimumPurchase || 0);

      if (purchaseAmount >= minimumPurchase) {
        const rate = Number(setting.percentageRate) / 100;
        let cashbackAmount = purchaseAmount * rate;

        // Aplicar limite máximo se definido
        if (setting.maximumCashback) {
          const maxCashback = Number(setting.maximumCashback);
          cashbackAmount = Math.min(cashbackAmount, maxCashback);
        }

        return {
          setting,
          cashbackAmount,
          rate: Number(setting.percentageRate),
        };
      }
    }

    return {
      setting: null,
      cashbackAmount: 0,
      rate: 0,
    };
  }

  async getUserRegistrationStats(): Promise<any[]> {
    const clientStats = await db
      .select({
        userId: clients.responsavelId,
        userName: users.name,
        userEmail: users.email,
        registrationCount: sql<number>`count(${clients.id})`.as(
          "registrationCount",
        ),
      })
      .from(clients)
      .leftJoin(users, eq(clients.responsavelId, users.id))
      .where(isNotNull(clients.responsavelId))
      .groupBy(clients.responsavelId, users.name, users.email)
      .orderBy(desc(sql`count(${clients.id})`));

    return clientStats;
  }
}

export const storage = new DatabaseStorage();