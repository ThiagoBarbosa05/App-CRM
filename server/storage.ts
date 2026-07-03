import {
  type Client,
  type InsertClient,
  type Deal,
  type InsertDeal,
  type DealWithClient,
  type DealQuestion,
  type InsertDealQuestion,
  type UpdateDealQuestion,
  type DealAnswer,
  type InsertDealAnswer,
  type DealAnswerWithQuestion,
  type DealWithDetails,
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
  dealQuestions,
  dealAnswers,
  companies,
  users,
  salesFunnels,
  funnelStages,
  birthdayReminders,
  birthdayReminderSettings,
  tags,
  clientInteractions,
  emailCampaigns,
  emailCampaignRecipients,
  sectors,
  userGoals,
  weeklyResults,
  telemarketingGoals,
  telemarketingWeeklyResults,
  clientRegistrationGoals,
  clientRegistrationWeeklyResults,
  markerGoals,
  markerWeeklyResults,
  interactionGoals,
  interactionWeeklyResults,
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
  productCategories,
  type InsertProductCategory,
  type ProductCategory,
  companyProducts,
  type InsertCompanyProduct,
  type CompanyProduct,
  blingOrders,
  blingOrderItems,
  serviceChannels,
  userServiceChannel,
  events,
  eventParticipants,
  eventAttachments,
  messageJobsLogs,
  type InsertEvent,
  type Event,
  type InsertEventParticipant,
  type EventParticipant,
  type InsertEventAttachment,
  type EventAttachment,
  type InsertMarkerGoal,
  type MarkerGoal,
  type InsertMarkerWeeklyResult,
  type MarkerWeeklyResult,
  type InsertInteractionGoal,
  type InteractionGoal,
  type InsertInteractionWeeklyResult,
  type InteractionWeeklyResult,
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
  lt,
  lte,
  or,
  sql,
  isNotNull,
  isNull,
  inArray,
  notInArray,
  ne,
  gt,
  like,
} from "drizzle-orm";
import { nanoid } from "nanoid";
import { format, subMonths } from "date-fns";

export interface ClientFilters {
  search?: string;
  name?: string;
  phone?: string;
  cpf?: string;
  responsavelId?: string;
  categoria?: string;
  origem?: string;
  markers?: string;
  tagIds?: string[];
  whatsappTagIds?: string[];
  exclusiveWhatsappTags?: boolean;
  purchaseStatus?: string;
  purchaseStatusDays?: number;
  wineGrape?: string;
  wineRegion?: string;
  wineType?: string;
  hasWineProfile?: boolean;
  rfmSegment?: string;
  eventId?: string;
  isEventParticipant?: boolean;
}

export interface CompanyFilters {
  search?: string;
  nomeFantasia?: string;
  razaoSocial?: string;
  cnpj?: string;
  responsavelId?: string;
  marker?: string;
}

export interface ProductFilters {
  name?: string;
  type?: string;
  country?: string;
  volume?: string;
  category?: string;
}

export interface IStorage {
  // Users
  getUsers(): Promise<any[]>;
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
  getCompanies(
    userId?: string,
    userRole?: string,
    filters?: CompanyFilters,
    page?: number,
    pageSize?: number,
  ): Promise<{ data: Company[]; total: number }>;
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
  getFunnelStage(id: string): Promise<FunnelStage | undefined>;
  createFunnelStage(stage: InsertFunnelStage): Promise<FunnelStage>;
  updateFunnelStage(
    id: string,
    stage: Partial<InsertFunnelStage>,
  ): Promise<FunnelStage | undefined>;
  deleteFunnelStage(id: string): Promise<boolean>;
  reorderFunnelStages(
    stageUpdates: { id: string; order: number }[],
  ): Promise<boolean>;

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
  getClientsByBirthdayDate(targetDate: Date): Promise<Client[]>;
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
  getAllWeeklyResults(): Promise<any[]>;
  deleteWeeklyResult(id: string): Promise<boolean>;

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

  // Method to calculate cashback based on active rules
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
  ): Promise<ClientRegistrationGoal[]>;
  getClientRegistrationGoalsByMonthYear(
    month: number,
    year: number,
    userId?: string,
    userRole?: string,
  ): Promise<ClientRegistrationGoal[]>;
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

  // Marker Goals methods
  getMarkerGoals(userId?: string, userRole?: string): Promise<MarkerGoal[]>;
  getMarkerGoalsByMonthYear(
    month: number,
    year: number,
    userId?: string,
    userRole?: string,
  ): Promise<MarkerGoal[]>;
  createMarkerGoal(data: InsertMarkerGoal): Promise<MarkerGoal>;
  updateMarkerGoal(
    id: string,
    data: Partial<InsertMarkerGoal>,
  ): Promise<MarkerGoal>;
  deleteMarkerGoal(id: string): Promise<boolean>;
  getMarkerStatsByPeriod(
    month: number,
    year: number,
  ): Promise<
    {
      markerName: string;
      totalClients: number;
      userId: string;
      userName: string;
      userEmail: string;
    }[]
  >;

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
  getCompanyInteractions(
    companyId: string,
  ): Promise<ClientInteractionWithUser[]>;
  getCompanyFunnels(companyId: string): Promise<SalesFunnel[]>;

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

  // Product Categories Methods
  getProductCategories(): Promise<ProductCategory[]>;
  createProductCategory(data: InsertProductCategory): Promise<ProductCategory>;
  updateProductCategory(
    id: string,
    data: Partial<InsertProductCategory>,
  ): Promise<ProductCategory | undefined>;
  deleteProductCategory(id: string): Promise<boolean>;

  // Products Methods
  getProducts(
    filters?: ProductFilters,
    page?: number,
    pageSize?: number,
  ): Promise<{ data: any[]; total: number }>;
  createProduct(productData: any);
  updateProduct(id: string, productData: any);
  deleteProduct(id: string);
  getProductsWithClientCount();
  getClientsWithProduct(productId: string);
  getCompaniesWithProduct(productId: string);
  getProductsStatistics();

  // Company Products Management
  getCompanyProducts(companyId: string);
  addProductToCompany(data: InsertCompanyProduct);
  removeProductFromCompany(companyId: string, productId: string);
  getAvailableProductsForCompany(companyId: string);
  updateCompanyProductPrice(
    companyId: string,
    productId: string,
    customPrice: string,
  ): Promise<CompanyProduct | null>;

  // Events methods
  getEvents(userId?: string, userRole?: string): Promise<Event[]>;
  getEventById(eventId: string): Promise<Event | null>;
  getEventBySlug(slug: string): Promise<Event | null>;
  createEvent(eventData: InsertEvent): Promise<Event>;
  updateEvent(eventId: string, eventData: Partial<InsertEvent>): Promise<Event>;
  deleteEvent(eventId: string): Promise<boolean>;
  updateExpiredEvents(): Promise<number>;
  getEventParticipants(eventId: string): Promise<EventParticipant[]>;
  getClientEvents(clientId: string): Promise<
    Array<{
      participantId: string;
      status: string;
      registrationDate: Date | null;
      numberOfParticipants: number;
      notes: string | null;
      event: {
        id: string;
        name: string;
        eventDate: Date;
        location: string;
        category: string;
        pricePerPerson: string;
      };
    }>
  >;
  addEventParticipant(
    participantData: InsertEventParticipant,
  ): Promise<EventParticipant>;
  updateEventParticipant(
    participantId: string,
    participantData: Partial<InsertEventParticipant>,
  ): Promise<EventParticipant>;
  removeEventParticipant(participantId: string): Promise<boolean>;

  // Event Attachments methods
  getEventAttachments(eventId: string): Promise<EventAttachment[]>;
  addEventAttachment(
    attachmentData: InsertEventAttachment,
  ): Promise<EventAttachment>;
  deleteEventAttachment(attachmentId: string): Promise<boolean>;
  deleteEventAttachmentsByEventId(eventId: string): Promise<boolean>;

  // Task File Folders
  getTaskFileFolders(): Promise<(TaskFileFolder & { fileCount: number })[]>;
  createTaskFileFolder(data: {
    name: string;
    color: string;
    createdById: string;
  }): Promise<TaskFileFolder>;
  updateTaskFileFolder(
    id: string,
    data: { name: string },
  ): Promise<TaskFileFolder | null>;
  deleteTaskFileFolder(id: string): Promise<boolean>;

  // Task Files
  getTaskFiles(
    folderId: string,
  ): Promise<
    (TaskFile & { uploadedBy: { id: string; name: string } | null })[]
  >;
  createTaskFile(data: {
    name: string;
    url: string;
    size: number;
    mimeType: string;
    folderId: string;
    uploadedById: string;
  }): Promise<TaskFile>;
  deleteTaskFile(id: string): Promise<TaskFile | null>;
}

export class DatabaseStorage implements IStorage {
  // Referência ao banco de dados
  private db = db;

  // User methods
  async getUsers(): Promise<any[]> {
    const result = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        password: users.password,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        serviceChannel: {
          id: serviceChannels.id,
          name: serviceChannels.name,
          phoneNumber: serviceChannels.phoneNumber,
        },
      })
      .from(users)
      .leftJoin(userServiceChannel, eq(users.id, userServiceChannel.userId))
      .leftJoin(
        serviceChannels,
        eq(userServiceChannel.serviceChannelId, serviceChannels.id),
      )
      .orderBy(users.createdAt);

    return result.reverse();
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<any | undefined> {
    const [user] = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        password: users.password,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        serviceChannel: {
          id: serviceChannels.id,
          name: serviceChannels.name,
          phoneNumber: serviceChannels.phoneNumber,
        },
      })
      .from(users)
      .where(eq(users.email, email))
      .leftJoin(userServiceChannel, eq(users.id, userServiceChannel.userId))
      .leftJoin(
        serviceChannels,
        eq(userServiceChannel.serviceChannelId, serviceChannels.id),
      );

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
      const normalizedPhone = filters.phone.replace(/\D/g, ""); // só dígitos
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

    // Filtros de perfil de gosto (wine_profile JSONB)
    if (filters.wineGrape) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(${clients.wineProfile}->'uvas_favoritas') uva
          WHERE uva ILIKE ${"%" + filters.wineGrape + "%"}
        )`,
      );
    }
    if (filters.wineRegion) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(${clients.wineProfile}->'regioes_favoritas') regiao
          WHERE regiao ILIKE ${"%" + filters.wineRegion + "%"}
        )`,
      );
    }
    if (filters.wineType) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(${clients.wineProfile}->'tipos_preferidos') tipo
          WHERE tipo ILIKE ${"%" + filters.wineType + "%"}
        )`,
      );
    }
    if (filters.hasWineProfile) {
      conditions.push(sql`${clients.wineProfile} IS NOT NULL`);
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
    const [client] = await this.db
      .select()
      .from(clients)
      .where(eq(clients.id, id));
    if (!client) return undefined;
    // Enriquecer com lastPurchaseDate
    const safeId = id.replace(/'/g, "");
    const purchaseResult = await this.db.execute(
      sql.raw(`
      SELECT MAX(sale_date)::text AS last_purchase_date
      FROM (
        SELECT sale_date::text AS sale_date FROM bling_orders
        WHERE deleted_at IS NULL AND app_client_id = '${safeId}'
        UNION ALL
        SELECT to_char(sale_date, 'YYYY-MM-DD') AS sale_date FROM connect_orders
        WHERE app_client_id = '${safeId}'
      ) AS purchases
    `),
    );
    const lastPurchaseDate =
      (purchaseResult.rows[0] as any)?.last_purchase_date ?? null;
    return { ...client, lastPurchaseDate } as any;
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
    // Excluir usos de cashback do cliente
    await this.db.delete(cashbackUsage).where(eq(cashbackUsage.clientId, id));

    // Excluir saldo de cashback do cliente
    await this.db
      .delete(clientCashbackBalance)
      .where(eq(clientCashbackBalance.clientId, id));

    // Excluir as transações de cashback do cliente
    await this.db
      .delete(cashbackTransactions)
      .where(eq(cashbackTransactions.clientId, id));

    // Excluir os deals associados ao cliente
    await this.db.delete(deals).where(eq(deals.clientId, id));

    // Excluir as interações do cliente
    await this.db
      .delete(clientInteractions)
      .where(eq(clientInteractions.clientId, id));

    // Excluir lembretes de aniversário do cliente
    await this.db
      .delete(birthdayReminders)
      .where(eq(birthdayReminders.clientId, id));

    // Excluir destinatários de campanhas de email do cliente
    await this.db
      .delete(emailCampaignRecipients)
      .where(eq(emailCampaignRecipients.clientId, id));

    // Excluir dívidas do cliente
    await this.db.delete(clientDebts).where(eq(clientDebts.clientId, id));

    // Excluir vendas do cliente
    await this.db.delete(sales).where(eq(sales.clientId, id));

    // Excluir logs de jobs de mensagem do cliente
    await this.db
      .delete(messageJobsLogs)
      .where(eq(messageJobsLogs.clientId, id));

    // Por fim, excluir o cliente
    const result = await this.db.delete(clients).where(eq(clients.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async deleteClients(ids: string[]): Promise<number> {
    // Excluir usos de cashback dos clientes
    await this.db
      .delete(cashbackUsage)
      .where(inArray(cashbackUsage.clientId, ids));

    // Excluir saldos de cashback dos clientes
    await this.db
      .delete(clientCashbackBalance)
      .where(inArray(clientCashbackBalance.clientId, ids));

    // Excluir as transações de cashback dos clientes
    await this.db
      .delete(cashbackTransactions)
      .where(inArray(cashbackTransactions.clientId, ids));

    // Excluir os deals associados aos clientes
    await this.db.delete(deals).where(inArray(deals.clientId, ids));

    // Excluir as interações dos clientes
    await this.db
      .delete(clientInteractions)
      .where(inArray(clientInteractions.clientId, ids));

    // Excluir lembretes de aniversário dos clientes
    await this.db
      .delete(birthdayReminders)
      .where(inArray(birthdayReminders.clientId, ids));

    // Excluir destinatários de campanhas de email dos clientes
    await this.db
      .delete(emailCampaignRecipients)
      .where(inArray(emailCampaignRecipients.clientId, ids));

    // Excluir dívidas dos clientes
    await this.db.delete(clientDebts).where(inArray(clientDebts.clientId, ids));

    // Excluir vendas dos clientes
    await this.db.delete(sales).where(inArray(sales.clientId, ids));

    // Excluir logs de jobs de mensagem dos clientes
    await this.db
      .delete(messageJobsLogs)
      .where(inArray(messageJobsLogs.clientId, ids));

    // Por fim, excluir os clientes
    const result = await this.db
      .delete(clients)
      .where(inArray(clients.id, ids));
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
  async getCompanies(
    userId?: string,
    userRole?: string,
    filters: CompanyFilters = {},
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ data: Company[]; total: number }> {
    try {
      let query = this.db.select().from(companies);
      const conditions: any[] = [];

      if (userRole === "vendedor" && userId) {
        conditions.push(eq(companies.responsavelId, userId));
      }

      if (filters.nomeFantasia) {
        conditions.push(
          ilike(companies.nomeFantasia, `%${filters.nomeFantasia}%`),
        );
      }
      if (filters.razaoSocial) {
        conditions.push(
          ilike(companies.razaoSocial, `%${filters.razaoSocial}%`),
        );
      }
      if (filters.cnpj) {
        conditions.push(ilike(companies.cnpj, `%${filters.cnpj}%`));
      }
      if (filters.responsavelId) {
        conditions.push(eq(companies.responsavelId, filters.responsavelId));
      }

      if (filters.marker) {
        const markerValue = filters.marker.replace(/'/g, "''");
        conditions.push(
          sql`${companies.markers} @> ARRAY[${sql.raw(`'${markerValue}'`)}]::text[]`,
        );
      }

      if (filters.search) {
        const searchTerm = `%${filters.search}%`;
        conditions.push(
          or(
            ilike(companies.nomeFantasia, searchTerm),
            ilike(companies.razaoSocial, searchTerm),
            ilike(companies.cnpj, searchTerm),
          ),
        );
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      let totalQuery = this.db.select({ count: count() }).from(companies);

      if (conditions.length > 0) {
        totalQuery = totalQuery.where(and(...conditions)) as typeof totalQuery;
      }

      const offset = (page - 1) * pageSize;
      const result = await query
        .orderBy(desc(companies.createdAt))
        .limit(pageSize)
        .offset(offset);
      const total = await totalQuery;

      return { data: result, total: total[0].count };
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
        updateData.responsavelId && updateData.responsavelId.trim() !== ""
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
    try {
      console.log("[DELETE COMPANY] Iniciando exclusão da empresa:", id);

      // Primeiro, deletar deals associados
      const dealsDeleted = await this.db
        .delete(deals)
        .where(eq(deals.companyId, id));
      console.log("[DELETE COMPANY] Deals deletados:", dealsDeleted.rowCount);

      // Deletar interações associadas
      const interactionsDeleted = await this.db
        .delete(clientInteractions)
        .where(eq(clientInteractions.companyId, id));
      console.log(
        "[DELETE COMPANY] Interações deletadas:",
        interactionsDeleted.rowCount,
      );

      // Agora deletar a empresa
      const result = await this.db
        .delete(companies)
        .where(eq(companies.id, id));
      console.log(
        "[DELETE COMPANY] Empresa deletada. RowCount:",
        result.rowCount,
      );

      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("[DELETE COMPANY] Erro ao deletar empresa:", error);
      throw error;
    }
  }

  async deleteCompanies(ids: string[]): Promise<number> {
    try {
      console.log("[DELETE COMPANIES] Iniciando exclusão de empresas:", ids);

      // Primeiro, deletar deals associados
      const dealsDeleted = await this.db
        .delete(deals)
        .where(inArray(deals.companyId, ids));
      console.log("[DELETE COMPANIES] Deals deletados:", dealsDeleted.rowCount);

      // Deletar interações associadas
      const interactionsDeleted = await this.db
        .delete(clientInteractions)
        .where(inArray(clientInteractions.companyId, ids));
      console.log(
        "[DELETE COMPANIES] Interações deletadas:",
        interactionsDeleted.rowCount,
      );

      // Agora deletar as empresas
      const result = await this.db
        .delete(companies)
        .where(inArray(companies.id, ids));
      console.log("[DELETE COMPANIES] Empresas deletadas:", result.rowCount);

      return result.rowCount || 0;
    } catch (error) {
      console.error("[DELETE COMPANIES] Erro ao deletar empresas:", error);
      throw error;
    }
  }

  async getProducts(
    filters: ProductFilters = {},
    page: number = 1,
    pageSize: number = 20,
  ): Promise<{ data: any[]; total: number }> {
    try {
      let query = this.db
        .select({
          id: products.id,
          name: products.name,
          category: products.category,
          type: products.type,
          country: products.country,
          volume: products.volume,
          negotiatedPrice: products.negotiatedPrice,
          createdBy: products.createdBy,
          createdAt: products.createdAt,
          createdByName: users.name,
          imageUrl: products.imageUrl,
          aiProfile: products.aiProfile,
          aiProfileGeneratedAt: products.aiProfileGeneratedAt,
        })
        .from(products)
        .leftJoin(users, eq(products.createdBy, users.id))
        .orderBy(asc(products.name));

      const conditions: any[] = [];

      if (filters.name) {
        conditions.push(ilike(products.name, `%${filters.name}%`));
      }
      if (filters.type) {
        conditions.push(ilike(products.type, `%${filters.type}%`));
      }
      if (filters.country) {
        conditions.push(ilike(products.country, `%${filters.country}%`));
      }
      if (filters.volume) {
        conditions.push(ilike(products.volume, `%${filters.volume}%`));
      }
      if (filters.category) {
        conditions.push(eq(products.category, filters.category));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      const totalQuery = this.db
        .select({ count: count() })
        .from(products)
        .where(and(...conditions));

      const offset = (page - 1) * pageSize;
      const [pageRows, totalResult] = await Promise.all([
        query.limit(pageSize).offset(offset),
        totalQuery,
      ]);

      if (pageRows.length === 0) {
        return { data: [], total: totalResult[0].count };
      }

      // Compute buyer counts for this page's products via raw SQL to avoid ORM aliasing issues
      const pageIds = pageRows.map((p) => p.id);
      const idList = sql.join(pageIds.map((id) => sql`${id}`), sql`, `);

      const buyerRows = await this.db.execute(sql`
        WITH all_buyers AS (
          SELECT p2.id AS product_id, bo.app_client_id
          FROM bling_order_items boi
          INNER JOIN bling_orders bo ON bo.id = boi.order_id
          INNER JOIN products p2 ON p2.bling_product_id = boi.product_id
          WHERE bo.app_client_id IS NOT NULL
            AND bo.deleted_at IS NULL
            AND p2.id IN (${idList})

          UNION

          SELECT p2.id AS product_id, co.app_client_id
          FROM connect_order_items coi
          INNER JOIN connect_orders co ON co.id = coi.order_id
          INNER JOIN products p2 ON UPPER(coi.product_name) LIKE UPPER('%' || p2.name || '%')
          WHERE co.app_client_id IS NOT NULL
            AND p2.id IN (${idList})
        )
        SELECT product_id, COUNT(DISTINCT app_client_id)::int AS cnt
        FROM all_buyers
        GROUP BY product_id
      `);

      const countMap = new Map<string, number>(
        (buyerRows.rows as any[]).map((r) => [r.product_id, r.cnt]),
      );

      const data = pageRows.map((p) => ({
        ...p,
        clientCount: countMap.get(p.id) ?? 0,
      }));

      return { data, total: totalResult[0].count };
    } catch (error) {
      console.error("Erro na query getProducts:", error);
      throw error;
    }
  }

  // Sector methods
  async getSectors(): Promise<Sector[]> {
    const result = await this.db.select().from(sectors).orderBy(sectors.name);
    return result;
  }

  async getSector(id: string): Promise<Sector | undefined> {
    const [sector] = await this.db
      .select()
      .from(sectors)
      .where(eq(sectors.id, id));
    return sector || undefined;
  }

  async createSector(insertSector: InsertSector): Promise<Sector> {
    const [sector] = await this.db
      .insert(sectors)
      .values(insertSector)
      .returning();
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
  async getSalesFunnels(): Promise<SalesFunnelWithStages[]>;
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

  async getSalesFunnel(id: string): Promise<SalesFunnelWithStages | undefined>;
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
    const result = await this.db
      .delete(salesFunnels)
      .where(eq(salesFunnels.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Funnel Stage methods
  async getFunnelStages(funnelId: string): Promise<FunnelStage[]>;
  async getFunnelStages(funnelId: string): Promise<FunnelStage[]> {
    return await this.db
      .select()
      .from(funnelStages)
      .where(eq(funnelStages.funnelId, funnelId))
      .orderBy(funnelStages.order);
  }

  async getFunnelStage(id: string): Promise<FunnelStage | undefined> {
    const [stage] = await this.db
      .select()
      .from(funnelStages)
      .where(eq(funnelStages.id, id));
    return stage || undefined;
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
    try {
      // Buscar a etapa a ser excluída para obter o funnelId
      const [stageToDelete] = await this.db
        .select()
        .from(funnelStages)
        .where(eq(funnelStages.id, id));

      if (!stageToDelete) {
        return false; // Etapa não existe
      }

      // Buscar a primeira etapa do mesmo funil (menor ordem) como destino
      const [firstStage] = await this.db
        .select()
        .from(funnelStages)
        .where(
          and(
            eq(funnelStages.funnelId, stageToDelete.funnelId),
            ne(funnelStages.id, id), // Diferente da etapa sendo excluída
          ),
        )
        .orderBy(funnelStages.order)
        .limit(1);

      if (!firstStage) {
        // Se é a única etapa do funil, não permitir exclusão
        throw new Error("Não é possível excluir a única etapa do funil");
      }

      // Usar transação para garantir consistência
      await this.db.transaction(async (tx) => {
        // Mover todos os deals da etapa sendo excluída para a primeira etapa
        await tx
          .update(deals)
          .set({ stageId: firstStage.id })
          .where(eq(deals.stageId, id));

        // Excluir a etapa
        await tx.delete(funnelStages).where(eq(funnelStages.id, id));
      });

      return true;
    } catch (error) {
      console.error("Erro ao excluir etapa:", error);
      throw error;
    }
  }

  async reorderFunnelStages(
    stageUpdates: { id: string; order: number }[],
  ): Promise<boolean>;
  async reorderFunnelStages(
    stageUpdates: { id: string; order: number }[],
  ): Promise<boolean> {
    try {
      await this.db.transaction(async (tx) => {
        for (const stageUpdate of stageUpdates) {
          await tx
            .update(funnelStages)
            .set({ order: stageUpdate.order })
            .where(eq(funnelStages.id, stageUpdate.id));
        }
      });
      return true;
    } catch (error) {
      console.error("Error reordering funnel stages:", error);
      return false;
    }
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
    // Usar uma única query com JOINs para otimizar performance
    let query = this.db
      .select({
        deal: deals,
        client: clients,
        company: companies,
        assignedUser: users,
        stage: funnelStages,
        funnel: salesFunnels,
      })
      .from(deals)
      .leftJoin(clients, eq(deals.clientId, clients.id))
      .leftJoin(companies, eq(deals.companyId, companies.id))
      .leftJoin(users, eq(deals.assignedTo, users.id))
      .leftJoin(funnelStages, eq(deals.stageId, funnelStages.id))
      .leftJoin(salesFunnels, eq(deals.funnelId, salesFunnels.id));

    // Aplicar condições de filtro
    const conditions = [];
    if (funnelId) conditions.push(eq(deals.funnelId, funnelId));
    if (userRole === "vendedor" && userId)
      conditions.push(eq(deals.assignedTo, userId));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query.orderBy(deals.createdAt);

    // Mapear resultados para o formato esperado
    const dealsWithClients: DealWithClient[] = results.reverse().map((row) => ({
      ...row.deal,
      client: row.client,
      company: row.company,
      assignedUser: row.assignedUser,
      stage: row.stage,
      funnel: row.funnel,
    }));

    return dealsWithClients;
  }

  async getDeal(id: string): Promise<Deal | undefined> {
    const [deal] = await this.db.select().from(deals).where(eq(deals.id, id));
    return deal || undefined;
  }

  async getDealById(id: string): Promise<Deal | null> {
    try {
      const [deal] = await this.db.select().from(deals).where(eq(deals.id, id));
      return deal || null;
    } catch (error) {
      console.error("Erro ao buscar deal por ID:", error);
      throw error;
    }
  }

  async createDeal(insertDeal: InsertDeal): Promise<Deal> {
    try {
      console.log(
        "Storage: Criando deal com dados:",
        JSON.stringify(insertDeal, null, 2),
      );
      const [deal] = await this.db.insert(deals).values(insertDeal).returning();
      console.log("Storage: Deal criado com sucesso:", deal.id);
      return deal;
    } catch (error) {
      console.error("Storage: Erro ao criar deal:", error);
      throw error;
    }
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
  async getUpcomingBirthdays(
    days: number = 7,
    responsibleId?: string,
  ): Promise<any[]> {
    const today = new Date();
    const currentYear = today.getFullYear();
    const minBirthYear = currentYear - 18; // Idade mínima de 18 anos
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
      .where(
        and(
          isNotNull(clients.birthday),
          // Excluir datas padrão conhecidas
          sql`${clients.birthday} NOT IN ('2000-01-01', '1990-01-01', '2024-01-01', '2025-01-01')`,
          // Garantir idade mínima de 18 anos
          sql`(
            (${clients.birthday} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' AND
             EXTRACT(YEAR FROM ${clients.birthday}::date) <= ${minBirthYear})
            OR
            (${clients.birthday} ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' AND
             CAST(SPLIT_PART(${clients.birthday}, '/', 3) AS INTEGER) <= ${minBirthYear})
          )`,
        ),
      );

    // Se responsibleId for fornecido, filtrar por ele
    if (responsibleId) {
      query = query.where(
        and(
          isNotNull(clients.birthday),
          sql`${clients.birthday} NOT IN ('2000-01-01', '1990-01-01', '2024-01-01', '2025-01-01')`,
          sql`(
            (${clients.birthday} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' AND
             EXTRACT(YEAR FROM ${clients.birthday}::date) <= ${minBirthYear})
            OR
            (${clients.birthday} ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' AND
             CAST(SPLIT_PART(${clients.birthday}, '/', 3) AS INTEGER) <= ${minBirthYear})
          )`,
          eq(clients.responsavelId, responsibleId),
        ),
      );
    }

    const allClients = await query;

    console.log(
      `Buscando ${
        responsibleId
          ? "clientes do responsável " + responsibleId
          : "todos os clientes"
      } com data de aniversário válida (idade >= 18 anos): ${allClients.length} encontrados.`,
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

  async getClientsByBirthdayDate(targetDate: Date): Promise<Client[]> {
    try {
      const targetMonth = targetDate.getMonth() + 1; // getMonth() returns 0-11
      const targetDay = targetDate.getDate();
      const currentYear = new Date().getFullYear();
      const minBirthYear = currentYear - 18; // Idade mínima de 18 anos

      console.log(
        `[Storage] Buscando clientes aniversariantes para ${targetDay}/${targetMonth} (idade mínima: 18 anos, nascidos até ${minBirthYear})`,
      );

      // Buscar clientes cujo aniversário é na data alvo (considerando apenas mês e dia)
      // Excluir: datas padrão conhecidas + clientes com menos de 18 anos + anos suspeitos (muito recentes)
      const birthdayClients = await this.db
        .select()
        .from(clients)
        .where(
          and(
            isNotNull(clients.birthday),
            // Excluir datas padrão conhecidas
            sql`${clients.birthday} NOT IN ('2000-01-01', '1990-01-01', '2024-01-01', '2025-01-01')`,
            // Garantir idade mínima de 18 anos (ano de nascimento <= ano atual - 18)
            sql`(
              (${clients.birthday} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' AND
               EXTRACT(YEAR FROM ${clients.birthday}::date) <= ${minBirthYear})
              OR
              (${clients.birthday} ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' AND
               CAST(SPLIT_PART(${clients.birthday}, '/', 3) AS INTEGER) <= ${minBirthYear})
            )`,
            // Comparar mês e dia do aniversário
            sql`(
              (${clients.birthday} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' AND
               EXTRACT(MONTH FROM ${clients.birthday}::date) = ${targetMonth} AND
               EXTRACT(DAY FROM ${clients.birthday}::date) = ${targetDay})
              OR
              (${clients.birthday} ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' AND
               CAST(SPLIT_PART(${clients.birthday}, '/', 2) AS INTEGER) = ${targetMonth} AND
               CAST(SPLIT_PART(${clients.birthday}, '/', 1) AS INTEGER) = ${targetDay})
            )`,
          ),
        );

      console.log(
        `[Storage] Encontrados ${birthdayClients.length} cliente(s) aniversariante(s) válido(s) para ${targetDay}/${targetMonth} (idade >= 18 anos)`,
      );

      return birthdayClients;
    } catch (error) {
      console.error(
        "[Storage] Erro ao buscar clientes aniversariantes:",
        error,
      );
      return [];
    }
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
  async getTags(): Promise<Tag[]>;
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

  async getMarkerByNamePattern(pattern: string): Promise<Tag | undefined> {
    const [marker] = await this.db
      .select()
      .from(tags)
      .where(and(eq(tags.type, "marcador"), ilike(tags.name, `%${pattern}%`)))
      .limit(1);
    return marker || undefined;
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
  ): Promise<ClientInteractionWithUser[]>;
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
        latitude: clientInteractions.latitude,
        longitude: clientInteractions.longitude,
        address: clientInteractions.address,
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
      latitude: insertInteraction.latitude
        ? String(insertInteraction.latitude)
        : undefined,
      longitude: insertInteraction.longitude
        ? String(insertInteraction.longitude)
        : undefined,
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
      latitude: updateData.latitude ? String(updateData.latitude) : undefined,
      longitude: updateData.longitude
        ? String(updateData.longitude)
        : undefined,
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
  async getEmailCampaigns(): Promise<any[]>;
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
  async getUserGoals(): Promise<any[]>;
  async getUserGoals(): Promise<any[]> {
    const result = await this.db
      .select({
        id: userGoals.id,
        userId: userGoals.userId,
        salesGoal: userGoals.salesGoal,
        averageTicket: userGoals.averageTicket,
        ordersGoal: userGoals.ordersGoal,
        avgBottleValueGoal: userGoals.avgBottleValueGoal,
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
        ordersGoal: userGoals.ordersGoal,
        avgBottleValueGoal: userGoals.avgBottleValueGoal,
        positivityGoal: userGoals.positivityGoal,
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

    // Positivação da carteira: clientes com compra no mês / total da carteira por vendedor
    const pad = (n: number) => String(n).padStart(2, "0");
    const startDate = `${year}-${pad(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${pad(month)}-${pad(lastDay)}`;

    const connectStart = `${startDate}T00:00:00`;
    const connectEnd = `${endDate}T23:59:59`;
    const portfolioResult = await this.db.execute(sql`
      SELECT
        c.responsavel_id                                            AS user_id,
        COUNT(*)::int                                               AS total,
        COUNT(*) FILTER (
          WHERE EXISTS (
            SELECT 1 FROM bling_orders bo
            WHERE bo.app_client_id = c.id
              AND bo.deleted_at IS NULL
              AND bo.sale_date >= ${startDate}
              AND bo.sale_date <= ${endDate}
          )
          OR EXISTS (
            SELECT 1 FROM connect_orders co
            WHERE co.app_client_id = c.id
              AND co.sale_date >= ${connectStart}::timestamp
              AND co.sale_date <= ${connectEnd}::timestamp
          )
        )::int                                                      AS active_count
      FROM clients c
      WHERE c.responsavel_id IS NOT NULL
      GROUP BY c.responsavel_id
    `);

    const portfolioMap = new Map<string, { total: number; active: number }>(
      (portfolioResult.rows as Record<string, unknown>[]).map((r) => [
        String(r.user_id),
        { total: Number(r.total ?? 0), active: Number(r.active_count ?? 0) },
      ]),
    );

    // Para cada meta, buscar os resultados semanais e anexar positivação
    const goalsWithResults = await Promise.all(
      goals.map(async (goal) => {
        const weeklyResultsData = await this.getWeeklyResultsByGoalId(goal.id);
        const portfolio = portfolioMap.get(goal.userId) ?? {
          total: 0,
          active: 0,
        };
        const positivityAchieved =
          portfolio.total > 0
            ? Math.round((portfolio.active / portfolio.total) * 1000) / 10 // 1 decimal
            : 0;
        return {
          ...goal,
          weeklyResults: weeklyResultsData,
          positivityAchieved,
          positivityTotal: portfolio.total,
        };
      }),
    );

    return goalsWithResults;
  }

  // Weekly Results methods
  async getWeeklyResultsByGoalId(goalId: string): Promise<any[]>;
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
  async getLearningImages(): Promise<LearningImage[]>;
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
  async getCashbackSettings(): Promise<CashbackSetting[]>;
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
    // Sempre fazer join com clientes para mostrar o nome e responsável
    let baseQuery = this.db
      .select({
        // Campos da transação
        transactionId: cashbackTransactions.id,
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
        // Dados do cliente
        clientName: clients.name,
        clientEmail: clients.email,
        // Dados do responsável
        responsibleId: users.id,
        responsibleName: users.name,
      })
      .from(cashbackTransactions)
      .leftJoin(clients, eq(clients.id, cashbackTransactions.clientId))
      .leftJoin(users, eq(users.id, clients.responsavelId));

    // Se for vendedor, filtrar apenas transações de clientes sob sua responsabilidade
    if (userRole === "vendedor" && userId) {
      baseQuery = baseQuery.where(eq(clients.responsavelId, userId));
    }

    const rawTransactions = await baseQuery.orderBy(
      cashbackTransactions.createdAt,
    );

    // Transformar os dados para o formato esperado
    const transactions = rawTransactions.map((row) => ({
      id: row.transactionId,
      clientId: row.clientId,
      dealId: row.dealId,
      purchaseAmount: row.purchaseAmount,
      cashbackAmount: row.cashbackAmount,
      cashbackRate: row.cashbackRate,
      status: row.status,
      expiresAt: row.expiresAt,
      processedBy: row.processedBy,
      settingId: row.settingId,
      notes: row.notes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      // Manter estrutura do cliente para compatibilidade
      clients: {
        id: row.clientId,
        name: row.clientName,
        email: row.clientEmail,
      },
      // Adicionar informações do responsável
      responsible: row.responsibleId
        ? {
            id: row.responsibleId,
            name: row.responsibleName,
          }
        : null,
    })) as any;

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

  async updateCompanyProductPrice(
    companyId: string,
    productId: string,
    customPrice: string,
  ): Promise<CompanyProduct | null> {
    try {
      const [updated] = await this.db
        .update(companyProducts)
        .set({
          customNegotiatedPrice: customPrice,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(companyProducts.companyId, companyId),
            eq(companyProducts.productId, productId),
          ),
        )
        .returning();

      return updated || null;
    } catch (error) {
      console.error("Error updating company product price:", error);
      throw error;
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
    let usageQuery = this.db
      .select({
        id: cashbackUsage.id,
        clientId: cashbackUsage.clientId,
        usedAmount: cashbackUsage.usedAmount,
        description: cashbackUsage.description,
        authorizedBy: cashbackUsage.authorizedBy,
        createdAt: cashbackUsage.createdAt,
        clients: {
          id: clients.id,
          name: clients.name,
          email: clients.email,
        },
      })
      .from(cashbackUsage)
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
  ): Promise<TelemarketingWeeklyResult[]>;
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
  ): Promise<ClientRegistrationGoal[]>;
  async getClientRegistrationGoals(
    userId?: string,
    userRole?: string,
  ): Promise<ClientRegistrationGoal[]> {
    const base = this.db.select().from(clientRegistrationGoals);

    if (userRole !== "admin" && userRole !== "administrador" && userId) {
      return base.where(eq(clientRegistrationGoals.userId, userId));
    }

    return base;
  }

  async getClientRegistrationGoalsByMonthYear(
    month: number,
    year: number,
    userId?: string,
    userRole?: string,
  ): Promise<ClientRegistrationGoal[]>;
  async getClientRegistrationGoalsByMonthYear(
    month: number,
    year: number,
    userId?: string,
    userRole?: string,
  ): Promise<any[]> {
    const conditions: ReturnType<typeof eq>[] = [
      eq(clientRegistrationGoals.month, month),
      eq(clientRegistrationGoals.year, year),
    ];

    // Vendedores só veem suas próprias metas
    if (userRole !== "admin" && userRole !== "administrador" && userId) {
      conditions.push(eq(clientRegistrationGoals.userId, userId));
    }

    return this.db
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
      .leftJoin(users, eq(clientRegistrationGoals.userId, users.id))
      .where(and(...conditions))
      .orderBy(users.name);
  }

  async createClientRegistrationGoal(
    insertGoal: InsertClientRegistrationGoal,
  ): Promise<ClientRegistrationGoal> {
    const [goal] = await this.db
      .insert(clientRegistrationGoals)
      .values(insertGoal)
      .onConflictDoUpdate({
        target: [
          clientRegistrationGoals.userId,
          clientRegistrationGoals.month,
          clientRegistrationGoals.year,
        ],
        set: {
          targetQuantity: insertGoal.targetQuantity,
          updatedAt: new Date(),
        },
      })
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
        totalCount: sql<number>`count(*)::int`,
        completeCount: sql<number>`count(case when
          ${clients.cpf} is not null and ${clients.cpf} <> '' and
          ${clients.phone} is not null and ${clients.phone} <> '' and
          ${clients.birthday} is not null and ${clients.birthday} <> ''
        then 1 end)::int`,
      })
      .from(clients)
      .leftJoin(users, eq(clients.responsavelId, users.id))
      .where(
        and(
          gte(clients.createdAt, startDate),
          lte(clients.createdAt, endDate),
          isNotNull(clients.responsavelId),
          isNotNull(clients.name),
          sql`${clients.name} <> ''`,
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
          totalRegistrations: registration.completeCount,
          incompleteRegistrations:
            registration.totalCount - registration.completeCount,
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
  ): Promise<ClientRegistrationWeeklyResult[]>;
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

  // Marker Goals methods
  async getMarkerGoals(
    userId?: string,
    userRole?: string,
  ): Promise<MarkerGoal[]> {
    let query = this.db
      .select({
        id: markerGoals.id,
        userId: markerGoals.userId,
        markerName: markerGoals.markerName,
        targetQuantity: markerGoals.targetQuantity,
        month: markerGoals.month,
        year: markerGoals.year,
        createdAt: markerGoals.createdAt,
        updatedAt: markerGoals.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(markerGoals)
      .leftJoin(users, eq(markerGoals.userId, users.id));

    // Vendedores só veem suas próprias metas
    if (userRole === "vendedor" && userId) {
      query = query.where(eq(markerGoals.userId, userId)) as typeof query;
    }

    const goals = await query.orderBy(desc(markerGoals.createdAt));
    return goals as MarkerGoal[];
  }

  async getMarkerGoalsByMonthYear(
    month: number,
    year: number,
    userId?: string,
    userRole?: string,
  ): Promise<MarkerGoal[]> {
    let query = this.db
      .select({
        id: markerGoals.id,
        userId: markerGoals.userId,
        markerName: markerGoals.markerName,
        targetQuantity: markerGoals.targetQuantity,
        month: markerGoals.month,
        year: markerGoals.year,
        createdAt: markerGoals.createdAt,
        updatedAt: markerGoals.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(markerGoals)
      .leftJoin(users, eq(markerGoals.userId, users.id));

    // Aplicar filtros
    let whereConditions = and(
      eq(markerGoals.month, month),
      eq(markerGoals.year, year),
    );

    // Vendedores só veem suas próprias metas
    if (userRole === "vendedor" && userId) {
      whereConditions = and(whereConditions, eq(markerGoals.userId, userId));
    }

    const goals = await query
      .where(whereConditions)
      .orderBy(desc(markerGoals.createdAt));
    return goals as MarkerGoal[];
  }

  async createMarkerGoal(data: InsertMarkerGoal): Promise<MarkerGoal> {
    const [goal] = await this.db.insert(markerGoals).values(data).returning();
    return goal;
  }

  async updateMarkerGoal(
    id: string,
    data: Partial<InsertMarkerGoal>,
  ): Promise<MarkerGoal> {
    const [goal] = await this.db
      .update(markerGoals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(markerGoals.id, id))
      .returning();
    return goal;
  }

  async deleteMarkerGoal(id: string): Promise<boolean> {
    const result = await this.db
      .delete(markerGoals)
      .where(eq(markerGoals.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Interaction Goals CRUD operations
  async getInteractionGoals(
    userId?: string,
    userRole?: string,
  ): Promise<InteractionGoal[]> {
    let query = this.db
      .select({
        id: interactionGoals.id,
        userId: interactionGoals.userId,
        interactionType: interactionGoals.interactionType,
        targetQuantity: interactionGoals.targetQuantity,
        month: interactionGoals.month,
        year: interactionGoals.year,
        createdAt: interactionGoals.createdAt,
        updatedAt: interactionGoals.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(interactionGoals)
      .leftJoin(users, eq(interactionGoals.userId, users.id));

    // Vendedores só veem suas próprias metas
    if (userRole === "vendedor" && userId) {
      query = query.where(eq(interactionGoals.userId, userId)) as typeof query;
    }

    const goals = await query.orderBy(desc(interactionGoals.createdAt));
    return goals as InteractionGoal[];
  }

  async getInteractionGoalsByMonthYear(
    month: number,
    year: number,
    userId?: string,
    userRole?: string,
  ): Promise<InteractionGoal[]> {
    let query = this.db
      .select({
        id: interactionGoals.id,
        userId: interactionGoals.userId,
        interactionType: interactionGoals.interactionType,
        targetQuantity: interactionGoals.targetQuantity,
        month: interactionGoals.month,
        year: interactionGoals.year,
        createdAt: interactionGoals.createdAt,
        updatedAt: interactionGoals.updatedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(interactionGoals)
      .leftJoin(users, eq(interactionGoals.userId, users.id));

    // Aplicar filtros
    let whereConditions = and(
      eq(interactionGoals.month, month),
      eq(interactionGoals.year, year),
    );

    // Vendedores só veem suas próprias metas
    if (userRole === "vendedor" && userId) {
      whereConditions = and(
        whereConditions,
        eq(interactionGoals.userId, userId),
      );
    }

    const goals = await query
      .where(whereConditions)
      .orderBy(desc(interactionGoals.createdAt));
    return goals as InteractionGoal[];
  }

  async createInteractionGoal(
    data: InsertInteractionGoal,
  ): Promise<InteractionGoal> {
    const [goal] = await this.db
      .insert(interactionGoals)
      .values(data)
      .returning();
    return goal;
  }

  async updateInteractionGoal(
    id: string,
    data: Partial<InsertInteractionGoal>,
  ): Promise<InteractionGoal> {
    const [goal] = await this.db
      .update(interactionGoals)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(interactionGoals.id, id))
      .returning();
    return goal;
  }

  async deleteInteractionGoal(id: string): Promise<boolean> {
    const result = await this.db
      .delete(interactionGoals)
      .where(eq(interactionGoals.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getInteractionStatsByPeriod(
    month: number,
    year: number,
  ): Promise<
    {
      interactionType: string;
      totalInteractions: number;
      userId: string;
      userName: string;
      userEmail: string;
    }[]
  > {
    try {
      // Get all interactions in the period
      const interactionsInPeriod = await this.db
        .select({
          id: clientInteractions.id,
          type: clientInteractions.type,
          userId: clientInteractions.userId,
          createdAt: clientInteractions.createdAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(clientInteractions)
        .leftJoin(users, eq(clientInteractions.userId, users.id))
        .where(
          and(
            isNotNull(clientInteractions.userId),
            sql`extract(month from ${clientInteractions.createdAt}) = ${month}`,
            sql`extract(year from ${clientInteractions.createdAt}) = ${year}`,
          ),
        );

      // Process the results in JavaScript to count interactions per user and type
      const interactionStats: {
        [key: string]: {
          interactionType: string;
          totalInteractions: number;
          userId: string;
          userName: string;
          userEmail: string;
        };
      } = {};

      interactionsInPeriod.forEach((interaction) => {
        if (interaction.type && interaction.userId) {
          const key = `${interaction.type}-${interaction.userId}`;
          if (!interactionStats[key]) {
            interactionStats[key] = {
              interactionType: interaction.type,
              totalInteractions: 0,
              userId: interaction.userId,
              userName: interaction.userName || "",
              userEmail: interaction.userEmail || "",
            };
          }
          interactionStats[key].totalInteractions++;
        }
      });

      return Object.values(interactionStats);
    } catch (error) {
      console.error("Error getting interaction stats by period:", error);
      throw error;
    }
  }

  async getMarkerStatsByPeriod(
    month: number,
    year: number,
  ): Promise<
    {
      markerName: string;
      totalClients: number;
      userId: string;
      userName: string;
      userEmail: string;
    }[]
  > {
    try {
      // Since unnest is complex with Drizzle, get all clients with markers in the period
      // and process them in JavaScript
      const clientsWithMarkers = await this.db
        .select({
          id: clients.id,
          markers: clients.markers,
          responsavelId: clients.responsavelId,
          createdAt: clients.createdAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(clients)
        .leftJoin(users, eq(clients.responsavelId, users.id))
        .where(
          and(
            sql`array_length(${clients.markers}, 1) > 0`,
            isNotNull(clients.responsavelId),
            sql`extract(month from ${clients.createdAt}) = ${month}`,
            sql`extract(year from ${clients.createdAt}) = ${year}`,
          ),
        );

      // Process the results in JavaScript to count markers per user
      const markerStats: {
        [key: string]: {
          markerName: string;
          totalClients: number;
          userId: string;
          userName: string;
          userEmail: string;
        };
      } = {};

      clientsWithMarkers.forEach((client) => {
        if (client.markers && client.responsavelId) {
          client.markers.forEach((marker: string) => {
            const key = `${marker}-${client.responsavelId}`;
            if (!markerStats[key]) {
              markerStats[key] = {
                markerName: marker,
                totalClients: 0,
                userId: client.responsavelId || "",
                userName: client.userName || "",
                userEmail: client.userEmail || "",
              };
            }
            markerStats[key].totalClients++;
          });
        }
      });

      // Convert to array and sort
      return Object.values(markerStats).sort((a, b) => {
        if (a.markerName !== b.markerName) {
          return a.markerName.localeCompare(b.markerName);
        }
        return b.totalClients - a.totalClients;
      });
    } catch (error) {
      console.error("Erro ao buscar estatísticas de marcadores:", error);
      return [];
    }
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
        asc(trainings.createdAt),
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

  async reorderTrainings(
    trainingId: string,
    direction: "up" | "down",
    type: string,
  ) {
    // Get all trainings of the same type ordered by current position
    const allTrainings = await this.db
      .select()
      .from(trainings)
      .where(eq(trainings.type, type))
      .orderBy(
        sql`CASE WHEN ${trainings.displayOrder} IS NULL THEN 999999 ELSE ${trainings.displayOrder} END`,
        asc(trainings.createdAt),
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
    const currentIndex = allTrainings.findIndex((t) => t.id === trainingId);
    if (currentIndex === -1) return null;

    let swapIndex = -1;

    if (direction === "up" && currentIndex > 0) {
      swapIndex = currentIndex - 1;
    } else if (direction === "down" && currentIndex < allTrainings.length - 1) {
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
          responsibleName: users.name,
        },
      })
      .from(clientDebts)
      .innerJoin(clients, eq(clientDebts.clientId, clients.id))
      .leftJoin(users, eq(clients.responsavelId, users.id))
      .orderBy(clientDebts.createdAt);

    if (responsibleId) {
      return await query.where(eq(clients.responsavelId, responsibleId));
    }

    return await query;
  }

  async createClientDebt(insertDebt: InsertClientDebt): Promise<ClientDebt> {
    const [debt] = await this.db
      .insert(clientDebts)
      .values(insertDebt)
      .returning();
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
      .where(
        and(eq(deals.assignedTo, userId), ne(deals.stageId, "fechamento")),
      );

    // Buscar dívidas pendentes
    const pendingDebtsCount = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(clientDebts)
      .innerJoin(clients, eq(clientDebts.clientId, clients.id))
      .where(
        and(
          eq(clients.responsavelId, userId),
          eq(clientDebts.status, "pending"),
        ),
      );

    // Buscar dívidas vencidas
    const overdueDebtsCount = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(clientDebts)
      .innerJoin(clients, eq(clientDebts.clientId, clients.id))
      .where(
        and(
          eq(clients.responsavelId, userId),
          eq(clientDebts.status, "pending"),
          sql`${clientDebts.dueDate} < CURRENT_DATE`,
        ),
      );

    return {
      totalClients: clientsCount[0]?.count || 0,
      activeDeals: activeDealsCount[0]?.count || 0,
      pendingDebts: pendingDebtsCount[0]?.count || 0,
      overdueDebts: overdueDebtsCount[0]?.count || 0,
    };
  }

  // Sales Methods
  async getSales(): Promise<Sale[]>;
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

    return salesData.map((sale) => ({
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
      throw new Error("Data inválida fornecida");
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
        updatedAt: new Date(),
      })
      .returning();

    // Aplicar cashback existente e gerar novo cashback
    if (sale) {
      // 1. APLICAR CASHBACK EXISTENTE (apenas se useCashback for true e houver valor usado)
      if (saleData.useCashback === true && parseFloat(sale.cashbackUsed) > 0) {
        // Buscar saldo do cliente
        const clientBalance = await this.getClientCashbackBalance(
          sale.clientId,
        );
        if (clientBalance) {
          // Criar registro de uso de cashback
          await this.createCashbackUsage({
            clientId: sale.clientId,
            usedAmount: sale.cashbackUsed.toString(),
            description: `Uso de cashback na venda ${sale.id}`,
            authorizedBy: sale.userId || null,
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
          notes: `Cashback gerado pela venda ${sale.id}`,
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
        console.log("Venda não encontrada:", saleId);
        return false;
      }

      console.log("Excluindo venda:", saleId, "Cliente:", sale.clientId);

      // Reverter transações de cashback relacionadas à venda
      if (sale.cashbackUsed && parseFloat(sale.cashbackUsed) > 0) {
        console.log("Removendo uso de cashback para venda:", saleId);
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
        console.log("Removendo cashback gerado para venda:", saleId);
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
      console.log("Removendo venda do banco de dados:", saleId);
      const result = await this.db.delete(sales).where(eq(sales.id, saleId));

      console.log("Resultado da exclusão:", result);

      // Atualizar saldos de cashback do cliente se necessário
      if (
        (sale.cashbackUsed && parseFloat(sale.cashbackUsed) > 0) ||
        (sale.cashbackGenerated && parseFloat(sale.cashbackGenerated) > 0)
      ) {
        console.log("Atualizando saldo de cashback do cliente:", sale.clientId);
        await this.updateClientCashbackBalance(sale.clientId);
      }

      console.log("Venda excluída com sucesso:", saleId);
      return true;
    } catch (error) {
      console.error("Erro ao excluir venda:", error);
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

  // Get interactions for a company (through company deals and interactions)
  async getCompanyInteractions(
    companyId: string,
  ): Promise<ClientInteractionWithUser[]> {
    const results = await this.db
      .select({
        interaction: clientInteractions,
        user: users,
      })
      .from(clientInteractions)
      .innerJoin(users, eq(clientInteractions.userId, users.id))
      .where(eq(clientInteractions.companyId, companyId))
      .orderBy(desc(clientInteractions.date));

    return results.map((row) => ({
      ...row.interaction,
      user: row.user,
    }));
  }

  // Get funnels where company has deals
  async getCompanyFunnels(companyId: string): Promise<SalesFunnel[]> {
    const companyFunnels = await this.db
      .select({
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
      .where(eq(deals.companyId, companyId))
      .orderBy(salesFunnels.name);

    return companyFunnels;
  }

  // Products Methods
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

  async getProductsWithClientCount() {
    try {
      const rows = await db
        .select({
          id: products.id,
          name: products.name,
          country: products.country,
          volume: products.volume,
          type: products.type,
          negotiatedPrice: products.negotiatedPrice,
          createdBy: products.createdBy,
          createdAt: products.createdAt,
          createdByName: users.name,
        })
        .from(products)
        .leftJoin(users, eq(products.createdBy, users.id))
        .orderBy(asc(products.name));

      if (rows.length === 0) return [];

      const allIds = rows.map((p) => p.id);
      const idList = sql.join(allIds.map((id) => sql`${id}`), sql`, `);

      const buyerRows = await db.execute(sql`
        WITH all_buyers AS (
          SELECT p2.id AS product_id, bo.app_client_id
          FROM bling_order_items boi
          INNER JOIN bling_orders bo ON bo.id = boi.order_id
          INNER JOIN products p2 ON p2.bling_product_id = boi.product_id
          WHERE bo.app_client_id IS NOT NULL
            AND bo.deleted_at IS NULL
            AND p2.id IN (${idList})

          UNION

          SELECT p2.id AS product_id, co.app_client_id
          FROM connect_order_items coi
          INNER JOIN connect_orders co ON co.id = coi.order_id
          INNER JOIN products p2 ON UPPER(coi.product_name) LIKE UPPER('%' || p2.name || '%')
          WHERE co.app_client_id IS NOT NULL
            AND p2.id IN (${idList})
        )
        SELECT product_id, COUNT(DISTINCT app_client_id)::int AS cnt
        FROM all_buyers
        GROUP BY product_id
      `);

      const countMap = new Map<string, number>(
        (buyerRows.rows as any[]).map((r) => [r.product_id, r.cnt]),
      );

      return rows.map((p) => ({ ...p, clientCount: countMap.get(p.id) ?? 0 }));
    } catch (error) {
      console.error("Error fetching products with client count:", error);
      throw error;
    }
  }

  async getClientsWithProduct(productId: string) {
    try {
      const result = await db
        .select({
          clientId: clients.id,
          clientName: clients.name,
          clientRazaoSocial: clients.razaoSocial,
          clientCnpj: clients.cnpj,
          clientPhone: clients.phone,
          clientEmail: clients.email,
          clientCity: clients.city,
          clientState: clients.state,
          responsibleName: users.name,
          customPrice: companyProducts.customNegotiatedPrice,
          addedAt: companyProducts.createdAt,
          sectorName: sectors.name,
        })
        .from(companyProducts)
        .innerJoin(clients, eq(companyProducts.companyId, clients.id))
        .leftJoin(users, eq(clients.responsavelId, users.id))
        .leftJoin(sectors, eq(clients.sectorId, sectors.id))
        .where(eq(companyProducts.productId, productId))
        .orderBy(asc(clients.name));

      console.log(`Found ${result.length} clients for product ${productId}`);
      return result;
    } catch (error) {
      console.error("Error fetching clients with product:", error);
      throw error;
    }
  }

  async getCompaniesWithProduct(productId: string) {
    console.log(`Storage: Fetching companies for product ${productId}`);
    try {
      const companiesWithProduct = await this.db
        .select({
          company: companies,
          customNegotiatedPrice: companyProducts.customNegotiatedPrice,
          addedAt: companyProducts.addedAt,
          isActive: companyProducts.isActive,
        })
        .from(companyProducts)
        .innerJoin(companies, eq(companyProducts.companyId, companies.id))
        .where(eq(companyProducts.productId, productId));

      console.log(
        `Storage: Found ${companiesWithProduct.length} companies for product ${productId}`,
      );
      return companiesWithProduct;
    } catch (error) {
      console.error(
        `Storage error fetching companies for product ${productId}:`,
        error,
      );
      throw error;
    }
  }

  async getProductsStatistics(startDate?: string, endDate?: string) {
    try {
      const dateCondition =
        startDate && endDate
          ? sql`AND ${blingOrders.saleDate} >= ${startDate} AND ${blingOrders.saleDate} <= ${endDate}`
          : sql``;

      // Top products by revenue — sem filtro de data (visão histórica)
      const topProductsByRevenue = await this.db
        .select({
          productId: products.id,
          productName: products.name,
          productCountry: products.country,
          productVolume: products.volume,
          productType: products.type,
          totalRevenue: sql<string>`SUM(${blingOrderItems.quantity}::numeric * ${blingOrderItems.value}::numeric)`,
          totalQuantity: sql<number>`SUM(${blingOrderItems.quantity}::numeric)::int`,
          orderCount: sql<number>`COUNT(DISTINCT ${blingOrders.id})::int`,
        })
        .from(blingOrderItems)
        .innerJoin(blingOrders, eq(blingOrderItems.orderId, blingOrders.id))
        .innerJoin(
          products,
          eq(blingOrderItems.productId, products.blingProductId),
        )
        .where(
          and(isNull(blingOrders.deletedAt), eq(products.category, "VINHO")),
        )
        .groupBy(
          products.id,
          products.name,
          products.country,
          products.volume,
          products.type,
        )
        .orderBy(
          sql`SUM(${blingOrderItems.quantity}::numeric * ${blingOrderItems.value}::numeric) DESC`,
        )
        .limit(8);

      // Revenue by type — com filtro de data quando fornecido
      const revenueByTypeConditions =
        startDate && endDate
          ? and(
              isNull(blingOrders.deletedAt),
              eq(products.category, "VINHO"),
              sql`${blingOrders.saleDate} >= ${startDate} AND ${blingOrders.saleDate} <= ${endDate}`,
            )
          : and(isNull(blingOrders.deletedAt), eq(products.category, "VINHO"));

      const revenueByType = await this.db
        .select({
          productType: products.type,
          totalRevenue: sql<string>`SUM(${blingOrderItems.quantity}::numeric * ${blingOrderItems.value}::numeric)`,
          totalQuantity: sql<number>`SUM(${blingOrderItems.quantity}::numeric)::int`,
        })
        .from(blingOrderItems)
        .innerJoin(blingOrders, eq(blingOrderItems.orderId, blingOrders.id))
        .innerJoin(
          products,
          eq(blingOrderItems.productId, products.blingProductId),
        )
        .where(revenueByTypeConditions)
        .groupBy(products.type)
        .orderBy(
          sql`SUM(${blingOrderItems.quantity}::numeric * ${blingOrderItems.value}::numeric) DESC`,
        );

      // Quantity by product — com filtro de data quando fornecido, agrupado por produto e tipo
      const quantityByProductConditions =
        startDate && endDate
          ? and(
              isNull(blingOrders.deletedAt),
              eq(products.category, "VINHO"),
              sql`${blingOrders.saleDate} >= ${startDate} AND ${blingOrders.saleDate} <= ${endDate}`,
            )
          : and(isNull(blingOrders.deletedAt), eq(products.category, "VINHO"));

      const quantityByProduct = await this.db
        .select({
          productId: products.id,
          productName: products.name,
          productType: products.type,
          totalQuantity: sql<string>`SUM(${blingOrderItems.quantity}::numeric)`,
        })
        .from(blingOrderItems)
        .innerJoin(blingOrders, eq(blingOrderItems.orderId, blingOrders.id))
        .innerJoin(
          products,
          eq(blingOrderItems.productId, products.blingProductId),
        )
        .where(quantityByProductConditions)
        .groupBy(products.id, products.name, products.type)
        .orderBy(sql`SUM(${blingOrderItems.quantity}::numeric) DESC`);

      // Revenue by price range
      const priceRangeConditions =
        startDate && endDate
          ? and(
              isNull(blingOrders.deletedAt),
              eq(products.category, "VINHO"),
              sql`${blingOrders.saleDate} >= ${startDate} AND ${blingOrders.saleDate} <= ${endDate}`,
            )
          : and(isNull(blingOrders.deletedAt), eq(products.category, "VINHO"));

      const revenueByPriceRange = await this.db
        .select({
          priceRange: sql<string>`
            CASE
              WHEN ${blingOrderItems.value}::numeric < 100 THEN 'Até R$ 100'
              WHEN ${blingOrderItems.value}::numeric < 200 THEN 'R$ 100 a R$ 200'
              WHEN ${blingOrderItems.value}::numeric < 350 THEN 'R$ 200 a R$ 350'
              WHEN ${blingOrderItems.value}::numeric < 500 THEN 'R$ 350 a R$ 500'
              ELSE 'Acima de R$ 500'
            END
          `,
          totalRevenue: sql<string>`SUM(${blingOrderItems.quantity}::numeric * ${blingOrderItems.value}::numeric)`,
          totalQuantity: sql<number>`SUM(${blingOrderItems.quantity}::numeric)::int`,
          sortOrder: sql<number>`
            MIN(CASE
              WHEN ${blingOrderItems.value}::numeric < 100 THEN 1
              WHEN ${blingOrderItems.value}::numeric < 200 THEN 2
              WHEN ${blingOrderItems.value}::numeric < 350 THEN 3
              WHEN ${blingOrderItems.value}::numeric < 500 THEN 4
              ELSE 5
            END)
          `,
        })
        .from(blingOrderItems)
        .innerJoin(blingOrders, eq(blingOrderItems.orderId, blingOrders.id))
        .innerJoin(
          products,
          eq(blingOrderItems.productId, products.blingProductId),
        )
        .where(priceRangeConditions)
        .groupBy(sql`
          CASE
            WHEN ${blingOrderItems.value}::numeric < 100 THEN 'Até R$ 100'
            WHEN ${blingOrderItems.value}::numeric < 200 THEN 'R$ 100 a R$ 200'
            WHEN ${blingOrderItems.value}::numeric < 350 THEN 'R$ 200 a R$ 350'
            WHEN ${blingOrderItems.value}::numeric < 500 THEN 'R$ 350 a R$ 500'
            ELSE 'Acima de R$ 500'
          END
        `)
        .orderBy(sql`MIN(CASE
          WHEN ${blingOrderItems.value}::numeric < 100 THEN 1
          WHEN ${blingOrderItems.value}::numeric < 200 THEN 2
          WHEN ${blingOrderItems.value}::numeric < 350 THEN 3
          WHEN ${blingOrderItems.value}::numeric < 500 THEN 4
          ELSE 5
        END)`);

      return { topProductsByRevenue, revenueByType, quantityByProduct, revenueByPriceRange };
    } catch (error) {
      console.error("Error fetching products statistics:", error);
      throw error;
    }
  }

  async getProductById(productId: string) {
    const [result] = await this.db
      .select({
        id: products.id,
        name: products.name,
        category: products.category,
        type: products.type,
        country: products.country,
        volume: products.volume,
        negotiatedPrice: products.negotiatedPrice,
        createdBy: products.createdBy,
        createdAt: products.createdAt,
        imageUrl: products.imageUrl,
        blingProductId: products.blingProductId,
        aiProfile: products.aiProfile,
        aiProfileGeneratedAt: products.aiProfileGeneratedAt,
        createdByName: users.name,
      })
      .from(products)
      .leftJoin(users, eq(products.createdBy, users.id))
      .where(and(eq(products.id, productId), isNull(products.deletedAt)));

    if (!result) return null;

    const buyerRows = await db.execute(sql`
      SELECT COUNT(DISTINCT app_client_id)::int AS cnt FROM (
        SELECT bo.app_client_id
        FROM bling_order_items boi
        INNER JOIN bling_orders bo ON bo.id = boi.order_id
        INNER JOIN products p2 ON p2.bling_product_id = boi.product_id
        WHERE bo.app_client_id IS NOT NULL
          AND bo.deleted_at IS NULL
          AND p2.id = ${productId}

        UNION

        SELECT co.app_client_id
        FROM connect_order_items coi
        INNER JOIN connect_orders co ON co.id = coi.order_id
        INNER JOIN products p2 ON UPPER(coi.product_name) LIKE UPPER('%' || p2.name || '%')
        WHERE co.app_client_id IS NOT NULL
          AND p2.id = ${productId}
      ) _buyers
    `);

    const clientCount = (buyerRows.rows[0] as any)?.cnt ?? 0;
    return { ...result, clientCount };
  }

  async getProductAllBuyers(productId: string) {
    const rows = await db.execute(sql`
      WITH all_purchases AS (
        SELECT bo.app_client_id,
               bo.sale_date::text AS purchase_date,
               boi.quantity::numeric AS qty
        FROM bling_order_items boi
        INNER JOIN bling_orders bo ON bo.id = boi.order_id
        INNER JOIN products p ON p.bling_product_id = boi.product_id
        WHERE bo.app_client_id IS NOT NULL
          AND bo.deleted_at IS NULL
          AND p.id = ${productId}

        UNION ALL

        SELECT co.app_client_id,
               co.sale_date::date::text AS purchase_date,
               coi.quantity::numeric AS qty
        FROM connect_order_items coi
        INNER JOIN connect_orders co ON co.id = coi.order_id
        INNER JOIN products p ON UPPER(coi.product_name) LIKE UPPER('%' || p.name || '%')
        WHERE co.app_client_id IS NOT NULL
          AND p.id = ${productId}
      ),
      buyer_agg AS (
        SELECT app_client_id,
               MAX(purchase_date) AS last_purchase,
               SUM(qty)::numeric AS total_quantity
        FROM all_purchases
        GROUP BY app_client_id
      )
      SELECT c.id, c.name, c.phone, c.email, c.city, c.state,
             ba.last_purchase, ba.total_quantity
      FROM buyer_agg ba
      INNER JOIN clients c ON c.id = ba.app_client_id
      ORDER BY ba.last_purchase DESC NULLS LAST
    `);
    return rows.rows as {
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
      city: string | null;
      state: string | null;
      last_purchase: string | null;
      total_quantity: number;
    }[];
  }

  async getProductProfile(productId: string) {
    try {
      const twelveMonthsAgo = format(subMonths(new Date(), 12), "yyyy-MM-dd");
      const today = format(new Date(), "yyyy-MM-dd");

      const baseConditions = and(
        eq(products.id, productId),
        isNull(blingOrders.deletedAt),
        sql`${blingOrders.saleDate} >= ${twelveMonthsAgo}`,
        sql`${blingOrders.saleDate} <= ${today}`,
      );

      // Summary stats — duas queries separadas para garantir clareza
      // Query 1: bling (revenue + qty + orders + buyers)
      const blingSummaryRows = await db.execute(sql`
        SELECT
          COALESCE(SUM(boi.quantity::numeric * boi.value::numeric), 0)::text  AS total_revenue,
          COALESCE(SUM(boi.quantity::numeric), 0)::text                        AS total_quantity,
          COUNT(DISTINCT bo.id)::int                                            AS order_count,
          COUNT(DISTINCT bo.app_client_id)::int                                 AS buyer_count
        FROM bling_order_items boi
        INNER JOIN bling_orders bo ON bo.id = boi.order_id
        INNER JOIN products p ON p.bling_product_id = boi.product_id
        WHERE bo.deleted_at IS NULL
          AND bo.sale_date >= ${twelveMonthsAgo}
          AND bo.sale_date <= ${today}
          AND p.id = ${productId}
      `);
      const blingRow = (blingSummaryRows.rows[0] as any) ?? {};
      console.log("[profile-debug] bling summary:", JSON.stringify(blingRow));

      // Query 2: connect (revenue + qty + orders + buyers)
      const connectSummaryRows = await db.execute(sql`
        SELECT
          COALESCE(SUM(coi.quantity::numeric * coi.unit_value::numeric), 0)::text AS total_revenue,
          COALESCE(SUM(coi.quantity::numeric), 0)::text                            AS total_quantity,
          COUNT(DISTINCT co.id)::int                                               AS order_count,
          COUNT(DISTINCT co.app_client_id)::int                                    AS buyer_count
        FROM connect_order_items coi
        INNER JOIN connect_orders co ON co.id = coi.order_id
        INNER JOIN products p ON UPPER(coi.product_name) LIKE UPPER('%' || p.name || '%')
        WHERE co.sale_date::date >= ${twelveMonthsAgo}::date
          AND co.sale_date::date <= ${today}::date
          AND p.id = ${productId}
      `);
      const connectRow = (connectSummaryRows.rows[0] as any) ?? {};
      console.log("[profile-debug] connect summary:", JSON.stringify(connectRow));

      const summary = {
        totalRevenue: (
          parseFloat(blingRow.total_revenue ?? "0") +
          parseFloat(connectRow.total_revenue ?? "0")
        ).toString(),
        totalQuantity: (
          parseFloat(blingRow.total_quantity ?? "0") +
          parseFloat(connectRow.total_quantity ?? "0")
        ).toString(),
        orderCount: (blingRow.order_count ?? 0) + (connectRow.order_count ?? 0),
        buyerCount: (blingRow.buyer_count ?? 0) + (connectRow.buyer_count ?? 0),
      };

      // Month-by-month history — bling (revenue) + connect (qty) por mês
      // Agrega cada fonte ANTES do JOIN para evitar produto cartesiano
      const monthlyHistoryRows = await db.execute(sql`
        WITH bling_raw AS (
          SELECT
            TO_CHAR(TO_DATE(bo.sale_date, 'YYYY-MM-DD'), 'YYYY-MM')  AS month,
            boi.quantity::numeric                                      AS qty,
            (boi.quantity::numeric * boi.value::numeric)              AS revenue,
            bo.id::text                                               AS order_id
          FROM bling_order_items boi
          INNER JOIN bling_orders bo ON bo.id = boi.order_id
          INNER JOIN products p ON p.bling_product_id = boi.product_id
          WHERE bo.deleted_at IS NULL
            AND bo.sale_date >= ${twelveMonthsAgo}
            AND bo.sale_date <= ${today}
            AND p.id = ${productId}
        ),
        connect_raw AS (
          SELECT
            TO_CHAR(co.sale_date::date, 'YYYY-MM')              AS month,
            coi.quantity::numeric                                AS qty,
            (coi.quantity::numeric * coi.unit_value::numeric)    AS revenue,
            co.id::text                                          AS order_id
          FROM connect_order_items coi
          INNER JOIN connect_orders co ON co.id = coi.order_id
          INNER JOIN products p ON UPPER(coi.product_name) LIKE UPPER('%' || p.name || '%')
          WHERE co.sale_date::date >= ${twelveMonthsAgo}::date
            AND co.sale_date::date <= ${today}::date
            AND p.id = ${productId}
        ),
        bling_agg AS (
          SELECT month,
                 SUM(revenue)              AS revenue,
                 SUM(qty)                  AS qty,
                 COUNT(DISTINCT order_id)  AS orders
          FROM bling_raw GROUP BY month
        ),
        connect_agg AS (
          SELECT month,
                 SUM(qty)                  AS qty,
                 SUM(revenue)              AS revenue,
                 COUNT(DISTINCT order_id)  AS orders
          FROM connect_raw GROUP BY month
        ),
        all_months AS (
          SELECT month FROM bling_agg
          UNION
          SELECT month FROM connect_agg
        )
        SELECT
          m.month,
          (COALESCE(ba.revenue, 0) + COALESCE(ca.revenue, 0))::text             AS total_revenue,
          COALESCE(ba.qty + ca.qty, ba.qty, ca.qty, 0)::text                    AS total_quantity,
          (COALESCE(ba.orders, 0) + COALESCE(ca.orders, 0))::int                AS order_count
        FROM all_months m
        LEFT JOIN bling_agg   ba ON ba.month = m.month
        LEFT JOIN connect_agg ca ON ca.month = m.month
        ORDER BY m.month ASC
      `);
      const monthlyHistory = (monthlyHistoryRows.rows as any[]).map((r) => ({
        month: r.month as string,
        totalRevenue: r.total_revenue as string,
        totalQuantity: r.total_quantity as string,
        orderCount: r.order_count as number,
      }));
      console.log("[profile-debug] monthly history:", JSON.stringify(monthlyHistory));

      // Buyers
      const buyers = await this.db
        .select({
          companyId: blingOrders.contactId,
          companyName: blingOrders.contactName,
          celular: sql<
            string | null
          >`MAX(COALESCE(${blingOrders.contactCellphone}, ${clients.phone}))`,
          email: sql<string | null>`MAX(${clients.email})`,
          totalRevenue: sql<string>`SUM(${blingOrderItems.quantity}::numeric * ${blingOrderItems.value}::numeric)`,
          totalQuantity: sql<string>`SUM(${blingOrderItems.quantity}::numeric)`,
          orderCount: sql<number>`COUNT(DISTINCT ${blingOrders.id})::int`,
          lastPurchase: sql<string>`MAX(${blingOrders.saleDate})`,
        })
        .from(blingOrderItems)
        .innerJoin(blingOrders, eq(blingOrderItems.orderId, blingOrders.id))
        .innerJoin(
          products,
          eq(blingOrderItems.productId, products.blingProductId),
        )
        .leftJoin(clients, eq(blingOrders.appClientId, clients.id))
        .where(baseConditions)
        .groupBy(blingOrders.contactId, blingOrders.contactName)
        .orderBy(
          sql`SUM(${blingOrderItems.quantity}::numeric * ${blingOrderItems.value}::numeric) DESC`,
        );

      const totalRev = parseFloat(summary?.totalRevenue ?? "0");
      const totalQty = parseFloat(summary?.totalQuantity ?? "0");

      return {
        summary: {
          totalRevenue: totalRev,
          totalQuantity: totalQty,
          averagePrice: totalQty > 0 ? totalRev / totalQty : 0,
          orderCount: summary?.orderCount ?? 0,
          buyerCount: summary?.buyerCount ?? 0,
        },
        monthlyHistory,
        buyers,
      };
    } catch (error) {
      console.error("Error fetching product profile:", error);
      throw error;
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
          customNegotiatedPrice: companyProducts.customNegotiatedPrice,
          isActive: companyProducts.isActive,
          addedAt: companyProducts.addedAt,
          product: {
            id: products.id,
            name: products.name,
            country: products.country,
            volume: products.volume,
            type: products.type,
            negotiatedPrice: products.negotiatedPrice,
          },
        })
        .from(companyProducts)
        .innerJoin(products, eq(companyProducts.productId, products.id))
        .where(
          and(
            eq(companyProducts.companyId, companyId),
            eq(companyProducts.isActive, "true"),
          ),
        )
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
      .where(
        and(
          eq(companyProducts.companyId, data.companyId),
          eq(companyProducts.productId, data.productId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // Se existe mas está inativo, reativar
      if (existing[0].isActive === "false") {
        return await this.db
          .update(companyProducts)
          .set({
            isActive: "true",
            addedAt: new Date(),
            addedBy: data.addedBy,
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
      .where(
        and(
          eq(companyProducts.companyId, companyId),
          eq(companyProducts.productId, productId),
        ),
      )
      .returning();
  }

  async getAvailableProductsForCompany(companyId: string) {
    // Buscar produtos que não estão vinculados à empresa ou estão inativos
    const linkedProducts = this.db
      .select({ productId: companyProducts.productId })
      .from(companyProducts)
      .where(
        and(
          eq(companyProducts.companyId, companyId),
          eq(companyProducts.isActive, "true"),
        ),
      );

    return await this.db
      .select()
      .from(products)
      .where(notInArray(products.id, linkedProducts))
      .orderBy(asc(products.name));
  }

  async getProductCategories(): Promise<ProductCategory[]> {
    return await this.db
      .select()
      .from(productCategories)
      .orderBy(asc(productCategories.name));
  }

  async createProductCategory(
    data: InsertProductCategory,
  ): Promise<ProductCategory> {
    const [category] = await this.db
      .insert(productCategories)
      .values(data)
      .returning();
    return category;
  }

  async updateProductCategory(
    id: string,
    data: Partial<InsertProductCategory>,
  ): Promise<ProductCategory | undefined> {
    const [category] = await this.db
      .update(productCategories)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productCategories.id, id))
      .returning();
    return category || undefined;
  }

  async deleteProductCategory(id: string): Promise<boolean> {
    const result = await this.db
      .delete(productCategories)
      .where(eq(productCategories.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async updateCompanyProductPrice(
    companyId: string,
    productId: string,
    customPrice: string,
  ): Promise<CompanyProduct | null> {
    try {
      const [updated] = await this.db
        .update(companyProducts)
        .set({
          customNegotiatedPrice: customPrice,
        })
        .where(
          and(
            eq(companyProducts.companyId, companyId),
            eq(companyProducts.productId, productId),
          ),
        )
        .returning();

      return updated || null;
    } catch (error) {
      console.error("Error updating company product price:", error);
      throw error;
    }
  }

  // Events methods
  async getEvents(userId?: string, userRole?: string): Promise<Event[]>;
  async getEvents(userId?: string, userRole?: string): Promise<Event[]> {
    try {
      const baseQuery = this.db
        .select({
          id: events.id,
          name: events.name,
          description: events.description,
          imageUrl: events.imageUrl,
          eventDate: events.eventDate,
          registrationDeadline: events.registrationDeadline,
          location: events.location,
          pricePerPerson: events.pricePerPerson,
          maxCapacity: events.maxCapacity,
          category: events.category,
          status: events.status,
          notes: events.notes,
          wineRevenue: events.wineRevenue,
          slug: events.slug,
          landingPageHtmlKey: events.landingPageHtmlKey,
          createdBy: events.createdBy,
          createdAt: events.createdAt,
          updatedAt: events.updatedAt,
          creatorName: users.name,
          participantCount: sql<number>`(
            SELECT COALESCE(SUM(${eventParticipants.numberOfParticipants}), 0)::int
            FROM ${eventParticipants}
            WHERE ${eventParticipants.eventId} = ${events.id}
            AND ${eventParticipants.status} != 'cancelado'
          )`,
          paidParticipants: sql<number>`(
            SELECT COALESCE(SUM(ep.number_of_participants), 0)::int
            FROM event_participants ep
            WHERE ep.event_id = "events"."id"
            AND ep.status IN ('pago', 'pagar_na_hora')
          )`,
          eventRevenue: sql<number>`(
            SELECT COALESCE(SUM(
              CASE
                WHEN ep.custom_price IS NOT NULL THEN ep.custom_price::numeric
                ELSE ep.number_of_participants::numeric * "events"."price_per_person"::numeric
              END
            ), 0)
            FROM event_participants ep
            WHERE ep.event_id = "events"."id"
            AND ep.status IN ('pago', 'pagar_na_hora')
          )`,
          pendingParticipants: sql<number>`(
            SELECT COALESCE(SUM(ep.number_of_participants), 0)::int
            FROM event_participants ep
            WHERE ep.event_id = "events"."id"
            AND ep.status = 'pendente'
          )`,
          ausenteParticipants: sql<number>`(
            SELECT COALESCE(SUM(ep.number_of_participants), 0)::int
            FROM event_participants ep
            WHERE ep.event_id = "events"."id"
            AND ep.status = 'pagar_na_hora'
          )`,
          confirmedParticipants: sql<number>`(
            SELECT COALESCE(SUM(ep.number_of_participants), 0)::int
            FROM event_participants ep
            WHERE ep.event_id = "events"."id"
            AND ep.status IN ('pago', 'convidado', 'pagar_na_hora')
          )`,
          presentCount: sql<number>`(
            SELECT COALESCE(SUM(ep.number_of_participants), 0)::int
            FROM event_participants ep
            WHERE ep.event_id = "events"."id"
            AND ep.attended = true
          )`,
          convidadoCount: sql<number>`(
            SELECT COALESCE(SUM(ep.number_of_participants), 0)::int
            FROM event_participants ep
            WHERE ep.event_id = "events"."id"
            AND ep.status = 'convidado'
          )`,
          absentCount: sql<number>`(
            SELECT COALESCE(SUM(ep.number_of_participants), 0)::int
            FROM event_participants ep
            WHERE ep.event_id = "events"."id"
            AND ep.attended = false
          )`,
        })
        .from(events)
        .leftJoin(users, eq(events.createdBy, users.id))
        .orderBy(desc(events.eventDate));

      let eventsResult: Event[];
      // Se não for admin, filtrar apenas eventos do usuário
      if (userRole !== "admin" && userRole !== "administrador" && userId) {
        eventsResult = await baseQuery.where(eq(events.createdBy, userId));
      } else {
        eventsResult = await baseQuery;
      }

      // Para cada evento, buscar seus anexos
      const eventsWithAttachments = await Promise.all(
        eventsResult.map(async (event) => {
          const attachments = await this.getEventAttachments(event.id);
          return {
            ...event,
            attachments,
          };
        }),
      );

      return eventsWithAttachments;
    } catch (error) {
      console.error("Error fetching events:", error);
      throw error;
    }
  }

  async getEventBySlug(slug: string): Promise<Event | null> {
    try {
      const [event] = await this.db
        .select()
        .from(events)
        .where(eq(events.slug, slug))
        .limit(1);
      return event ?? null;
    } catch (error) {
      console.error("Error fetching event by slug:", error);
      throw error;
    }
  }

  async getEventById(eventId: string): Promise<Event | null> {
    try {
      const [event] = await this.db
        .select()
        .from(events)
        .where(eq(events.id, eventId))
        .limit(1);
      return event ?? null;
    } catch (error) {
      console.error("Error fetching event by id:", error);
      throw error;
    }
  }

  async createEvent(eventData: InsertEvent): Promise<Event> {
    try {
      const [newEvent] = await this.db
        .insert(events)
        .values(eventData)
        .returning();
      return newEvent;
    } catch (error) {
      console.error("Error creating event:", error);
      throw error;
    }
  }

  async updateEvent(
    eventId: string,
    eventData: Partial<InsertEvent>,
  ): Promise<Event> {
    try {
      const [updatedEvent] = await this.db
        .update(events)
        .set({ ...eventData, updatedAt: new Date() })
        .where(eq(events.id, eventId))
        .returning();
      return updatedEvent;
    } catch (error) {
      console.error("Error updating event:", error);
      throw error;
    }
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      // First, delete all participants related to the event
      await this.db
        .delete(eventParticipants)
        .where(eq(eventParticipants.eventId, eventId));

      // Then, delete all attachments related to the event
      await this.deleteEventAttachmentsByEventId(eventId);

      // Finally, delete the event itself
      const [deletedEvent] = await this.db
        .delete(events)
        .where(eq(events.id, eventId))
        .returning();
      return !!deletedEvent;
    } catch (error) {
      console.error("Error deleting event:", error);
      throw error;
    }
  }

  async updateExpiredEvents(): Promise<number> {
    try {
      // Obter a data de hoje no formato YYYY-MM-DD
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split("T")[0];

      // Atualizar eventos cuja data já passou e ainda não estão finalizados ou cancelados
      // Usando SQL raw completo para evitar problemas com conversão de timestamp
      const result = await this.db.execute(sql`
        UPDATE events
        SET status = 'finalizado', updated_at = NOW()
        WHERE DATE(event_date) < DATE(${todayStr})
          AND status NOT IN ('finalizado', 'cancelado')
        RETURNING *
      `);

      const affectedRows = result.rowCount || 0;
      console.log(
        `[Auto-Update] ${affectedRows} evento(s) atualizado(s) para "finalizado"`,
      );
      return affectedRows;
    } catch (error) {
      console.error("Error updating expired events:", error);
      throw error;
    }
  }

  async getEventParticipants(eventId: string): Promise<EventParticipant[]> {
    try {
      const results = await this.db
        .select({
          id: eventParticipants.id,
          eventId: eventParticipants.eventId,
          clientId: eventParticipants.clientId,
          registrationDate: eventParticipants.registrationDate,
          status: eventParticipants.status,
          numberOfParticipants: eventParticipants.numberOfParticipants,
          customPrice: eventParticipants.customPrice,
          notes: eventParticipants.notes,
          attended: eventParticipants.attended,
          paymentMethod: eventParticipants.paymentMethod,
          paymentDate: eventParticipants.paymentDate,
          registeredBy: eventParticipants.registeredBy,
          client: clients,
          user: users,
        })
        .from(eventParticipants)
        .leftJoin(clients, eq(eventParticipants.clientId, clients.id))
        .leftJoin(users, eq(eventParticipants.registeredBy, users.id))
        .where(eq(eventParticipants.eventId, eventId))
        .orderBy(desc(eventParticipants.registrationDate));

      return results.map((row) => ({
        id: row.id,
        eventId: row.eventId,
        clientId: row.clientId,
        registrationDate: row.registrationDate,
        status: row.status,
        numberOfParticipants: row.numberOfParticipants,
        customPrice: row.customPrice,
        notes: row.notes,
        attended: row.attended,
        registeredBy: row.registeredBy,
        clientName: row.client?.name || null,
        clientPhone: row.client?.phone || null,
        clientEmail: row.client?.email || null,
        clientBirthDate: row.client?.birthday || null,
        paymentMethod: row.paymentMethod || null,
        paymentDate: row.paymentDate || null,
        registeredByName: row.user?.name || null,
      }));
    } catch (error) {
      console.error("Error fetching event participants:", error);
      throw error;
    }
  }

  async getClientEvents(clientId: string) {
    try {
      const results = await this.db
        .select({
          participantId: eventParticipants.id,
          status: eventParticipants.status,
          attended: eventParticipants.attended,
          registrationDate: eventParticipants.registrationDate,
          numberOfParticipants: eventParticipants.numberOfParticipants,
          notes: eventParticipants.notes,
          eventId: events.id,
          eventName: events.name,
          eventDate: events.eventDate,
          eventLocation: events.location,
          eventCategory: events.category,
          eventPrice: events.pricePerPerson,
        })
        .from(eventParticipants)
        .innerJoin(events, eq(eventParticipants.eventId, events.id))
        .where(sql`${eventParticipants.clientId} = ${clientId}`)
        .orderBy(desc(events.eventDate));

      return results.map((row) => ({
        participantId: row.participantId,
        status: row.status,
        attended: row.attended,
        registrationDate: row.registrationDate,
        numberOfParticipants: row.numberOfParticipants,
        notes: row.notes,
        event: {
          id: row.eventId,
          name: row.eventName,
          eventDate: row.eventDate,
          location: row.eventLocation,
          category: row.eventCategory,
          pricePerPerson: row.eventPrice,
        },
      }));
    } catch (error) {
      console.error("Error fetching client events:", error);
      throw error;
    }
  }

  async addEventParticipant(
    participantData: InsertEventParticipant,
  ): Promise<EventParticipant> {
    try {
      // Verificar se o cliente já está inscrito no evento
      const existingParticipant = await this.db
        .select()
        .from(eventParticipants)
        .where(
          and(
            eq(eventParticipants.eventId, participantData.eventId),
            eq(eventParticipants.clientId, participantData.clientId),
          ),
        );

      if (existingParticipant.length > 0) {
        throw new Error("Cliente já está cadastrado neste evento");
      }

      // Verificar se a capacidade máxima do evento foi atingida
      const event = await this.db
        .select()
        .from(events)
        .where(eq(events.id, participantData.eventId))
        .limit(1);
      if (event && event[0]) {
        const currentParticipants = await this.db
          .select({ count: count() })
          .from(eventParticipants)
          .where(
            and(
              eq(eventParticipants.eventId, participantData.eventId),
              eq(eventParticipants.status, "convidado"),
            ),
          );

        if (
          event[0].maxCapacity &&
          currentParticipants[0].count >= event[0].maxCapacity
        ) {
          throw new Error("Capacidade máxima do evento atingida");
        }
      }

      const [newParticipant] = await this.db
        .insert(eventParticipants)
        .values(participantData)
        .returning();
      return newParticipant;
    } catch (error) {
      console.error("Error adding event participant:", error);
      throw error;
    }
  }

  async updateEventParticipant(
    participantId: string,
    participantData: Partial<InsertEventParticipant>,
  ): Promise<EventParticipant> {
    try {
      const [updatedParticipant] = await this.db
        .update(eventParticipants)
        .set(participantData)
        .where(eq(eventParticipants.id, participantId))
        .returning();
      return updatedParticipant;
    } catch (error) {
      console.error("Error updating event participant:", error);
      throw error;
    }
  }

  async getEventParticipantById(
    participantId: string,
  ): Promise<EventParticipant | null> {
    try {
      const [participant] = await this.db
        .select()
        .from(eventParticipants)
        .where(eq(eventParticipants.id, participantId))
        .limit(1);
      return participant || null;
    } catch (error) {
      console.error("Error fetching event participant:", error);
      throw error;
    }
  }

  async removeEventParticipant(participantId: string): Promise<boolean> {
    try {
      const [removedParticipant] = await this.db
        .delete(eventParticipants)
        .where(eq(eventParticipants.id, participantId))
        .returning();
      return !!removedParticipant;
    } catch (error) {
      console.error("Error removing event participant:", error);
      throw error;
    }
  }

  // Event Attachments methods
  async getEventAttachments(eventId: string): Promise<EventAttachment[]> {
    try {
      const attachments = await this.db
        .select()
        .from(eventAttachments)
        .where(eq(eventAttachments.eventId, eventId))
        .orderBy(eventAttachments.uploadedAt);
      return attachments;
    } catch (error) {
      console.error("Error fetching event attachments:", error);
      throw error;
    }
  }

  async addEventAttachment(
    attachmentData: InsertEventAttachment,
  ): Promise<EventAttachment> {
    try {
      const [newAttachment] = await this.db
        .insert(eventAttachments)
        .values(attachmentData)
        .returning();
      return newAttachment;
    } catch (error) {
      console.error("Error adding event attachment:", error);
      throw error;
    }
  }

  async deleteEventAttachment(attachmentId: string): Promise<boolean> {
    try {
      const [deletedAttachment] = await this.db
        .delete(eventAttachments)
        .where(eq(eventAttachments.id, attachmentId))
        .returning();
      return !!deletedAttachment;
    } catch (error) {
      console.error("Error deleting event attachment:", error);
      throw error;
    }
  }

  async deleteEventAttachmentsByEventId(eventId: string): Promise<boolean> {
    try {
      await this.db
        .delete(eventAttachments)
        .where(eq(eventAttachments.eventId, eventId));
      return true;
    } catch (error) {
      console.error("Error deleting event attachments by event id:", error);
      throw error;
    }
  }

  // Deal Questions Management
  async getDealQuestions(filters?: {
    category?: string;
    isActive?: boolean;
  }): Promise<DealQuestion[]> {
    try {
      let query = this.db
        .select()
        .from(dealQuestions)
        .orderBy(dealQuestions.displayOrder, dealQuestions.createdAt);

      const conditions = [];

      if (filters?.category) {
        conditions.push(eq(dealQuestions.category, filters.category));
      }

      if (filters?.isActive !== undefined) {
        conditions.push(eq(dealQuestions.isActive, filters.isActive));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      return await query;
    } catch (error) {
      console.error("Error fetching deal questions:", error);
      throw error;
    }
  }

  async createDealQuestion(data: InsertDealQuestion): Promise<DealQuestion> {
    try {
      const [question] = await this.db
        .insert(dealQuestions)
        .values(data)
        .returning();
      return question;
    } catch (error) {
      console.error("Error creating deal question:", error);
      throw error;
    }
  }

  async updateDealQuestion(
    id: string,
    data: UpdateDealQuestion,
  ): Promise<DealQuestion | null> {
    try {
      const [question] = await this.db
        .update(dealQuestions)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(dealQuestions.id, id))
        .returning();
      return question || null;
    } catch (error) {
      console.error("Error updating deal question:", error);
      throw error;
    }
  }

  async deleteDealQuestion(id: string): Promise<boolean> {
    try {
      // First delete all answers for this question
      await this.db.delete(dealAnswers).where(eq(dealAnswers.questionId, id));

      // Then delete the question
      const [deleted] = await this.db
        .delete(dealQuestions)
        .where(eq(dealQuestions.id, id))
        .returning();

      return !!deleted;
    } catch (error) {
      console.error("Error deleting deal question:", error);
      throw error;
    }
  }

  // Deal Answers Management
  async getDealAnswers(dealId: string): Promise<DealAnswerWithQuestion[]> {
    try {
      console.log("Buscando respostas para deal:", dealId);

      const results = await this.db
        .select()
        .from(dealAnswers)
        .innerJoin(dealQuestions, eq(dealAnswers.questionId, dealQuestions.id))
        .where(eq(dealAnswers.dealId, dealId))
        .orderBy(dealQuestions.displayOrder);

      // Mapear para a estrutura esperada
      const mappedResults = results.map((row) => ({
        id: row.deal_answers.id,
        dealId: row.deal_answers.dealId,
        questionId: row.deal_answers.questionId,
        answerBoolean: row.deal_answers.answerBoolean,
        answerNumber: row.deal_answers.answerNumber,
        answerText: row.deal_answers.answerText,
        createdAt: row.deal_answers.createdAt,
        updatedAt: row.deal_answers.updatedAt,
        question: {
          id: row.deal_questions.id,
          question: row.deal_questions.question,
          questionType: row.deal_questions.questionType,
          options: row.deal_questions.options,
          category: row.deal_questions.category,
          isRequired: row.deal_questions.isRequired,
          isActive: row.deal_questions.isActive,
          displayOrder: row.deal_questions.displayOrder,
          helpText: row.deal_questions.helpText,
          placeholder: row.deal_questions.placeholder,
          createdAt: row.deal_questions.createdAt,
          updatedAt: row.deal_questions.updatedAt,
        },
      }));

      console.log("Respostas encontradas:", mappedResults.length);

      // Retornar array vazio se não houver respostas
      if (!mappedResults || mappedResults.length === 0) {
        console.log("Nenhuma resposta encontrada para deal:", dealId);
        return [];
      }

      return mappedResults;
    } catch (error) {
      console.error("Error fetching deal answers:", error);
      console.error(
        "Stack trace:",
        error instanceof Error ? error.stack : error,
      );

      // Verificar se o erro é específico sobre o campo createdBy
      if (error instanceof Error && error.message.includes("createdBy")) {
        console.error("Erro relacionado ao campo createdBy que foi removido");
      }

      throw error;
    }
  }

  async saveDealAnswers(
    dealId: string,
    answers: InsertDealAnswer[],
  ): Promise<DealAnswer[]> {
    try {
      const results: DealAnswer[] = [];

      for (const answerData of answers) {
        // Check if answer already exists
        const [existingAnswer] = await this.db
          .select()
          .from(dealAnswers)
          .where(
            and(
              eq(dealAnswers.dealId, dealId),
              eq(dealAnswers.questionId, answerData.questionId),
            ),
          );

        if (existingAnswer) {
          // Update existing answer
          const [updatedAnswer] = await this.db
            .update(dealAnswers)
            .set({
              ...answerData,
              dealId,
              updatedAt: new Date(),
            })
            .where(eq(dealAnswers.id, existingAnswer.id))
            .returning();
          results.push(updatedAnswer);
        } else {
          // Create new answer
          const [newAnswer] = await this.db
            .insert(dealAnswers)
            .values({
              ...answerData,
              dealId,
            })
            .returning();
          results.push(newAnswer);
        }
      }

      return results;
    } catch (error) {
      console.error("Error saving deal answers:", error);
      throw error;
    }
  }

  async getDealWithAnswers(dealId: string): Promise<DealWithDetails | null> {
    try {
      // Get the deal with basic relations
      const [deal] = await this.db
        .select({
          deal: deals,
          client: clients,
          company: companies,
          assignedUser: {
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
          },
          stage: funnelStages,
          funnel: salesFunnels,
        })
        .from(deals)
        .leftJoin(clients, eq(deals.clientId, clients.id))
        .leftJoin(companies, eq(deals.companyId, companies.id))
        .leftJoin(users, eq(deals.assignedTo, users.id))
        .leftJoin(funnelStages, eq(deals.stageId, funnelStages.id))
        .leftJoin(salesFunnels, eq(deals.funnelId, salesFunnels.id))
        .where(eq(deals.id, dealId));

      if (!deal) {
        return null;
      }

      // Get answers for this deal
      const answers = await this.getDealAnswers(dealId);

      return {
        ...deal.deal,
        client: deal.client,
        company: deal.company,
        assignedUser: deal.assignedUser,
        stage: deal.stage,
        funnel: deal.funnel,
        answers,
      };
    } catch (error) {
      console.error("Error fetching deal with answers:", error);
      throw error;
    }
  }

  async getDealQuestionsStats(): Promise<{
    totalQuestions: number;
    activeQuestions: number;
    categoriesCount: number;
    usageStats: Array<{
      questionId: string;
      question: string;
      answeredCount: number;
      totalDeals: number;
      completionRate: number;
    }>;
  }> {
    try {
      // Get total and active questions count
      const [questionsStats] = await this.db
        .select({
          total: sql<number>`count(*)`,
          active: sql<number>`count(*) filter (where ${dealQuestions.isActive} = true)`,
          categories: sql<number>`count(distinct ${dealQuestions.category})`,
        })
        .from(dealQuestions);

      // Get usage statistics for each question
      const usageStats = await this.db
        .select({
          questionId: dealQuestions.id,
          question: dealQuestions.question,
          answeredCount: sql<number>`count(${dealAnswers.id})`,
          totalDeals: sql<number>`(select count(*) from ${deals})`,
        })
        .from(dealQuestions)
        .leftJoin(dealAnswers, eq(dealQuestions.id, dealAnswers.questionId))
        .where(eq(dealQuestions.isActive, true))
        .groupBy(dealQuestions.id, dealQuestions.question);

      const statsWithCompletionRate = usageStats.map((stat) => ({
        ...stat,
        completionRate:
          stat.totalDeals > 0
            ? Math.round((stat.answeredCount / stat.totalDeals) * 100)
            : 0,
      }));

      return {
        totalQuestions: questionsStats.total,
        activeQuestions: questionsStats.active,
        categoriesCount: questionsStats.categories,
        usageStats: statsWithCompletionRate,
      };
    } catch (error) {
      console.error("Error fetching deal questions stats:", error);
      throw error;
    }
  }

  async seedDefaultDealQuestions(): Promise<void> {
    try {
      // Check if questions already exist
      const existingQuestions = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(dealQuestions);

      if (existingQuestions[0]?.count > 0) {
        // Questions already exist, don't seed again
        return;
      }

      const defaultQuestions = [
        {
          question: "O cliente já conhece nossos vinhos?",
          questionType: "boolean" as const,
          category: "Conhecimento do Produto",
          isRequired: true,
          displayOrder: 1,
          isActive: true,
          helpText:
            "Verificar se o cliente já teve contato anterior com nossos produtos",
        },
        {
          question: "Quantos rótulos nossos tem na carta atual?",
          questionType: "number" as const,
          category: "Conhecimento do Produto",
          isRequired: true,
          displayOrder: 2,
          isActive: true,
          placeholder: "0",
          helpText: "Número de vinhos da nossa marca que o cliente já oferece",
        },
        {
          question: "Há quanto tempo é nosso cliente?",
          questionType: "select" as const,
          category: "Conhecimento do Produto",
          options: [
            "Cliente novo",
            "Menos de 6 meses",
            "6 meses a 1 ano",
            "1 a 2 anos",
            "Mais de 2 anos",
          ],
          isRequired: false,
          displayOrder: 3,
          isActive: true,
        },
        {
          question: "Tipos de vinho preferidos",
          questionType: "multiselect" as const,
          category: "Perfil de Consumo",
          options: [
            "Tinto",
            "Branco",
            "Rosé",
            "Espumante",
            "Pós-refeição",
            "Orgânicos",
          ],
          isRequired: false,
          displayOrder: 4,
          isActive: true,
          helpText:
            "Selecione todos os tipos que o cliente demonstra interesse",
        },
        {
          question: "Faixa de preço de trabalho",
          questionType: "select" as const,
          category: "Perfil de Consumo",
          options: [
            "Até R$ 50",
            "R$ 51 a R$ 100",
            "R$ 101 a R$ 200",
            "R$ 201 a R$ 300",
            "Acima de R$ 300",
          ],
          isRequired: false,
          displayOrder: 5,
          isActive: true,
        },
        {
          question: "Volume mensal estimado (garrafas)",
          questionType: "number" as const,
          category: "Perfil de Consumo",
          isRequired: false,
          displayOrder: 6,
          isActive: true,
          placeholder: "Ex: 50",
          helpText: "Estimativa de consumo mensal em garrafas",
        },
        {
          question: "Principais concorrentes atuais",
          questionType: "text" as const,
          category: "Competitividade",
          isRequired: false,
          displayOrder: 7,
          isActive: true,
          placeholder: "Ex: Marca A, Marca B...",
          helpText: "Outras marcas de vinho que o cliente trabalha",
        },
        {
          question: "Nosso diferencial percebido pelo cliente",
          questionType: "text" as const,
          category: "Competitividade",
          isRequired: false,
          displayOrder: 8,
          isActive: true,
          helpText: "O que o cliente enxerga como vantagem em nossos produtos",
        },
        {
          question: "Potencial de crescimento do cliente",
          questionType: "select" as const,
          category: "Potencial de Negócio",
          options: [
            "Baixo potencial",
            "Médio potencial de crescimento",
            "Alto potencial de crescimento",
            "Potencial excepcional",
          ],
          isRequired: false,
          displayOrder: 9,
          isActive: true,
        },
        {
          question: "Sazonalidade do negócio",
          questionType: "select" as const,
          category: "Potencial de Negócio",
          options: [
            "Constante o ano todo",
            "Maior no verão",
            "Maior no inverno",
            "Eventos específicos",
            "Fim de ano",
          ],
          isRequired: false,
          displayOrder: 10,
          isActive: true,
        },
        {
          question: "Nível de relacionamento atual",
          questionType: "select" as const,
          category: "Relacionamento",
          options: [
            "Primeiro contato",
            "Relacionamento inicial",
            "Relacionamento estabelecido",
            "Parceria consolidada",
          ],
          isRequired: false,
          displayOrder: 11,
          isActive: true,
        },
        {
          question: "Observações importantes sobre o cliente/deal",
          questionType: "text" as const,
          category: "Relacionamento",
          isRequired: false,
          displayOrder: 12,
          isActive: true,
          placeholder: "Informações adicionais relevantes...",
          helpText:
            "Qualquer informação adicional que possa ser relevante para o fechamento do deal",
        },
      ];

      // Insert default questions
      await this.db.insert(dealQuestions).values(defaultQuestions);
    } catch (error) {
      console.error("Error seeding default deal questions:", error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();
