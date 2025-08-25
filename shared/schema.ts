import { desc, sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  decimal,
  timestamp,
  integer,
  boolean,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Tabela de usuários do sistema
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["admin", "gerente", "vendedor"] })
    .notNull()
    .default("vendedor"),
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tabela de funis de vendas
export const salesFunnels = pgTable("sales_funnels", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  isActive: text("is_active").notNull().default("true"),
  createdBy: varchar("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tabela de estágios do funil
export const funnelStages = pgTable("funnel_stages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  funnelId: varchar("funnel_id")
    .references(() => salesFunnels.id)
    .notNull(),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  color: text("color").notNull().default("#6B7280"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clients = pgTable("clients", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  cpf: text("cpf"),
  email: text("email"),
  birthday: text("birthday"),
  cep: text("cep"),
  address: text("address"),
  number: text("number"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: text("state"),
  markers: text("markers").array().default([]).notNull(),
  responsavelId: varchar("responsavel_id").references(() => users.id),
  categoria: text("categoria").notNull(),
  origem: text("origem").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sectors = pgTable("sectors", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("#3B82F6"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const companies = pgTable("companies", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  nomeFantasia: text("nome_fantasia").notNull(), // Nome Fantasia (antes era name)
  razaoSocial: text("razao_social").notNull(), // Razão Social
  cnpj: text("cnpj").unique(),
  inscricaoEstadual: text("inscricao_estadual"), // Inscrição Estadual (números)
  nomeComprador: text("nome_comprador"), // Nome do Comprador
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  cep: text("cep"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  sectorId: varchar("sector_id").references(() => sectors.id), // Referência para setor
  responsavelId: varchar("responsavel_id").references(() => users.id), // Responsável pela empresa
  notes: text("notes"), // Observações
  active: boolean("active").notNull().default(true), // Status ativo/inativo como boolean
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deals = pgTable("deals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  clientId: varchar("client_id")
    .references(() => clients.id),
  companyId: varchar("company_id")
    .references(() => companies.id),
  title: text("title").notNull(),
  funnelId: varchar("funnel_id")
    .references(() => salesFunnels.id)
    .notNull(),
  stageId: varchar("stage_id")
    .references(() => funnelStages.id)
    .notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  assignedTo: varchar("assigned_to")
    .references(() => users.id)
    .notNull(),
  createdBy: varchar("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const trainings = pgTable("trainings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  duration: text("duration"),
  content: text("content"),
  category: text("category").notNull(),
  level: text("level"),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const trainingAttachments = pgTable("training_attachments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  trainingId: varchar("training_id")
    .references(() => trainings.id)
    .notNull(),
  name: text("name").notNull(),
  fileType: text("file_type").notNull(),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const trainingRelations = relations(trainings, ({ many }) => ({
  attachments: many(trainingAttachments),
}));

// Tabela de relação entre empresas e produtos (carta de vinhos)
export const companyProducts = pgTable("company_products", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  companyId: varchar("company_id")
    .references(() => companies.id, { onDelete: "cascade" })
    .notNull(),
  productId: varchar("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  customNegotiatedPrice: decimal("custom_negotiated_price", { precision: 10, scale: 2 }), // Preço negociado específico para esta empresa
  isActive: text("is_active").notNull().default("true"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  addedBy: varchar("added_by")
    .references(() => users.id)
    .notNull(),
});

// Relações entre tabelas
export const usersRelations = relations(users, ({ many }) => ({
  createdFunnels: many(salesFunnels),
  assignedDeals: many(deals, { relationName: "assignedTo" }),
  createdDeals: many(deals, { relationName: "createdBy" }),
  responsibleClients: many(clients),
}));

export const salesFunnelsRelations = relations(
  salesFunnels,
  ({ one, many }) => ({
    creator: one(users, {
      fields: [salesFunnels.createdBy],
      references: [users.id],
    }),
    stages: many(funnelStages),
    deals: many(deals),
  }),
);

export const funnelStagesRelations = relations(
  funnelStages,
  ({ one, many }) => ({
    funnel: one(salesFunnels, {
      fields: [funnelStages.funnelId],
      references: [salesFunnels.id],
    }),
    deals: many(deals),
  }),
);

export const clientsRelations = relations(clients, ({ one, many }) => ({
  deals: many(deals),
  interactions: many(clientInteractions),
  responsavel: one(users, {
    fields: [clients.responsavelId],
    references: [users.id],
  }),
}));

export const sectorsRelations = relations(sectors, ({ many }) => ({
  companies: many(companies),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  sector: one(sectors, {
    fields: [companies.sectorId],
    references: [sectors.id],
  }),
  responsavel: one(users, {
    fields: [companies.responsavelId],
    references: [users.id],
  }),
  deals: many(deals),
  companyProducts: many(companyProducts),
}));

export const companyProductsRelations = relations(companyProducts, ({ one }) => ({
  company: one(companies, {
    fields: [companyProducts.companyId],
    references: [companies.id],
  }),
  product: one(products, {
    fields: [companyProducts.productId],
    references: [products.id],
  }),
  addedByUser: one(users, {
    fields: [companyProducts.addedBy],
    references: [users.id],
  }),
}));

export const dealsRelations = relations(deals, ({ one }) => ({
  client: one(clients, {
    fields: [deals.clientId],
    references: [clients.id],
  }),
  company: one(companies, {
    fields: [deals.companyId],
    references: [companies.id],
  }),
  funnel: one(salesFunnels, {
    fields: [deals.funnelId],
    references: [salesFunnels.id],
  }),
  stage: one(funnelStages, {
    fields: [deals.stageId],
    references: [funnelStages.id],
  }),
  assignedUser: one(users, {
    fields: [deals.assignedTo],
    references: [users.id],
    relationName: "assignedTo",
  }),
  creator: one(users, {
    fields: [deals.createdBy],
    references: [users.id],
    relationName: "createdBy",
  }),
}));

// Birthday reminders table
export const birthdayReminders = pgTable("birthday_reminders", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  clientId: varchar("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  reminderDate: timestamp("reminder_date").notNull(),
  reminderType: varchar("reminder_type").notNull().default("email"), // email, notification, both
  daysBeforeBirthday: integer("days_before_birthday").notNull().default(1),
  isSent: text("is_sent").notNull().default("false"),
  sentAt: timestamp("sent_at"),
  createdBy: varchar("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Birthday reminder settings (global settings for the system)
export const birthdayReminderSettings = pgTable("birthday_reminder_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  isEnabled: text("is_enabled").notNull().default("true"),
  defaultDaysBeforeBirthday: integer("default_days_before_birthday")
    .notNull()
    .default(1),
  reminderTime: text("reminder_time").notNull().default("09:00"), // HH:MM format
  emailTemplate: text("email_template"),
  smsTemplate: text("sms_template"),
  lastProcessedDate: timestamp("last_processed_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tags system (marcadores, origens, categorias)
export const tags = pgTable("tags", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type", { enum: ["marcador", "origem", "categoria"] }).notNull(),
  color: text("color").default("#6B7280"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clientInteractions = pgTable("client_interactions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  clientId: varchar("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  type: text("type", {
    enum: [
      "call",
      "telemarketing",
      "email",
      "meeting",
      "whatsapp",
      "visit",
      "note",
      "other",
    ],
  }).notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  callResult: text("call_result", {
    enum: [
      "COM SUCESSO",
      "NÃO ATENDIDA",
      "SEM INTERESSE",
      "NÃO LIGAR MAIS",
      "EM OCUPADO",
      "OUTROS",
    ],
  }), // resultado da chamada para telemarketing/ligação
  status: text("status", { enum: ["completed", "scheduled", "cancelled"] })
    .notNull()
    .default("completed"),
  attachments: text("attachments").array().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Client Interactions relations
export const clientInteractionsRelations = relations(
  clientInteractions,
  ({ one }) => ({
    client: one(clients, {
      fields: [clientInteractions.clientId],
      references: [clients.id],
    }),
    user: one(users, {
      fields: [clientInteractions.userId],
      references: [users.id],
    }),
  }),
);

// Email Marketing Campaign tables
export const emailCampaigns = pgTable("email_campaigns", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  templateType: text("template_type", {
    enum: ["birthday", "promotion", "newsletter", "follow_up", "custom"],
  })
    .notNull()
    .default("custom"),
  status: text("status", { enum: ["draft", "scheduled", "sent", "cancelled"] })
    .notNull()
    .default("draft"),
  targetType: text("target_type", {
    enum: ["all", "category", "origin", "markers", "custom"],
  }).notNull(),
  targetCriteria: text("target_criteria"), // JSON string with filter criteria
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  totalRecipients: integer("total_recipients").default(0),
  sentCount: integer("sent_count").default(0),
  createdBy: varchar("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const emailCampaignRecipients = pgTable("email_campaign_recipients", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id")
    .references(() => emailCampaigns.id, { onDelete: "cascade" })
    .notNull(),
  clientId: varchar("client_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  status: text("status", { enum: ["pending", "sent", "failed", "bounced"] })
    .notNull()
    .default("pending"),
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tabela de metas dos usuários
export const userGoals = pgTable(
  "user_goals",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    salesGoal: decimal("sales_goal", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"), // Meta de vendas em reais
    averageTicket: decimal("average_ticket", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"), // Ticket médio em reais
    itemsPerSale: integer("items_per_sale").notNull().default(1), // Itens por venda
    month: integer("month").notNull(), // Mês da meta (1-12)
    year: integer("year").notNull(), // Ano da meta
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Constraint composta: um usuário só pode ter uma meta por mês/ano
    uniqueUserMonthYear: sql`UNIQUE (${table.userId}, ${table.month}, ${table.year})`,
  }),
);

// Tabela de resultados semanais das metas
export const weeklyResults = pgTable("weekly_results", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  goalId: varchar("goal_id")
    .references(() => userGoals.id, { onDelete: "cascade" })
    .notNull(),
  week: integer("week").notNull(), // Semana do mês (1-4)
  salesAchieved: decimal("sales_achieved", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"), // Vendas alcançadas
  ticketAchieved: decimal("ticket_achieved", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"), // Ticket médio alcançado
  itemsAchieved: integer("items_achieved").notNull().default(0), // Itens vendidos
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tabela de metas de telemarketing
export const telemarketingGoals = pgTable(
  "telemarketing_goals",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    targetResult: text("target_result", {
      enum: [
        "COM SUCESSO",
        "NÃO ATENDIDA",
        "SEM INTERESSE",
        "NÃO LIGAR MAIS",
        "EM OCUPADO",
        "OUTROS",
      ],
    }).notNull(),
    targetQuantity: integer("target_quantity").notNull(), // Quantidade de chamadas com o resultado esperado
    month: integer("month").notNull(), // Mês da meta (1-12)
    year: integer("year").notNull(), // Ano da meta
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Constraint composta: um usuário só pode ter uma meta por resultado/mês/ano
    uniqueUserResultMonthYear: sql`UNIQUE (${table.userId}, ${table.targetResult}, ${table.month}, ${table.year})`,
  }),
);

// Tabela de resultados semanais das metas de telemarketing
export const telemarketingWeeklyResults = pgTable(
  "telemarketing_weekly_results",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    telemarketingGoalId: varchar("telemarketing_goal_id")
      .references(() => telemarketingGoals.id, { onDelete: "cascade" })
      .notNull(),
    week: integer("week").notNull(), // Semana do mês (1-4)
    quantityAchieved: integer("quantity_achieved").notNull().default(0), // Quantidade de chamadas alcançadas com o resultado
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);

// Tabela de metas de cadastros de clientes
export const clientRegistrationGoals = pgTable(
  "client_registration_goals",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    targetQuantity: integer("target_quantity").notNull(), // Quantidade de clientes a cadastrar
    month: integer("month").notNull(), // Mês da meta (1-12)
    year: integer("year").notNull(), // Ano da meta
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Constraint composta: um usuário só pode ter uma meta por mês/ano
    uniqueUserMonthYear: sql`UNIQUE (${table.userId}, ${table.month}, ${table.year})`,
  }),
);

// Tabela de resultados semanais das metas de cadastros
export const clientRegistrationWeeklyResults = pgTable(
  "client_registration_weekly_results",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    registrationGoalId: varchar("registration_goal_id")
      .references(() => clientRegistrationGoals.id, { onDelete: "cascade" })
      .notNull(),
    week: integer("week").notNull(), // Semana do mês (1-4)
    quantityAchieved: integer("quantity_achieved").notNull().default(0), // Quantidade de clientes cadastrados
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);

// Birthday reminder relations
export const birthdayRemindersRelations = relations(
  birthdayReminders,
  ({ one }) => ({
    client: one(clients, {
      fields: [birthdayReminders.clientId],
      references: [clients.id],
    }),
    creator: one(users, {
      fields: [birthdayReminders.createdBy],
      references: [users.id],
    }),
  }),
);

// Schemas de inserção
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSalesFunnelSchema = createInsertSchema(salesFunnels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFunnelStageSchema = createInsertSchema(funnelStages).omit({
  id: true,
  createdAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export const insertSectorSchema = createInsertSchema(sectors).omit({
  id: true,
  createdAt: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).refine(
  (data) => {
    // Pelo menos um de clientId ou companyId deve estar presente
    return !!(data.clientId || data.companyId);
  },
  {
    message: "Cliente ou empresa é obrigatório",
    path: ["clientId"],
  }
);

export const insertBirthdayReminderSchema = createInsertSchema(
  birthdayReminders,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBirthdayReminderSettingsSchema = createInsertSchema(
  birthdayReminderSettings,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTrainingSchema = createInsertSchema(trainings).omit({
  id: true,
  createdAt: true,
});

// Category schemas (usar tags como categories) - apenas name e color do frontend
export const insertCategorySchema = insertTagSchema.omit({ type: true });

// Marker schemas (também usar tags como markers) - apenas name e color do frontend
export const insertMarkerSchema = insertTagSchema.omit({ type: true });

// Origin schemas (também usar tags como origins) - apenas name e color do frontend
export const insertOriginSchema = insertTagSchema.omit({ type: true });

export const insertClientInteractionSchema = createInsertSchema(
  clientInteractions,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailCampaignSchema = createInsertSchema(
  emailCampaigns,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailCampaignRecipientSchema = createInsertSchema(
  emailCampaignRecipients,
).omit({
  id: true,
  createdAt: true,
});

export const insertUserGoalSchema = createInsertSchema(userGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWeeklyResultSchema = createInsertSchema(weeklyResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTelemarketingGoalSchema = createInsertSchema(
  telemarketingGoals,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTelemarketingWeeklyResultSchema = createInsertSchema(
  telemarketingWeeklyResults,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClientRegistrationGoalSchema = createInsertSchema(
  clientRegistrationGoals,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTrainingAttachment = createInsertSchema(
  trainingAttachments,
).omit({
  id: true,
  createdAt: true,
});

export const insertClientRegistrationWeeklyResultSchema = createInsertSchema(
  clientRegistrationWeeklyResults,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});


export const insertCompanyProductSchema = createInsertSchema(companyProducts).omit({
  id: true,
  addedAt: true,
});

export type InsertCompanyProduct = z.infer<typeof insertCompanyProductSchema>;
export type CompanyProduct = typeof companyProducts.$inferSelect;

// Tipos
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertSalesFunnel = z.infer<typeof insertSalesFunnelSchema>;
export type SalesFunnel = typeof salesFunnels.$inferSelect;
export type InsertFunnelStage = z.infer<typeof insertFunnelStageSchema>;
export type FunnelStage = typeof funnelStages.$inferSelect;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertSector = z.infer<typeof insertSectorSchema>;
export type Sector = typeof sectors.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type InsertTraining = z.infer<typeof insertTrainingSchema>;
export type Deal = typeof deals.$inferSelect;

export interface DealWithClient extends Deal {
  client?: Client | null;
  company?: Company | null;
}
export type InsertBirthdayReminder = z.infer<
  typeof insertBirthdayReminderSchema
>;
export type BirthdayReminder = typeof birthdayReminders.$inferSelect;
export type InsertBirthdayReminderSettings = z.infer<
  typeof insertBirthdayReminderSettingsSchema
>;
export type BirthdayReminderSettings =
  typeof birthdayReminderSettings.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tags.$inferSelect;
export type InsertClientInteraction = z.infer<
  typeof insertClientInteractionSchema
>;
export type ClientInteraction = typeof clientInteractions.$inferSelect;
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;
export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type InsertEmailCampaignRecipient = z.infer<
  typeof insertEmailCampaignRecipientSchema
>;
export type EmailCampaignRecipient =
  typeof emailCampaignRecipients.$inferSelect;
export type InsertUserGoal = z.infer<typeof insertUserGoalSchema>;
export type UserGoal = typeof userGoals.$inferSelect;
export type InsertWeeklyResult = z.infer<typeof insertWeeklyResultSchema>;
export type WeeklyResult = typeof weeklyResults.$inferSelect;
export type InsertTelemarketingGoal = z.infer<
  typeof insertTelemarketingGoalSchema
>;
export type TelemarketingGoal = typeof telemarketingGoals.$inferSelect;
export type InsertTelemarketingWeeklyResult = z.infer<
  typeof insertTelemarketingWeeklyResultSchema
>;
export type TelemarketingWeeklyResult =
  typeof telemarketingWeeklyResults.$inferSelect;
export type InsertClientRegistrationGoal = z.infer<
  typeof insertClientRegistrationGoalSchema
>;
export type ClientRegistrationGoal =
  typeof clientRegistrationGoals.$inferSelect;
export type InsertClientRegistrationWeeklyResult = z.infer<
  typeof insertClientRegistrationWeeklyResultSchema
>;
export type ClientRegistrationWeeklyResult =
  typeof clientRegistrationWeeklyResults.$inferSelect;

export type InsertTrainingAttachment = z.infer<typeof insertTrainingAttachment>;
export type TrainingAttachment = typeof trainingAttachments.$inferSelect;

// Interfaces com relacionamentos
export interface DealWithClient extends Deal {
  client: Client;
}

export interface DealWithRelations extends Deal {
  client: Client;
  funnel: SalesFunnel;
  stage: FunnelStage;
  assignedUser: User;
  creator: User;
}

export interface SalesFunnelWithStages extends SalesFunnel {
  stages: FunnelStage[];
  creator: User;
}

export interface BirthdayReminderWithClient extends BirthdayReminder {
  client: Client;
  creator: User;
}

export interface ClientInteractionWithUser extends ClientInteraction {
  user: User;
}

export interface EmailCampaignWithStats extends EmailCampaign {
  creator: User;
  recipients: EmailCampaignRecipient[];
}

export interface UserWithGoals extends User {
  goals?: UserGoal;
}

export interface UserGoalWithResults extends UserGoal {
  weeklyResults: WeeklyResult[];
  userName: string;
  userEmail: string;
}
export const learningImages = pgTable("learning_images", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").default(""),
  category: text("category").notNull().default("Geral"),
  imageUrl: text("image_url").notNull(),
  fileName: text("file_name").notNull(),
  createdBy: varchar("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tabela de configurações de cashback
export const cashbackSettings = pgTable("cashback_settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Nome da regra de cashback
  description: text("description"),
  percentageRate: decimal("percentage_rate", {
    precision: 5,
    scale: 2,
  }).notNull(), // % de cashback
  minimumPurchase: decimal("minimum_purchase", {
    precision: 12,
    scale: 2,
  }).default("0.00"), // Valor mínimo para receber cashback
  maximumCashback: decimal("maximum_cashback", { precision: 12, scale: 2 }), // Valor máximo de cashback por transação
  validUntil: timestamp("valid_until"), // Data de validade da promoção
  expirationDays: integer("expiration_days").notNull().default(28), // Dias para vencimento do cashback
  isActive: text("is_active").notNull().default("true"),
  createdBy: varchar("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tabela de transações de cashback
export const cashbackTransactions = pgTable("cashback_transactions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  clientId: varchar("client_id")
    .references(() => clients.id)
    .notNull(),
  dealId: varchar("deal_id").references(() => deals.id), // Relacionado a um negócio
  purchaseAmount: decimal("purchase_amount", {
    precision: 12,
    scale: 2,
  }).notNull(), // Valor da compra
  cashbackAmount: decimal("cashback_amount", {
    precision: 12,
    scale: 2,
  }).notNull(), // Valor do cashback
  cashbackRate: decimal("cashback_rate", { precision: 5, scale: 2 }).notNull(), // % aplicada
  status: text("status", { enum: ["pending", "approved", "paid", "cancelled"] })
    .notNull()
    .default("pending"),
  settingId: varchar("setting_id").references(() => cashbackSettings.id), // Regra aplicada
  notes: text("notes"),
  invoiceNumber: text("invoice_number"), // Número da nota fiscal
  saleDate: timestamp("sale_date"), // Data da venda
  expiresAt: timestamp("expires_at").notNull(), // Data de validade do cashback (28 dias após criação)
  processedBy: varchar("processed_by").references(() => users.id),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tabela de saldo de cashback dos clientes
export const clientCashbackBalance = pgTable("client_cashback_balance", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  clientId: varchar("client_id")
    .references(() => clients.id)
    .notNull()
    .unique(),
  totalEarned: decimal("total_earned", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"), // Total ganho
  totalUsed: decimal("total_used", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"), // Total utilizado
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"), // Saldo atual
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

// Tabela de uso de cashback (quando cliente usa o saldo)
export const cashbackUsage = pgTable("cashback_usage", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  clientId: varchar("client_id")
    .references(() => clients.id)
    .notNull(),
  dealId: varchar("deal_id").references(() => deals.id), // Negócio onde foi usado
  usedAmount: decimal("used_amount", { precision: 12, scale: 2 }).notNull(), // Valor usado
  description: text("description").notNull(), // Descrição do uso
  authorizedBy: varchar("authorized_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLearningImageSchema = createInsertSchema(learningImages);
export const insertCashbackSettingSchema = createInsertSchema(cashbackSettings)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    validUntil: z
      .union([
        z.string().transform((str) => (str === "" ? null : new Date(str))),
        z.date(),
        z.null(),
      ])
      .optional()
      .nullable(),
    expirationDays: z
      .union([z.number(), z.string().transform((str) => parseInt(str))])
      .default(28),
  });
export const insertCashbackTransactionSchema = z.object({
  clientId: z.string(),
  dealId: z.string().optional(),
  purchaseAmount: z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === "string" ? val : val.toString())),
  cashbackAmount: z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === "string" ? val : val.toString())),
  cashbackRate: z
    .union([z.string(), z.number()])
    .transform((val) => (typeof val === "string" ? val : val.toString())),
  status: z
    .enum(["pending", "approved", "paid", "cancelled"])
    .default("pending"),
  settingId: z.string().optional(),
  notes: z.string().optional(),
  invoiceNumber: z.string().optional(),
  saleDate: z
    .union([z.date(), z.string().transform((str) => new Date(str)), z.null()])
    .optional(),
  expiresAt: z.union([z.date(), z.string().transform((str) => new Date(str))]),
  processedBy: z.string().optional(),
  processedAt: z
    .union([z.date(), z.string().transform((str) => new Date(str)), z.null()])
    .optional(),
});
export const insertClientCashbackBalanceSchema = createInsertSchema(
  clientCashbackBalance,
).omit({
  id: true,
});
export const insertCashbackUsageSchema = createInsertSchema(cashbackUsage).omit(
  {
    id: true,
    createdAt: true,
  },
);

export type LearningImage = typeof learningImages.$inferSelect;
export type InsertLearningImage = z.infer<typeof insertLearningImageSchema>;
export type CashbackSetting = typeof cashbackSettings.$inferSelect;
export type InsertCashbackSetting = z.infer<typeof insertCashbackSettingSchema>;
export type CashbackTransaction = typeof cashbackTransactions.$inferSelect;
export type InsertCashbackTransaction = z.infer<
  typeof insertCashbackTransactionSchema
>;
export type ClientCashbackBalance = typeof clientCashbackBalance.$inferSelect;
export type InsertClientCashbackBalance = z.infer<
  typeof insertClientCashbackBalanceSchema
>;
export type CashbackUsage = typeof cashbackUsage.$inferSelect;
export type InsertCashbackUsage = z.infer<typeof insertCashbackUsageSchema>;

// Interfaces com relacionamentos para cashback
export interface CashbackTransactionWithClient extends CashbackTransaction {
  client: Client;
  deal?: Deal;
  setting?: CashbackSetting;
  processedByUser?: User;
}

export const createTrainingSchema = z.object({
  title: z.string().min(1, { message: "Título é obrigatório" }),
  description: z.string().min(1, { message: "Descrição é obrigatória" }),
  category: z.string().min(1, { message: "Categoria é obrigatória" }),
  level: z.string().optional(),
  type: z.string(),
  videoUrl: z.string().min(1, { message: "Url do vídeo é obrigatória" }),
});

export type CreateTrainingData = z.infer<typeof createTrainingSchema>;

export const createDocumentTrainingSchema = z.object({
  title: z.string().min(1, { message: "Título é obrigatório" }),
  description: z.string().min(1, { message: "Descrição é obrigatória" }),
  category: z.string().min(1, { message: "Categoria é obrigatória" }),
  documentUrl: z.string().min(1, { message: "Url do documento é obrigatória" }),
  documentType: z
    .string()
    .min(1, { message: "Tipo do documento é obrigatório" }),
});

export const updateDocumentTrainingSchema = z.object({
  title: z.string().min(1, { message: "Título é obrigatório" }),
  description: z.string().min(1, { message: "Descrição é obrigatória" }),
  category: z.string().min(1, { message: "Categoria é obrigatória" }),
});

export const createScriptSchema = z.object({
  title: z.string().min(1, { message: "Título é obrigatório" }),
  description: z.string().min(1, { message: "Descrição é obrigatória" }),
  category: z.string().min(1, { message: "Categoria é obrigatória" }),
  content: z.string().min(1, { message: "Conteúdo é obrigatório" }),
});

export type CreateScriptData = z.infer<typeof createScriptSchema>;

export type UpdateDocumentTraining = z.infer<
  typeof updateDocumentTrainingSchema
>;

export type CreateDocumentTrainingData = z.infer<
  typeof createDocumentTrainingSchema
>;

export interface ClientCashbackBalanceWithClient extends ClientCashbackBalance {
  client: Client;
  responsibleUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  firstCashbackDate?: Date | null;
  nextExpiryDate?: Date | null;
}

// Client Debts Table
export const clientDebts = pgTable("client_debts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  clientId: varchar("client_id")
    .notNull()
    .references(() => clients.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: text("status", { enum: ["pending", "paid", "overdue"] })
    .notNull()
    .default("pending"), // pending, paid, overdue
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: varchar("created_by")
    .notNull()
    .references(() => users.id),
});

export type ClientDebt = typeof clientDebts.$inferSelect;
export type InsertClientDebt = typeof clientDebts.$inferInsert;

// Schema para inserção de client debts
export const insertClientDebtSchema = createInsertSchema(clientDebts).omit({
  id: true,
  createdAt: true,
});

export const sales = pgTable('sales', {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  clientId: varchar("client_id")
    .references(() => clients.id)
    .notNull(),
  date: timestamp("date").notNull(),
  grossValue: decimal("gross_value", { precision: 12, scale: 2 }).notNull(),
  cashbackUsed: decimal("cashback_used", { precision: 12, scale: 2 }).notNull().default("0.00"),
  netValue: decimal("net_value", { precision: 12, scale: 2 }).notNull(),
  cashbackGenerated: decimal("cashback_generated", { precision: 12, scale: 2 }).notNull().default("0.00"),
  notes: text("notes"),
  invoiceNumber: varchar("invoice_number", { length: 50 }),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  country: text("country", { 
    enum: ["CHILE", "ARGENTINA", "URUGUAI", "BRASIL", "EUA", "FRANÇA", "ITÁLIA", "PORTUGAL", "ESPANHA", "ALEMANHA", "OUTROS"] 
  }).notNull(),
  volume: text("volume", { 
    enum: ["187ml", "375ml", "750ml", "1500ml"] 
  }).notNull(),
  type: text("type", { 
    enum: ["ESPUMANTE", "BRANCO", "ROSE", "TINTO", "PÓS-REFEIÇÃO"] 
  }).notNull(),
  negotiatedPrice: decimal("negotiated_price", { precision: 10, scale: 2 }).notNull(),
  createdBy: varchar("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSaleSchema = createInsertSchema(sales).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;