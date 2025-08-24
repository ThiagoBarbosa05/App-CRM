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
  type TelemarketingGoal,
  type InsertTelemarketingGoal,
  type TelemarketingWeeklyResult,
  type InsertTelemarketingWeeklyResult,
  type ClientRegistrationGoal,
  type InsertClientRegistrationGoal,
  type ClientRegistrationWeeklyResult,
  type InsertClientRegistrationWeeklyResult,
  type LearningImage,
  type InsertLearningImage,
  type ClientDebt,
  type InsertClientDebt,
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
  telemarketingGoals,
  telemarketingWeeklyResults,
  clientRegistrationGoals,
  clientRegistrationWeeklyResults,
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
  type InsertCashbackUsage,
  InsertTraining,
  trainings,
  InsertTrainingAttachment,
  trainingAttachments,
  clientDebts,
  sales, // Importação do schema de vendas
  type Sale, // Importação do tipo de venda
  type InsertSale, // Importação do tipo de inserção de venda
  products,
  companyProducts,
  type InsertCompanyProduct,
  type CompanyProduct,
} from "@shared/schema";
import { db } from "./db";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
  isNotNull,
  isNull,
  inArray,
  notInArray,
} from "drizzle-orm";
import { nanoid } from "nanoid";

export interface ClientFilters {
  search?: string;
  name?: string;
  phone?: string;
  cpf?: string;
  responsavelId?: string;
  categoria?: string;
  origem?: string;
  markers?: string;
}

export interface IStorage {
  // Users
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Clients
  getClients(): Promise<Client[]>;
  getAllClientsForExport(): Promise<Client[]>;
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
  getCompanies(): Promise<Company[]>;
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

  // Sales Funnel methods
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
  getCashbackTransactions(
    userId?: string,
    userRole?: string,
  ): Promise<CashbackTransactionWithClient[]>;
  createCashbackTransaction(
    insertTransaction: InsertCashbackTransaction,
  ): Promise<CashbackTransaction>;
  updateCashbackTransaction(
    id: string,
    updateData: Partial<InsertCashbackTransaction>,
  ): Promise<CashbackTransaction | undefined>;

  // Client Cashback Balance methods
  getClientCashbackBalance(
    clientId: string,
  ): Promise<ClientCashbackBalance | undefined>;
  getAllClientCashbackBalances(
    userId?: string,
    userRole?: string,
  ): Promise<ClientCashbackBalanceWithClient[]>;
  getAllCashbackBalances(
    userId?: string,
    userRole?: string,
  ): Promise<ClientCashbackBalanceWithClient[]>;
  updateClientCashbackBalance(clientId: string): Promise<void>;
  deleteCashbackBalance(balanceId: string): Promise<boolean>;

  // Cashback Usage methods
  createCashbackUsage(insertUsage: InsertCashbackUsage): Promise<CashbackUsage>;
  getClientCashbackUsage(clientId: string): Promise<CashbackUsage[]>;
  getAllCashbackUsage(
    userId?: string,
    userRole?: string,
  ): Promise<CashbackUsage[]>;

  // Método para calcular cashback baseado nas regras ativas
  calculateCashback(purchaseAmount: number): Promise<{
    setting: CashbackSetting | null;
    cashbackAmount: number;
    rate: number;
  }>;

  getUserRegistrationStats(): Promise<any[]>;

  // Telemarketing Goals methods
  getTelemarketingGoals(userId?: string, userRole?: string): Promise<any[]>;
  getTelemarketingGoalsByMonthYear(
    month: number,
    year: number,
    userId?: string,
    userRole?: string,
  ): Promise<any[]>;
  createTelemarketingGoal(
    insertGoal: InsertTelemarketingGoal,
  ): Promise<TelemarketingGoal>;
  updateTelemarketingGoal(
    id: string,
    updateData: Partial<InsertTelemarketingGoal>,
  ): Promise<TelemarketingGoal | undefined>;
  deleteTelemarketingGoal(id: string): Promise<boolean>;
  getTelemarketingStats(month: number, year: number): Promise<any[]>;

  // Telemarketing Weekly Results methods
  getTelemarketingWeeklyResults(
    goalId: string,
  ): Promise<TelemarketingWeeklyResult[]>;
  createTelemarketingWeeklyResult(
    result: InsertTelemarketingWeeklyResult,
  ): Promise<TelemarketingWeeklyResult>;
  updateTelemarketingWeeklyResult(
    id: string,
    result: Partial<InsertTelemarketingWeeklyResult>,
  ): Promise<TelemarketingWeeklyResult | undefined>;

  // Client Registration Goals methods
  getClientRegistrationGoals(
    userId?: string,
    userRole?: string,
  ): Promise<any[]>;
  getClientRegistrationGoalsByMonthYear(
    month: number,
    year: number,
    userId?: string,
    userRole?: string,
  ): Promise<any[]>;
  createClientRegistrationGoal(
    insertGoal: InsertClientRegistrationGoal,
  ): Promise<ClientRegistrationGoal>;
  updateClientRegistrationGoal(
    id: string,
    updateData: Partial<InsertClientRegistrationGoal>,
  ): Promise<ClientRegistrationGoal | undefined>;
  deleteClientRegistrationGoal(id: string): Promise<boolean>;
  getClientRegistrationStats(month: number, year: number): Promise<any[]>;

  // Client Registration Weekly Results methods
  getClientRegistrationWeeklyResults(
    goalId: string,
  ): Promise<ClientRegistrationWeeklyResult[]>;
  createClientRegistrationWeeklyResult(
    result: InsertClientRegistrationWeeklyResult,
  ): Promise<ClientRegistrationWeeklyResult>;
  updateClientRegistrationWeeklyResult(
    id: string,
    result: Partial<InsertClientRegistrationWeeklyResult>,
  ): Promise<ClientRegistrationWeeklyResult | undefined>;

  // Method to get clients without recent contact
  getClientsWithoutRecentContact(
    userId?: string,
    userRole?: string,
    daysThreshold?: number,
  ): Promise<any[]>;

  // Client Debts methods
  getClientDebts(responsibleId?: string): Promise<any[]>;
  createClientDebt(insertDebt: InsertClientDebt): Promise<ClientDebt>;
  updateClientDebt(
    id: string,
    updates: Partial<InsertClientDebt>,
  ): Promise<ClientDebt | null>;
  deleteClientDebt(id: string): Promise<void>;

  // Dashboard Statistics
  getDashboardStats(userId: string): Promise<any>;

  // Client Funnels methods
  getClientFunnels(clientId: string): Promise<SalesFunnel[]>;

  // Sales Methods
  getSales(): Promise<Sale[]>;
  createSale(saleData: {
    clientId: string;
    date: string;
    grossValue: number;
    cashbackUsed: number;
    netValue: number;
    cashbackGenerated: number;
    userId?: string;
  }): Promise<any>;
  deleteSale(saleId: string): Promise<boolean>;

  // Products Methods
  getProducts();
  createProduct(productData: any);
  updateProduct(id: string, productData: any);
  deleteProduct(id: string);

  // Company Products Management
  getCompanyProducts(companyId: string);
  addProductToCompany(data: InsertCompanyProduct);
  removeProductFromCompany(companyId: string, productId: string);
  getAvailableProductsForCompany(companyId: string);
}

export class DatabaseStorage implements IStorage {
  // Referência ao banco de dados
  private db = db;

  // User methods
  async getUsers(): Promise<User[]> {
    const result = await this.db.select().from(users).orderBy(users.createdAt);
    return result.reverse();
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Hash password before saving
    if (insertUser.password) {
      const bcrypt = await import("bcrypt");
      insertUser.password = await bcrypt.hash(insertUser.password, 10);
    }

    const [user] = await this.db.insert(users).values(insertUser).returning();
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

    const [user] = await this.db
      .update(users)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.db.delete(users).where(eq(users.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Client methods

  async getClients(
    userId?: string,
    userRole?: string,
    filters: ClientFilters = {},
    page: number = 1,
    pageSize: number = 100,
  ): Promise<Client[]> {
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
      conditions.push(ilike(clients.phone, `%${filters.phone}%`));
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
      conditions.push(sql`'${filters.markers}' = ANY(${clients.markers})`);
    }

    // Filtro de busca geral (case-insensitive)
    if (filters.search) {
      const searchTerm = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(clients.name, searchTerm),
          ilike(clients.email, searchTerm),
          ilike(clients.phone, searchTerm),
          ilike(clients.cpf, searchTerm),
        ),
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
    return result;
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

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await this.db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async getClientByCpf(cpf: string): Promise<Client | undefined> {
    const [client] = await this.db
      .select()
      .from(clients)
      .where(eq(clients.cpf, cpf));
    return client || undefined;
  }

  async getClientByPhone(phone: string): Promise<Client | undefined> {
    const [client] = await this.db
      .select()
      .from(clients)
      .where(eq(clients.phone, phone));
    return client || undefined;
  }

  async createClient(insertClient: InsertClient): Promise<Client> {
    const [client] = await this.db
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
    const [client] = await this.db
      .update(clients)
      .set(updateData)
      .where(eq(clients.id, id))
      .returning();
    return client || undefined;
  }

  async deleteClient(id: string): Promise<boolean> {
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
  }

  async deleteClients(ids: string[]): Promise<number> {
    // Primeiro, excluir usos de cashback dos clientes
    await this.db.delete(cashbackUsage).where(inArray(cashbackUsage.clientId, ids));

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
    const result = await this.db.delete(clients).where(inArray(clients.id, ids));
    return result.rowCount || 0;
  }

  async getUniqueMarkers(): Promise<string[]> {
    try {
      const result = await this.db.execute(sql`
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
      let query = this.db.select().from(companies);

      // Se for vendedor, só mostra empresas onde ele é responsável
      if (userRole === "vendedor" && userId) {
        query = query.where(
          eq(companies.responsavelId, userId),
        ) as typeof query;
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
    const [company] = await this.db
      .select()
      .from(companies)
      .where(eq(companies.id, id));
    return company || undefined;
  }

  async getCompanyByCnpj(cnpj: string): Promise<Company | undefined> {
    const [company] = await this.db
      .select()
      .from(companies)
      .where(eq(companies.cnpj, cnpj));
    return company || undefined;
  }

  async getCompanyByPhone(phone: string): Promise<Company | undefined> {
    const [company] = await this.db
      .select()
      .from(companies)
      .where(eq(companies.phone, phone));
    return company || undefined;
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const [company] = await this.db
      .insert(companies)
      .values({
        ...insertCompany,
        sectorId:
          insertCompany.sectorId && insertCompany.sectorId.trim() !== ""
            ? insertCompany.sectorId
            : null,
        responsavelId:
          insertCompany.responsavelId &&
          insertCompany.responsavelId.trim() !== ""
            ? insertCompany.responsavelId
            : null,
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
      updatedAt: new Date(),
    };

    if ("sectorId" in updateData) {
      processedData.sectorId =
        updateData.sectorId && updateData.sectorId.trim() !== ""
          ? updateData.sectorId
          : null;
    }

    if ("responsavelId" in updateData) {
      processedData.responsavelId =
        updateData.responsavelId &&
        updateData.responsavelId.trim() !== ""
          ? updateData.responsavelId
          : null;
    }

    const [company] = await this.db
      .update(companies)
      .set(processedData)
      .where(eq(companies.id, id))
      .returning();
    return company || undefined;
  }

  async deleteCompany(id: string): Promise<boolean> {
    const result = await this.db.delete(companies).where(eq(companies.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteCompanies(ids: string[]): Promise<number> {
    const result = await this.db.delete(companies).where(inArray(companies.id, ids));
    return result.rowCount || 0;
  }

  // Sector methods
  async getSectors(): Promise<Sector[]> {
    const result = await this.db.select().from(sectors).orderBy(sectors.name);
    return result;
  }

  async getSector(id: string): Promise<Sector | undefined> {
    const [sector] = await this.db.select().from(sectors).where(eq(sectors.id, id));
    return sector || undefined;
  }

  async createSector(insertSector: InsertSector): Promise<Sector> {
    const [sector] = await this.db.insert(sectors).values(insertSector).returning();
    return sector;
  }

  async updateSector(
    id: string,
    updateData: Partial<InsertSector>,
  ): Promise<Sector | undefined> {
    const [sector] = await this.db
      .update(sectors)
      .set(updateData)
      .where(eq(sectors.id, id))
      .returning();
    return sector || undefined;
  }

  async deleteSector(id: string): Promise<boolean> {
    const result = await this.db.delete(sectors).where(eq(sectors.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Sales Funnel methods
  async getSalesFunnels(): Promise<SalesFunnelWithStages[]> {
    const funnels = await this.db
      .select()
      .from(salesFunnels)
      .orderBy(salesFunnels.createdAt);
    const funnelsWithStages: SalesFunnelWithStages[] = [];

    for (const funnel of funnels) {
      const stages = await this.db
        .select()
        .from(funnelStages)
        .where(eq(funnelStages.funnelId, funnel.id))
        .orderBy(funnelStages.order);

      const [creator] = await this.db
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
    const [funnel] = await this.db
      .select()
      .from(salesFunnels)
      .where(eq(salesFunnels.id, id));
    if (!funnel) return undefined;

    const stages = await this.db
      .select()
      .from(funnelStages)
      .where(eq(funnelStages.funnelId, funnel.id))
      .orderBy(funnelStages.order);

    const [creator] = await this.db
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
    const [funnel] = await this.db
      .insert(salesFunnels)
      .values(insertFunnel)
      .returning();
    return funnel;
  }

  async updateSalesFunnel(
    id: string,
    updateData: Partial<InsertSalesFunnel>,
  ): Promise<SalesFunnel | undefined> {
    const [funnel] = await this.db
      .update(salesFunnels)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(salesFunnels.id, id))
      .returning();
    return funnel || undefined;
  }

  async deleteSalesFunnel(id: string): Promise<boolean> {
    await this.db.delete(deals).where(eq(deals.funnelId, id));

    await this.db.delete(funnelStages).where(eq(funnelStages.funnelId, id));
    const result = await this.db.delete(salesFunnels).where(eq(salesFunnels.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Funnel Stage methods
  async getFunnelStages(funnelId: string): Promise<FunnelStage[]> {
    return await this.db
      .select()
      .from(funnelStages)
      .where(eq(funnelStages.funnelId, funnelId))
      .orderBy(funnelStages.order);
  }

  async createFunnelStage(
    insertStage: InsertFunnelStage,
  ): Promise<FunnelStage> {
    const [stage] = await this.db
      .insert(funnelStages)
      .values(insertStage)
      .returning();
    return stage;
  }

  async updateFunnelStage(
    id: string,
    updateData: Partial<InsertFunnelStage>,
  ): Promise<FunnelStage | undefined> {
    const [stage] = await this.db
      .update(funnelStages)
      .set(updateData)
      .where(eq(funnelStages.id, id))
      .returning();
    return stage || undefined;
  }

  async deleteFunnelStage(id: string): Promise<boolean> {
    const result = await this.db.delete(funnelStages).where(eq(funnelStages.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Deal methods
  async getDeals(
    funnelId?: string,
    userId?: string,
    userRole?: string,
  ): Promise<Deal[]> {
    let query = this.db.select().from(deals);

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
      dealsResult = await this.db
        .select()
        .from(deals)
        .where(or(eq(deals.createdBy, userId), eq(deals.assignedTo, userId)))
        .orderBy(deals.createdAt);
    } else {
      // Admins e gerentes veem todos os deals
      dealsResult = await this.db.select().from(deals).orderBy(deals.createdAt);
    }

    for (const deal of dealsResult) {
      const [client] = await this.db
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
    const [deal] = await this.db.select().from(deals).where(eq(deals.id, id));
    return deal || undefined;
  }

  async createDeal(insertDeal: InsertDeal): Promise<Deal> {
    const [deal] = await this.db.insert(deals).values(insertDeal).returning();
    return deal;
  }

  async updateDeal(
    id: string,
    updateData: Partial<InsertDeal>,
  ): Promise<Deal | undefined> {
    const [deal] = await this.db
      .update(deals)
      .set(updateData)
      .where(eq(deals.id, id))
      .returning();
    return deal || undefined;
  }

  async deleteDeal(id: string): Promise<boolean> {
    const result = await this.db.delete(deals).where(eq(deals.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Birthday Reminder methods
  async getBirthdayReminders(): Promise<BirthdayReminderWithClient[]> {
    const reminders = await this.db
      .select()
      .from(birthdayReminders)
      .orderBy(birthdayReminders.reminderDate);

    const remindersWithClients: BirthdayReminderWithClient[] = [];

    for (const reminder of reminders) {
      const [client] = await this.db
        .select()
        .from(clients)
        .where(eq(clients.id, reminder.clientId));
      const [creator] = await this.db
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

    const reminders = await this.db
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
      const [client] = await this.db
        .select()
        .from(clients)
        .where(eq(clients.id, reminder.clientId));
      const [creator] = await this.db
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
    const [reminder] = await this.db
      .insert(birthdayReminders)
      .values(insertReminder)
      .returning();
    return reminder;
  }

  async updateBirthdayReminder(
    id: string,
    updateData: Partial<InsertBirthdayReminder>,
  ): Promise<BirthdayReminder | undefined> {
    const [reminder] = await this.db
      .update(birthdayReminders)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(birthdayReminders.id, id))
      .returning();
    return reminder || undefined;
  }

  async deleteBirthdayReminder(id: string): Promise<boolean> {
    const result = await this.db
      .delete(birthdayReminders)
      .where(eq(birthdayReminders.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async markReminderAsSent(id: string): Promise<boolean> {
    const [reminder] = await this.db
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
    const [settings] = await this.db
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
      const [settings] = await this.db
        .update(birthdayReminderSettings)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(birthdayReminderSettings.id, existingSettings.id))
        .returning();
      return settings || undefined;
    } else {
      const [settings] = await this.db
        .insert(birthdayReminderSettings)
        .values(updateData as InsertBirthdayReminderSettings)
        .returning();
      return settings;
    }
  }

  // Birthday utility methods
  async getUpcomingBirthdays(days: number = 7, responsibleId?: string): Promise<any[]> {
    const today = new Date();
    const upcomingClients: any[] = [];

    let query = this.db
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
      query = query.where(and(
        isNotNull(clients.birthday),
        eq(clients.responsavelId, responsibleId)
      ));
    }

    const allClients = await query;

    console.log(
      `Buscando ${responsibleId ? 'clientes do responsável ' + responsibleId : 'todos os clientes'} com data de aniversário cadastrada: ${allClients.length} encontrados.`,
    );

    for (const client of allClients) {
      if (client.birthday) {
        let birthday: Date;

        // Parse different date formats
        if (client.birthday.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Format: YYYY-MM-DD
          birthday = new Date(client.birthday);
        } else if (client.birthday.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
          // Format: DD/MM/YYYY
          const [day, month, year] = client.birthday.split("/");
          birthday = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
          );
        } else {
          console.log(
            `Formato de data inválido para cliente ${client.name}: ${client.birthday}`,
          );
          continue;
        }

        if (isNaN(birthday.getTime())) {
          console.log(
            `Data inválida para cliente ${client.name}: ${client.birthday}`,
          );
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

        upcomingClients.push({ ...client, nextBirthday: thisYearBirthday });
      }
    }

    return upcomingClients.sort(
      (a, b) => a.nextBirthday.getTime() - b.nextBirthday.getTime(),
    );
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
      const existingReminder = await this.db
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
        const [adminUser] = await this.db
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
    const result = await this.db.select().from(tags).orderBy(tags.createdAt);
    return result.reverse();
  }

  async getTag(id: string): Promise<Tag | undefined> {
    const [tag] = await this.db.select().from(tags).where(eq(tags.id, id));
    return tag || undefined;
  }

  async getTagsByType(type: string): Promise<Tag[]> {
    const result = await this.db
      .select()
      .from(tags)
      .where(eq(tags.type, type as "marcador" | "origem" | "categoria"))
      .orderBy(tags.createdAt);
    return result.reverse();
  }

  async createTag(insertTag: InsertTag): Promise<Tag> {
    const [tag] = await this.db.insert(tags).values(insertTag).returning();
    return tag;
  }

  async updateTag(
    id: string,
    updateData: Partial<InsertTag>,
  ): Promise<Tag | undefined> {
    try {
      const [tag] = await this.db
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
    const result = await this.db.delete(tags).where(eq(tags.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Client Interactions methods
  async getClientInteractions(
    clientId: string,
  ): Promise<ClientInteractionWithUser[]> {
    const interactions = await this.db
      .select({
        id: clientInteractions.id,
        clientId: clientInteractions.clientId,
        userId: clientInteractions.userId,
        type: clientInteractions.type,
        subject: clientInteractions.subject,
        description: clientInteractions.description,
        date: clientInteractions.date,
        callResult: clientInteractions.callResult,
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
    const [interaction] = await this.db
      .select()
      .from(clientInteractions)
      .where(eq(clientInteractions.id, id));
    return interaction || undefined;
  }

  async createClientInteraction(
    insertInteraction: InsertClientInteraction,
  ): Promise<ClientInteraction> {
    // Convert date string to Date object if needed
    const processedData = {
      ...insertInteraction,
      date:
        typeof insertInteraction.date === "string"
          ? new Date(insertInteraction.date)
          : insertInteraction.date,
    };

    const [interaction] = await this.db
      .insert(clientInteractions)
      .values(processedData)
      .returning();
    return interaction;
  }

  async updateClientInteraction(
    id: string,
    updateData: Partial<InsertClientInteraction>,
  ): Promise<ClientInteraction | undefined> {
    // Convert date string to Date object if needed
    const processedData = {
      ...updateData,
      date:
        updateData.date && typeof updateData.date === "string"
          ? new Date(updateData.date)
          : updateData.date,
      updatedAt: new Date(),
    };

    const [interaction] = await this.db
      .update(clientInteractions)
      .set(processedData)
      .where(eq(clientInteractions.id, id))
      .returning();
    return interaction || undefined;
  }

  async deleteClientInteraction(id: string): Promise<boolean> {
    const result = await this.db
      .delete(clientInteractions)
      .where(eq(clientInteractions.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Email Campaign methods
  async getEmailCampaigns(): Promise<any[]> {
    const campaigns = await this.db
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
    const [campaign] = await this.db
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
    const [campaign] = await this.db
      .insert(emailCampaigns)
      .values(insertCampaign)
      .returning();
    return campaign;
  }

  async updateEmailCampaign(
    id: string,
    updateData: any,
  ): Promise<any | undefined> {
    const [campaign] = await this.db
      .update(emailCampaigns)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(emailCampaigns.id, id))
      .returning();
    return campaign || undefined;
  }

  async deleteEmailCampaign(id: string): Promise<boolean> {
    const result = await this.db
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
    const result = await this.db
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
    const [result] = await this.db
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
    const [result] = await this.db
      .select()
      .from(userGoals)
      .where(eq(userGoals.userId, userId));

    return result || null;
  }

  async getUserGoalByUserIdMonthYear(
    userId: string,
    month: number,
    year: number,
  ): Promise<any | null> {
    const [result] = await this.db
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

  async createUserGoal(goal: any): Promise<any> {
    const [result] = await this.db.insert(userGoals).values(goal).returning();

    return result;
  }

  async updateUserGoal(id: string, goal: any): Promise<any> {
    const [result] = await this.db
      .update(userGoals)
      .set({ ...goal, updatedAt: new Date() })
      .where(eq(userGoals.id, id))
      .returning();

    return result;
  }

  async deleteUserGoal(id: string): Promise<boolean> {
    const result = await this.db.delete(userGoals).where(eq(userGoals.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getUserGoalsWithResults(month: number, year: number): Promise<any[]> {
    const goals = await this.db
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

    // Para cada meta, buscar os resultados semanais
    const goalsWithResults = await Promise.all(
      goals.map(async (goal) => {
        const weeklyResultsData = await this.getWeeklyResultsByGoalId(goal.id);
        return {
          ...goal,
          weeklyResults: weeklyResultsData,
        };
      }),
    );

    return goalsWithResults;
  }

  // Weekly Results methods
  async getWeeklyResultsByGoalId(goalId: string): Promise<any[]> {
    const results = await this.db
      .select()
      .from(weeklyResults)
      .where(eq(weeklyResults.goalId, goalId))
      .orderBy(weeklyResults.week);

    return results;
  }

  async createWeeklyResult(result: any): Promise<any> {
    const [createdResult] = await this.db
      .insert(weeklyResults)
      .values(result)
      .returning();

    return createdResult;
  }

  async updateWeeklyResult(id: string, result: any): Promise<any> {
    const [updatedResult] = await this.db
      .update(weeklyResults)
      .set({ ...result, updatedAt: new Date() })
      .where(eq(weeklyResults.id, id))
      .returning();

    return updatedResult;
  }

  async getWeeklyResult(goalId: string, week: number): Promise<any | null> {
    const [result] = await this.db
      .select()
      .from(weeklyResults)
      .where(
        and(eq(weeklyResults.goalId, goalId), eq(weeklyResults.week, week)),
      );

    return result || null;
  }

  async getAllWeeklyResults(): Promise<any[]> {
    const results = await this.db
      .select()
      .from(weeklyResults)
      .orderBy(weeklyResults.createdAt);
    return results;
  }

  async deleteWeeklyResult(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(weeklyResults)
        .where(eq(weeklyResults.id, id));
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Erro ao excluir resultado semanal:", error);
      return false;
    }
  }

  // Learning Images methods
  async getLearningImages(): Promise<LearningImage[]> {
    const result = await this.db
      .select()
      .from(learningImages)
      .orderBy(learningImages.createdAt);
    return result.reverse();
  }

  async getLearningImage(id: string): Promise<LearningImage | undefined> {
    const [image] = await this.db
      .select()
      .from(learningImages)
      .where(eq(learningImages.id, id));
    return image || undefined;
  }

  async createLearningImage(
    insertImage: InsertLearningImage,
  ): Promise<LearningImage> {
    const [image] = await this.db
      .insert(learningImages)
      .values(insertImage)
      .returning();
    return image;
  }

  async updateLearningImage(
    id: string,
    updateData: Partial<InsertLearningImage>,
  ): Promise<LearningImage | undefined> {
    const [image] = await this.db
      .update(learningImages)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(learningImages.id, id))
      .returning();
    return image || undefined;
  }

  async deleteLearningImage(id: string): Promise<boolean> {
    const [deletedImage] = await this.db
      .delete(learningImages)
      .where(eq(learningImages.id, id))
      .returning();
    return !!deletedImage;
  }

  // Cashback Settings methods
  async getCashbackSettings(): Promise<CashbackSetting[]> {
    const result = await this.db
      .select()
      .from(cashbackSettings)
      .orderBy(cashbackSettings.createdAt);
    return result;
  }

  async getCashbackSetting(id: string): Promise<CashbackSetting | undefined> {
    const [setting] = await this.db
      .select()
      .from(cashbackSettings)
      .where(eq(cashbackSettings.id, id));
    return setting || undefined;
  }

  async createCashbackSetting(
    insertSetting: InsertCashbackSetting,
  ): Promise<CashbackSetting> {
    const [setting] = await this.db
      .insert(cashbackSettings)
      .values(insertSetting)
      .returning();
    return setting;
  }

  async updateCashbackSetting(
    id: string,
    updateData: Partial<InsertCashbackSetting>,
  ): Promise<CashbackSetting | undefined> {
    const [setting] = await this.db
      .update(cashbackSettings)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(cashbackSettings.id, id))
      .returning();
    return setting || undefined;
  }

  async deleteCashbackSetting(id: string): Promise<boolean> {
    const [deletedSetting] = await this.db
      .delete(cashbackSettings)
      .where(eq(cashbackSettings.id, id))
      .returning();
    return !!deletedSetting;
  }

  // Cashback Transactions methods
  async getCashbackTransactions(
    userId?: string,
    userRole?: string,
  ): Promise<CashbackTransactionWithClient[]>;
  async getCashbackTransactions(
    userId?: string,
    userRole?: string,
  ): Promise<CashbackTransactionWithClient[]> {
    // Sempre fazer join com clientes para mostrar o nome
    let transactionsQuery = this.db.select({
      id: cashbackTransactions.id,
      clientId: cashbackTransactions.clientId,
      dealId: cashbackTransactions.dealId,
      purchaseAmount: cashbackTransactions.purchaseAmount,
      cashbackAmount: cashbackTransactions.cashbackAmount,
      cashbackRate: cashbackTransactions.cashbackRate,
      status: cashbackTransactions.status,
      expiresAt: cashbackTransactions.expiresAt,
      processedBy: cashbackTransactions.processedBy,
      settingId: cashbackTransactions.settingId,
      notes: cashbackTransactions.notes,
      createdAt: cashbackTransactions.createdAt,
      updatedAt: cashbackTransactions.updatedAt,
      clients: {
        id: clients.id,
        name: clients.name,
        email: clients.email
      }
    }).from(cashbackTransactions)
    .leftJoin(clients, eq(clients.id, cashbackTransactions.clientId));

    // Se for vendedor, filtrar apenas transações de clientes sob sua responsabilidade
    if (userRole === "vendedor" && userId) {
      transactionsQuery = transactionsQuery.where(eq(clients.responsavelId, userId));
    }

    const transactions = await transactionsQuery.orderBy(
      cashbackTransactions.createdAt,
    );

    return transactions;
  }

  async createCashbackTransaction(
    insertTransaction: InsertCashbackTransaction,
  ): Promise<CashbackTransaction> {
    // Se não foi fornecida data de validade, calcular baseado na configuração da regra
    if (!insertTransaction.expiresAt) {
      let expirationDays = 28; // Padrão de 28 dias

      // Se há uma regra de cashback definida, usar os dias de validade dela
      if (insertTransaction.settingId) {
        const [setting] = await this.db
          .select()
          .from(cashbackSettings)
          .where(eq(cashbackSettings.id, insertTransaction.settingId));

        if (setting && setting.expirationDays) {
          expirationDays = setting.expirationDays;
        }
      }

      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expirationDays);
      insertTransaction.expiresAt = expirationDate;
    }

    const [transaction] = await this.db
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
    const [transaction] = await this.db
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
  async getClientCashbackBalance(
    clientId: string,
  ): Promise<ClientCashbackBalance | undefined> {
    const [balance] = await this.db
      .select()
      .from(clientCashbackBalance)
      .where(eq(clientCashbackBalance.clientId, clientId));
    return balance || undefined;
  }

  async getAllClientCashbackBalances(
    userId?: string,
    userRole?: string,
  ): Promise<ClientCashbackBalanceWithClient[]> {
    let balancesQuery = this.db
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
        },
      })
      .from(clientCashbackBalance)
      .leftJoin(clients, eq(clients.id, clientCashbackBalance.clientId))
      .leftJoin(users, eq(users.id, clients.responsavelId));

    // Se for vendedor, filtrar apenas saldos de clientes sob sua responsabilidade
    if (userRole === "vendedor" && userId) {
      balancesQuery = balancesQuery.where(
        eq(clients.responsavelId, userId),
      ) as typeof balancesQuery;
    }

    const balances = await balancesQuery.orderBy(
      clientCashbackBalance.currentBalance,
    );

    // Para cada saldo, buscar informações das transações de cashback
    const balancesWithDates = await Promise.all(
      balances.map(async (balance) => {
        // Buscar primeira transação de cashback (data de criação)
        const [firstTransaction] = await this.db
          .select()
          .from(cashbackTransactions)
          .where(
            and(
              eq(cashbackTransactions.clientId, balance.clientId),
              eq(cashbackTransactions.status, "approved"),
            ),
          )
          .orderBy(cashbackTransactions.createdAt)
          .limit(1);

        // Buscar próxima data de vencimento (menor data de expiração futura)
        const [nextExpiring] = await this.db
          .select()
          .from(cashbackTransactions)
          .where(
            and(
              eq(cashbackTransactions.clientId, balance.clientId),
              eq(cashbackTransactions.status, "approved"),
              gt(cashbackTransactions.expiresAt, new Date()),
            ),
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
      }),
    );

    return balancesWithDates;
  }

  async updateClientCashbackBalance(clientId: string): Promise<void> {
    const now = new Date();

    // Calcular total ganho (todos os cashbacks aprovados, independente de validade)
    const allEarnedTransactions = await this.db
      .select()
      .from(cashbackTransactions)
      .where(
        and(
          eq(cashbackTransactions.clientId, clientId),
          eq(cashbackTransactions.status, "approved"),
        ),
      );

    const totalEarned = allEarnedTransactions.reduce(
      (sum, transaction) => sum + Number(transaction.cashbackAmount),
      0,
    );

    // Calcular total ganho válido (apenas cashbacks não expirados)
    const validEarnedTransactions = await this.db
      .select()
      .from(cashbackTransactions)
      .where(
        and(
          eq(cashbackTransactions.clientId, clientId),
          eq(cashbackTransactions.status, "approved"),
          gt(cashbackTransactions.expiresAt, now), // Apenas não expirados
        ),
      );

    const totalValidEarned = validEarnedTransactions.reduce(
      (sum, transaction) => sum + Number(transaction.cashbackAmount),
      0,
    );

    // Calcular total usado
    const usageTransactions = await this.db
      .select()
      .from(cashbackUsage)
      .where(eq(cashbackUsage.clientId, clientId));

    const totalUsed = usageTransactions.reduce(
      (sum, usage) => sum + Number(usage.usedAmount),
      0,
    );

    // Saldo atual = cashback válido - total usado
    const currentBalance = totalValidEarned - totalUsed;

    // Verificar se já existe um registro de saldo
    const existingBalance = await this.getClientCashbackBalance(clientId);

    if (existingBalance) {
      await this.db
        .update(clientCashbackBalance)
        .set({
          totalEarned: totalEarned.toString(),
          totalUsed: totalUsed.toString(),
          currentBalance: currentBalance.toString(),
          lastUpdated: new Date(),
        })
        .where(eq(clientCashbackBalance.clientId, clientId));
    } else {
      await this.db.insert(clientCashbackBalance).values({
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
    const [usage] = await this.db
      .insert(cashbackUsage)
      .values(insertUsage)
      .returning();

    // Atualizar saldo do cliente
    await this.updateClientCashbackBalance(insertUsage.clientId);

    return usage;
  }

  async getClientCashbackUsage(clientId: string): Promise<CashbackUsage[]> {
    const usage = await this.db
      .select()
      .from(cashbackUsage)
      .where(eq(cashbackUsage.clientId, clientId))
      .orderBy(cashbackUsage.createdAt);
    return usage;
  }

  async getAllCashbackBalances(
    userId?: string,
    userRole?: string,
  ): Promise<ClientCashbackBalanceWithClient[]> {
    return this.getAllClientCashbackBalances(userId, userRole);
  }

  async deleteCashbackBalance(balanceId: string): Promise<boolean> {
    try {
      // Buscar o saldo para obter o clientId
      const [balance] = await this.db
        .select()
        .from(clientCashbackBalance)
        .where(eq(clientCashbackBalance.id, balanceId));

      if (!balance) {
        return false;
      }

      const clientId = balance.clientId;

      // Excluir usos de cashback do cliente
      await this.db
        .delete(cashbackUsage)
        .where(eq(cashbackUsage.clientId, clientId));

      // Excluir transações de cashback do cliente
      await this.db
        .delete(cashbackTransactions)
        .where(eq(cashbackTransactions.clientId, clientId));

      // Excluir o saldo de cashback
      const result = await this.db
        .delete(clientCashbackBalance)
        .where(eq(clientCashbackBalance.id, balanceId));

      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Erro ao excluir saldo de cashback:", error);
      return false;
    }
  }

  async getAllCashbackUsage(
    userId?: string,
    userRole?: string,
  ): Promise<CashbackUsage[]> {
    // Sempre fazer join com clientes para mostrar o nome
    let usageQuery = this.db.select({
      id: cashbackUsage.id,
      clientId: cashbackUsage.clientId,
      usedAmount: cashbackUsage.usedAmount,
      description: cashbackUsage.description,
      authorizedBy: cashbackUsage.authorizedBy,
      createdAt: cashbackUsage.createdAt,
      clients: {
        id: clients.id,
        name: clients.name,
        email: clients.email
      }
    }).from(cashbackUsage)
    .leftJoin(clients, eq(clients.id, cashbackUsage.clientId));

    // Se for vendedor, filtrar apenas uso de cashback de clientes sob sua responsabilidade
    if (userRole === "vendedor" && userId) {
      usageQuery = usageQuery.where(eq(clients.responsavelId, userId));
    }

    const usage = await usageQuery.orderBy(cashbackUsage.createdAt);
    return usage;
  }

  // Método para calcular cashback baseado nas regras ativas
  async calculateCashback(purchaseAmount: number): Promise<{
    setting: CashbackSetting | null;
    cashbackAmount: number;
    rate: number;
  }> {
    // Buscar regras ativas ordenadas por maior percentual
    const activeSettings = await this.db
      .select()
      .from(cashbackSettings)
      .where(
        and(
          eq(cashbackSettings.isActive, "true"),
          or(
            isNull(cashbackSettings.validUntil),
            gte(cashbackSettings.validUntil, new Date()),
          ),
        ),
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
    const clientStats = await this.db
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

  // Telemarketing Goals methods
  async getTelemarketingGoals(
    userId?: string,
    userRole?: string,
  ): Promise<any[]> {
    let query = this.db
      .select({
        id: telemarketingGoals.id,
        userId: telemarketingGoals.userId,
        targetResult: telemarketingGoals.targetResult,
        targetQuantity: telemarketingGoals.targetQuantity,
        month: telemarketingGoals.month,
        year: telemarketingGoals.year,
        createdAt: telemarketingGoals.createdAt,
        updatedAt: telemarketingGoals.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(telemarketingGoals)
      .leftJoin(users, eq(telemarketingGoals.userId, users.id));

    // Vendedores só veem suas próprias metas
    if (userRole === "vendedor" && userId) {
      query = query.where(
        eq(telemarketingGoals.userId, userId),
      ) as typeof query;
    }

    const goals = await query.orderBy(desc(telemarketingGoals.createdAt));
    return goals;
  }

  async getTelemarketingGoalsByMonthYear(
    month: number,
    year: number,
    userId?: string,
    userRole?: string,
  ): Promise<any[]> {
    let query = this.db
      .select({
        id: telemarketingGoals.id,
        userId: telemarketingGoals.userId,
        targetResult: telemarketingGoals.targetResult,
        targetQuantity: telemarketingGoals.targetQuantity,
        month: telemarketingGoals.month,
        year: telemarketingGoals.year,
        createdAt: telemarketingGoals.createdAt,
        updatedAt: telemarketingGoals.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(telemarketingGoals)
      .leftJoin(users, eq(telemarketingGoals.userId, users.id));

    // Aplicar filtros
    let whereConditions = and(
      eq(telemarketingGoals.month, month),
      eq(telemarketingGoals.year, year),
    );

    // Vendedores só veem suas próprias metas
    if (userRole === "vendedor" && userId) {
      whereConditions = and(
        whereConditions,
        eq(telemarketingGoals.userId, userId),
      );
    }

    const goals = await query
      .where(whereConditions)
      .orderBy(desc(telemarketingGoals.createdAt));
    return goals;
  }

  async createTelemarketingGoal(
    insertGoal: InsertTelemarketingGoal,
  ): Promise<TelemarketingGoal> {
    const [goal] = await this.db
      .insert(telemarketingGoals)
      .values(insertGoal)
      .returning();
    return goal;
  }

  async updateTelemarketingGoal(
    id: string,
    updateData: Partial<InsertTelemarketingGoal>,
  ): Promise<TelemarketingGoal | undefined> {
    const [goal] = await this.db
      .update(telemarketingGoals)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(telemarketingGoals.id, id))
      .returning();
    return goal || undefined;
  }

  async deleteTelemarketingGoal(id: string): Promise<boolean> {
    const result = await this.db
      .delete(telemarketingGoals)
      .where(eq(telemarketingGoals.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Telemarketing Weekly Results methods
  async getTelemarketingWeeklyResults(
    goalId: string,
  ): Promise<TelemarketingWeeklyResult[]> {
    return await this.db
      .select()
      .from(telemarketingWeeklyResults)
      .where(eq(telemarketingWeeklyResults.telemarketingGoalId, goalId))
      .orderBy(telemarketingWeeklyResults.week);
  }

  async createTelemarketingWeeklyResult(
    insertResult: InsertTelemarketingWeeklyResult,
  ): Promise<TelemarketingWeeklyResult> {
    const [result] = await this.db
      .insert(telemarketingWeeklyResults)
      .values(insertResult)
      .returning();
    return result;
  }

  async updateTelemarketingWeeklyResult(
    id: string,
    updateData: Partial<InsertTelemarketingWeeklyResult>,
  ): Promise<TelemarketingWeeklyResult | undefined> {
    const [result] = await this.db
      .update(telemarketingWeeklyResults)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(telemarketingWeeklyResults.id, id))
      .returning();
    return result || undefined;
  }

  async deleteTelemarketingWeeklyResult(id: string): Promise<boolean> {
    const result = await this.db
      .delete(telemarketingWeeklyResults)
      .where(eq(telemarketingWeeklyResults.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Telemarketing Statistics methods
  async getTelemarketingStatsByPeriod(
    month: number,
    year: number,
  ): Promise<any[]> {
    // Buscar todas as interações de telemarketing no período especificado
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const stats = await this.db
      .select({
        userId: clientInteractions.userId,
        userName: users.name,
        userEmail: users.email,
        callResult: clientInteractions.callResult,
        count: sql<number>`count(*)::int`,
      })
      .from(clientInteractions)
      .leftJoin(users, eq(clientInteractions.userId, users.id))
      .where(
        and(
          eq(clientInteractions.type, "telemarketing"),
          gte(clientInteractions.date, startDate),
          lte(clientInteractions.date, endDate),
          isNotNull(clientInteractions.callResult),
        ),
      )
      .groupBy(
        clientInteractions.userId,
        users.name,
        users.email,
        clientInteractions.callResult,
      );

    // Agrupar por usuário e somar os resultados
    const statsByUser: { [key: string]: any } = {};

    stats.forEach((interaction) => {
      const userId = interaction.userId;
      if (!statsByUser[userId]) {
        statsByUser[userId] = {
          userId,
          userName: interaction.userName,
          userEmail: interaction.userEmail,
          "COM SUCESSO": 0,
          "NÃO ATENDIDA": 0,
          "SEM INTERESSE": 0,
          "NÃO LIGAR MAIS": 0,
          "EM OCUPADO": 0,
          OUTROS: 0,
          total: 0,
        };
      }

      if (interaction.callResult) {
        // Ensure the key exists before assigning
        if (statsByUser[userId][interaction.callResult] !== undefined) {
          statsByUser[userId][interaction.callResult] = interaction.count;
        } else {
          statsByUser[userId]["OUTROS"] = interaction.count;
        }
        statsByUser[userId].total += interaction.count;
      }
    });

    return Object.values(statsByUser);
  }

  // Client Registration Goals methods
  async getClientRegistrationGoals(
    userId?: string,
    userRole?: string,
  ): Promise<any[]> {
    let query = this.db
      .select({
        id: clientRegistrationGoals.id,
        userId: clientRegistrationGoals.userId,
        targetQuantity: clientRegistrationGoals.targetQuantity,
        month: clientRegistrationGoals.month,
        year: clientRegistrationGoals.year,
        createdAt: clientRegistrationGoals.createdAt,
        updatedAt: clientRegistrationGoals.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(clientRegistrationGoals)
      .leftJoin(users, eq(clientRegistrationGoals.userId, users.id));

    // Vendedores só veem suas próprias metas
    if (userRole === "vendedor" && userId) {
      query = query.where(
        eq(clientRegistrationGoals.userId, userId),
      ) as typeof query;
    }

    const goals = await query.orderBy(desc(clientRegistrationGoals.createdAt));
    return goals;
  }

  async getClientRegistrationGoalsByMonthYear(
    month: number,
    year: number,
    userId?: string,
    userRole?: string,
  ): Promise<any[]> {
    let query = this.db
      .select({
        id: clientRegistrationGoals.id,
        userId: clientRegistrationGoals.userId,
        targetQuantity: clientRegistrationGoals.targetQuantity,
        month: clientRegistrationGoals.month,
        year: clientRegistrationGoals.year,
        createdAt: clientRegistrationGoals.createdAt,
        updatedAt: clientRegistrationGoals.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(clientRegistrationGoals)
      .leftJoin(users, eq(clientRegistrationGoals.userId, users.id));

    // Aplicar filtros
    let whereConditions = and(
      eq(clientRegistrationGoals.month, month),
      eq(clientRegistrationGoals.year, year),
    );

    // Vendedores só veem suas próprias metas
    if (userRole === "vendedor" && userId) {
      whereConditions = and(
        whereConditions,
        eq(clientRegistrationGoals.userId, userId),
      );
    }

    const goals = await query
      .where(whereConditions)
      .orderBy(desc(clientRegistrationGoals.createdAt));
    return goals;
  }

  async createClientRegistrationGoal(
    insertGoal: InsertClientRegistrationGoal,
  ): Promise<ClientRegistrationGoal> {
    const [goal] = await this.db
      .insert(clientRegistrationGoals)
      .values(insertGoal)
      .returning();
    return goal;
  }

  async updateClientRegistrationGoal(
    id: string,
    updateData: Partial<InsertClientRegistrationGoal>,
  ): Promise<ClientRegistrationGoal | undefined> {
    const [goal] = await this.db
      .update(clientRegistrationGoals)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(clientRegistrationGoals.id, id))
      .returning();
    return goal || undefined;
  }

  async deleteClientRegistrationGoal(id: string): Promise<boolean> {
    const result = await this.db
      .delete(clientRegistrationGoals)
      .where(eq(clientRegistrationGoals.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Client Registration Statistics methods
  async getClientRegistrationStatsByPeriod(
    month: number,
    year: number,
  ): Promise<any[]> {
    // Buscar todos os clientes cadastrados no período especificado
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const registrations = await this.db
      .select({
        userId: clients.responsavelId,
        userName: users.name,
        userEmail: users.email,
        count: sql<number>`count(*)::int`,
      })
      .from(clients)
      .leftJoin(users, eq(clients.responsavelId, users.id))
      .where(
        and(
          gte(clients.createdAt, startDate),
          lt(clients.createdAt, endDate),
          isNotNull(clients.responsavelId),
        ),
      )
      .groupBy(clients.responsavelId, users.name, users.email);

    // Agrupar por usuário
    const statsByUser: { [key: string]: any } = {};

    registrations.forEach((registration) => {
      const userId = registration.userId;
      if (userId && !statsByUser[userId]) {
        statsByUser[userId] = {
          userId,
          userName: registration.userName,
          userEmail: registration.userEmail,
          totalRegistrations: registration.count,
        };
      }
    });

    return Object.values(statsByUser);
  }

  // Alias methods to maintain consistency with interface
  async getTelemarketingStats(month: number, year: number): Promise<any[]> {
    return this.getTelemarketingStatsByPeriod(month, year);
  }

  async getClientRegistrationStats(
    month: number,
    year: number,
  ): Promise<any[]> {
    return this.getClientRegistrationStatsByPeriod(month, year);
  }

  // Client Registration Weekly Results methods
  async getClientRegistrationWeeklyResults(
    goalId: string,
  ): Promise<ClientRegistrationWeeklyResult[]> {
    const results = await this.db
      .select()
      .from(clientRegistrationWeeklyResults)
      .where(eq(clientRegistrationWeeklyResults.registrationGoalId, goalId))
      .orderBy(clientRegistrationWeeklyResults.week);
    return results;
  }

  async createClientRegistrationWeeklyResult(
    result: InsertClientRegistrationWeeklyResult,
  ): Promise<ClientRegistrationWeeklyResult> {
    const [newResult] = await this.db
      .insert(clientRegistrationWeeklyResults)
      .values(result)
      .returning();
    return newResult;
  }

  async updateClientRegistrationWeeklyResult(
    id: string,
    result: Partial<InsertClientRegistrationWeeklyResult>,
  ): Promise<ClientRegistrationWeeklyResult | undefined> {
    const [updatedResult] = await this.db
      .update(clientRegistrationWeeklyResults)
      .set({ ...result, updatedAt: new Date() })
      .where(eq(clientRegistrationWeeklyResults.id, id))
      .returning();
    return updatedResult || undefined;
  }

  // Telemarketing Weekly Results methods
  async createTelemarketingWeeklyResult(
    result: InsertTelemarketingWeeklyResult,
  ): Promise<TelemarketingWeeklyResult> {
    const [newResult] = await this.db
      .insert(telemarketingWeeklyResults)
      .values(result)
      .returning();
    return newResult;
  }

  async updateTelemarketingWeeklyResult(
    id: string,
    result: Partial<InsertTelemarketingWeeklyResult>,
  ): Promise<TelemarketingWeeklyResult | undefined> {
    const [updatedResult] = await this.db
      .update(telemarketingWeeklyResults)
      .set({ ...result, updatedAt: new Date() })
      .where(eq(telemarketingWeeklyResults.id, id))
      .returning();
    return updatedResult || undefined;
  }

  async createTraining(data: InsertTraining) {
    const [training] = await this.db.insert(trainings).values(data).returning();
    return training;
  }

  async getTrainings(type?: string) {
    const trainingsList = await this.db
      .select({
        id: trainings.id,
        title: trainings.title,
        description: trainings.description,
        type: trainings.type,
        duration: trainings.duration,
        content: trainings.content,
        category: trainings.category,
        level: trainings.level,
        displayOrder: trainings.displayOrder,
        createdAt: trainings.createdAt,
        training_attachments: {
          id: trainingAttachments.id,
          url: trainingAttachments.url,
          fileType: trainingAttachments.fileType,
          name: trainingAttachments.name,
        },
      })
      .from(trainings)
      .leftJoin(
        trainingAttachments,
        eq(trainings.id, trainingAttachments.trainingId),
      )
      .where(type ? eq(trainings.type, type) : undefined)
      .orderBy(
        sql`CASE WHEN ${trainings.displayOrder} IS NULL THEN 1 ELSE 0 END`,
        asc(trainings.displayOrder),
        asc(trainings.createdAt)
      );

    const trainingWithAttachments = trainingsList.map((training) => ({
      id: training.id,
      title: training.title,
      description: training.description,
      type: training.type,
      duration: training.duration,
      content: training.content,
      category: training.category,
      level: training.level,
      displayOrder: training.displayOrder,
      createdAt: training.createdAt,
      attachmentUrl: training.training_attachments?.url || null,
      attachmentFileType: training.training_attachments?.fileType || null,
      attachmentName: training.training_attachments?.name || null,
    }));

    return trainingWithAttachments;
  }

  async getTraining(trainingId: string) {
    const [training] = await this.db
      .select()
      .from(trainings)
      .where(eq(trainings.id, trainingId))
      .leftJoin(
        trainingAttachments,
        eq(trainings.id, trainingAttachments.trainingId),
      );
    return training;
  }

  async updateTraining(data: InsertTraining, trainingId: string) {
    const [training] = await this.db
      .update(trainings)
      .set(data)
      .where(eq(trainings.id, trainingId))
      .returning();
    return training;
  }

  async deleteTraining(id: string) {
    await this.db.delete(trainings).where(eq(trainings.id, id));
  }

  async updateTrainingOrder(trainingId: string, newOrder: number) {
    const [training] = await this.db
      .update(trainings)
      .set({ displayOrder: newOrder })
      .where(eq(trainings.id, trainingId))
      .returning();

    return training;
  }

  async reorderTrainings(trainingId: string, direction: 'up' | 'down', type: string) {
    // Get all trainings of the same type ordered by current position
    const allTrainings = await this.db
      .select()
      .from(trainings)
      .where(eq(trainings.type, type))
      .orderBy(
        sql`CASE WHEN ${trainings.displayOrder} IS NULL THEN 999999 ELSE ${trainings.displayOrder} END`,
        asc(trainings.createdAt)
      );

    // Initialize displayOrder for trainings that don't have it
    for (let i = 0; i < allTrainings.length; i++) {
      if (allTrainings[i].displayOrder === null) {
        await this.db
          .update(trainings)
          .set({ displayOrder: i + 1 })
          .where(eq(trainings.id, allTrainings[i].id));
        allTrainings[i].displayOrder = i + 1;
      }
    }

    // Find the training to move
    const currentIndex = allTrainings.findIndex(t => t.id === trainingId);
    if (currentIndex === -1) return null;

    let swapIndex = -1;

    if (direction === 'up' && currentIndex > 0) {
      swapIndex = currentIndex - 1;
    } else if (direction === 'down' && currentIndex < allTrainings.length - 1) {
      swapIndex = currentIndex + 1;
    }

    if (swapIndex === -1) {
      return allTrainings[currentIndex]; // No movement possible
    }

    // Swap the displayOrder values
    const currentOrder = allTrainings[currentIndex].displayOrder!;
    const swapOrder = allTrainings[swapIndex].displayOrder!;

    await this.db
      .update(trainings)
      .set({ displayOrder: swapOrder })
      .where(eq(trainings.id, trainingId));

    await this.db
      .update(trainings)
      .set({ displayOrder: currentOrder })
      .where(eq(trainings.id, allTrainings[swapIndex].id));

    return allTrainings[currentIndex];
  }


  async createTrainingAttachments(data: InsertTrainingAttachment) {
    const [trainingAttachment] = await this.db
      .insert(trainingAttachments)
      .values(data)
      .returning();
    return trainingAttachment;
  }

  async updateTrainingAttachments(data: InsertTrainingAttachment, url: string) {
    const [trainingAttachment] = await this.db
      .select()
      .from(trainingAttachments)
      .where(eq(trainingAttachments.url, url))
      .limit(1);

    const [trainingsAttachmentsUpdated] = await this.db
      .update(trainingAttachments)
      .set({ ...data })
      .where(eq(trainingAttachments.id, trainingAttachment.id))
      .returning();
    return trainingsAttachmentsUpdated;
  }

  async deleteTrainingAttachments(trainingId: string) {
    const result = await this.db
      .delete(trainingAttachments)
      .where(eq(trainingAttachments.trainingId, trainingId));
    return result;
  }

  async getClientsWithoutRecentContact(
    userId?: string,
    userRole?: string,
    daysThreshold: number = 1,
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
          (today.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24),
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
              (1000 * 60 * 60 * 24),
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
                  (1000 * 60 * 60 * 24),
              )
            : null,
        };
      }),
    );

    // Filtrar apenas clientes que precisam ser contactados
    return clientsWithLastInteraction
      .filter((client) => client.needsContact)
      .sort((a, b) => b.daysSinceCreated - a.daysSinceCreated);
  }

  // Client Debts methods
  async getClientDebts(responsibleId?: string): Promise<any[]> {
    const query = this.db
      .select({
        id: clientDebts.id,
        clientId: clientDebts.clientId,
        amount: clientDebts.amount,
        description: clientDebts.description,
        dueDate: clientDebts.dueDate,
        status: clientDebts.status,
        createdAt: clientDebts.createdAt,
        createdBy: clientDebts.createdBy,
        client: {
          id: clients.id,
          name: clients.name,
          phone: clients.phone,
          email: clients.email,
        },
      })
      .from(clientDebts)
      .innerJoin(clients, eq(clientDebts.clientId, clients.id))
      .orderBy(clientDebts.createdAt);

    if (responsibleId) {
      return await query.where(eq(clients.responsavelId, responsibleId));
    }

    return await query;
  }

  async createClientDebt(insertDebt: InsertClientDebt): Promise<ClientDebt> {
    const [debt] = await this.db.insert(clientDebts).values(insertDebt).returning();
    return debt;
  }

  async updateClientDebt(
    id: string,
    updates: Partial<InsertClientDebt>,
  ): Promise<ClientDebt | null> {
    const [debt] = await this.db
      .update(clientDebts)
      .set(updates)
      .where(eq(clientDebts.id, id))
      .returning();
    return debt || null;
  }

  async deleteClientDebt(id: string): Promise<void> {
    await this.db.delete(clientDebts).where(eq(clientDebts.id, id));
  }

  async getDashboardStats(userId: string): Promise<any> {
    // Buscar clientes do vendedor
    const clientsCount = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(clients)
      .where(eq(clients.responsavelId, userId));

    // Buscar deals ativos
    const activeDealsCount = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(deals)
      .where(and(eq(deals.assignedTo, userId), ne(deals.stageId, "fechamento")));

    // Buscar dívidas pendentes
    const pendingDebtsCount = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(clientDebts)
      .innerJoin(clients, eq(clientDebts.clientId, clients.id))
      .where(and(eq(clients.responsavelId, userId), eq(clientDebts.status, "pending")));

    // Buscar dívidas vencidas
    const overdueDebtsCount = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(clientDebts)
      .innerJoin(clients, eq(clientDebts.clientId, clients.id))
      .where(and(eq(clients.responsavelId, userId), eq(clientDebts.status, "pending"), sql`${clientDebts.dueDate} < CURRENT_DATE`));

    return {
      totalClients: clientsCount[0]?.count || 0,
      activeDeals: activeDealsCount[0]?.count || 0,
      pendingDebts: pendingDebtsCount[0]?.count || 0,
      overdueDebts: overdueDebtsCount[0]?.count || 0,
    };
  }

  // Sales Methods
  async getSales(): Promise<Sale[]> {
    const salesData = await this.db
      .select({
        id: sales.id,
        clientId: sales.clientId,
        clientName: clients.name,
        date: sales.date,
        grossValue: sales.grossValue,
        cashbackUsed: sales.cashbackUsed,
        netValue: sales.netValue,
        cashbackGenerated: sales.cashbackGenerated,
        createdAt: sales.createdAt,
      })
      .from(sales)
      .leftJoin(clients, eq(sales.clientId, clients.id))
      .orderBy(desc(sales.createdAt));

    return salesData.map(sale => ({
      ...sale,
      grossValue: parseFloat(sale.grossValue),
      cashbackUsed: parseFloat(sale.cashbackUsed),
      netValue: parseFloat(sale.netValue),
      cashbackGenerated: parseFloat(sale.cashbackGenerated),
    }));
  }

  async createSale(saleData: {
    clientId: string;
    date: string;
    grossValue: number;
    cashbackUsed: number;
    netValue: number;
    cashbackGenerated: number;
    notes?: string;
    invoiceNumber?: string;
    userId?: string;
    useCashback?: boolean;
  }): Promise<any> {
    // Validar e converter a data
    const saleDate = new Date(saleData.date);
    if (isNaN(saleDate.getTime())) {
      throw new Error('Data inválida fornecida');
    }

    const [sale] = await this.db
      .insert(sales)
      .values({
        id: nanoid(),
        clientId: saleData.clientId,
        date: saleDate,
        grossValue: saleData.grossValue.toString(),
        cashbackUsed: saleData.cashbackUsed.toString(),
        netValue: saleData.netValue.toString(),
        cashbackGenerated: saleData.cashbackGenerated.toString(),
        notes: saleData.notes || null,
        invoiceNumber: saleData.invoiceNumber || null,
        userId: saleData.userId || null,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    // Aplicar cashback existente e gerar novo cashback
    if (sale) {
      // 1. APLICAR CASHBACK EXISTENTE (apenas se useCashback for true e houver valor usado)
      if (saleData.useCashback === true && parseFloat(sale.cashbackUsed) > 0) {
        // Buscar saldo do cliente
        const clientBalance = await this.getClientCashbackBalance(sale.clientId);
        if (clientBalance) {
          // Criar registro de uso de cashback
          await this.createCashbackUsage({
            clientId: sale.clientId,
            usedAmount: sale.cashbackUsed.toString(),
            description: `Uso de cashback na venda ${sale.id}`,
            authorizedBy: sale.userId || null
          });

          // Atualizar saldo do cliente
          await this.updateClientCashbackBalance(sale.clientId);
        }
      }

      // 2. GERAR NOVO CASHBACK (se aplicável)
      if (parseFloat(sale.cashbackGenerated) > 0) {
        // Buscar configuração ativa para obter a taxa correta
        const cashbackData = await this.calculateCashback(sale.netValue);

        await this.createCashbackTransaction({
          clientId: sale.clientId,
          dealId: null,
          purchaseAmount: sale.netValue.toString(),
          cashbackAmount: sale.cashbackGenerated.toString(),
          cashbackRate: cashbackData.rate.toString(),
          status: "approved",
          processedBy: sale.userId || null,
          settingId: cashbackData.setting?.id || null,
          notes: `Cashback gerado pela venda ${sale.id}`
        });
      }
    }


    return sale;
  }

  async deleteSale(saleId: string): Promise<boolean> {
    try {
      // Buscar dados da venda antes de excluir
      const [sale] = await this.db
        .select()
        .from(sales)
        .where(eq(sales.id, saleId));

      if (!sale) {
        console.log('Venda não encontrada:', saleId);
        return false;
      }

      console.log('Excluindo venda:', saleId, 'Cliente:', sale.clientId);

      // Reverter transações de cashback relacionadas à venda
      if (sale.cashbackUsed && parseFloat(sale.cashbackUsed) > 0) {
        console.log('Removendo uso de cashback para venda:', saleId);
        // Encontrar e reverter o uso de cashback
        const usageRecords = await this.db
          .select()
          .from(cashbackUsage)
          .where(like(cashbackUsage.description, `%${saleId}%`));

        for (const usageRecord of usageRecords) {
          await this.db
            .delete(cashbackUsage)
            .where(eq(cashbackUsage.id, usageRecord.id));
        }
      }

      if (sale.cashbackGenerated && parseFloat(sale.cashbackGenerated) > 0) {
        console.log('Removendo cashback gerado para venda:', saleId);
        // Encontrar e reverter a transação de cashback gerada
        const transactionRecords = await this.db
          .select()
          .from(cashbackTransactions)
          .where(like(cashbackTransactions.notes, `%${saleId}%`));

        for (const transactionRecord of transactionRecords) {
          await this.db
            .delete(cashbackTransactions)
            .where(eq(cashbackTransactions.id, transactionRecord.id));
        }
      }

      // Excluir a venda
      console.log('Removendo venda do banco de dados:', saleId);
      const result = await this.db
        .delete(sales)
        .where(eq(sales.id, saleId));

      console.log('Resultado da exclusão:', result);

      // Atualizar saldos de cashback do cliente se necessário
      if ((sale.cashbackUsed && parseFloat(sale.cashbackUsed) > 0) ||
          (sale.cashbackGenerated && parseFloat(sale.cashbackGenerated) > 0)) {
        console.log('Atualizando saldo de cashback do cliente:', sale.clientId);
        await this.updateClientCashbackBalance(sale.clientId);
      }

      console.log('Venda excluída com sucesso:', saleId);
      return true;
    } catch (error) {
      console.error('Erro ao excluir venda:', error);
      return false;
    }
  }

  // Get funnels where client has deals
  async getClientFunnels(clientId: string): Promise<SalesFunnel[]> {
    const clientFunnels = await this.db
      .selectDistinct({
        id: salesFunnels.id,
        name: salesFunnels.name,
        description: salesFunnels.description,
        isActive: salesFunnels.isActive,
        createdBy: salesFunnels.createdBy,
        createdAt: salesFunnels.createdAt,
        updatedAt: salesFunnels.updatedAt,
      })
      .from(salesFunnels)
      .innerJoin(deals, eq(deals.funnelId, salesFunnels.id))
      .where(eq(deals.clientId, clientId))
      .orderBy(salesFunnels.name);

    return clientFunnels;
  }

  // Products Methods
  async getProducts() {
    try {
      const products = await this.db
        .select({
          id: products.id,
          name: products.name,
          country: products.country,
          volume: products.volume,
          type: products.type,
          tablePrice: products.tablePrice,
          negotiatedPrice: products.negotiatedPrice,
          createdBy: products.createdBy,
          createdAt: products.createdAt,
          updatedAt: products.updatedAt,
          createdByName: users.name,
        })
        .from(products)
        .leftJoin(users, eq(products.createdBy, users.id))
        .orderBy(desc(products.createdAt));

      return products;
    } catch (error) {
      console.error("Error fetching products:", error);
      throw error;
    }
  }

  async createProduct(productData: any) {
    try {
      const [product] = await this.db
        .insert(products)
        .values(productData)
        .returning();
      return product;
    } catch (error) {
      console.error("Error creating product:", error);
      throw error;
    }
  }

  async updateProduct(id: string, productData: any) {
    try {
      const [product] = await this.db
        .update(products)
        .set({ ...productData, updatedAt: new Date() })
        .where(eq(products.id, id))
        .returning();
      return product;
    } catch (error) {
      console.error("Error updating product:", error);
      throw error;
    }
  }

  async deleteProduct(id: string): Promise<boolean> {
    try {
      const result = await this.db.delete(products).where(eq(products.id, id));
      return result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting product:", error);
      return false;
    }
  }

  // Company Products Management
  async getCompanyProducts(companyId: string) {
    try {
      const result = await this.db
        .select({
          id: companyProducts.id,
          companyId: companyProducts.companyId,
          productId: companyProducts.productId,
          isActive: companyProducts.isActive,
          addedAt: companyProducts.addedAt,
          product: {
            id: products.id,
            name: products.name,
            country: products.country,
            volume: products.volume,
            type: products.type,
            tablePrice: products.tablePrice,
            negotiatedPrice: products.negotiatedPrice,
          },
        })
        .from(companyProducts)
        .innerJoin(products, eq(companyProducts.productId, products.id))
        .where(and(
          eq(companyProducts.companyId, companyId),
          eq(companyProducts.isActive, "true")
        ))
        .orderBy(asc(products.name));

      console.log(`Found ${result.length} products for company ${companyId}`);
      return result;
    } catch (error) {
      console.error("Error fetching company products:", error);
      return [];
    }
  }

  async addProductToCompany(data: InsertCompanyProduct) {
    // Verificar se o produto já está vinculado à empresa
    const existing = await this.db
      .select()
      .from(companyProducts)
      .where(and(
        eq(companyProducts.companyId, data.companyId),
        eq(companyProducts.productId, data.productId)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Se existe mas está inativo, reativar
      if (existing[0].isActive === "false") {
        return await this.db
          .update(companyProducts)
          .set({
            isActive: "true",
            addedAt: new Date(),
            addedBy: data.addedBy
          })
          .where(eq(companyProducts.id, existing[0].id))
          .returning();
      }
      throw new Error("Produto já vinculado a esta empresa");
    }

    return await this.db.insert(companyProducts).values(data).returning();
  }

  async removeProductFromCompany(companyId: string, productId: string) {
    return await this.db
      .update(companyProducts)
      .set({ isActive: "false" })
      .where(and(
        eq(companyProducts.companyId, companyId),
        eq(companyProducts.productId, productId)
      ))
      .returning();
  }

  async getAvailableProductsForCompany(companyId: string) {
    // Buscar produtos que não estão vinculados à empresa ou estão inativos
    const linkedProducts = this.db
      .select({ productId: companyProducts.productId })
      .from(companyProducts)
      .where(and(
        eq(companyProducts.companyId, companyId),
        eq(companyProducts.isActive, "true")
      ));

    return await this.db
      .select()
      .from(products)
      .where(notInArray(products.id, linkedProducts))
      .orderBy(asc(products.name));
  }
}

export const storage = new DatabaseStorage();