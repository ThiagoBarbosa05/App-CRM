import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Tabela de usuários do sistema
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["admin", "gerente", "vendedor"] }).notNull().default("vendedor"),
  isActive: text("is_active").notNull().default("true"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tabela de funis de vendas
export const salesFunnels = pgTable("sales_funnels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  isActive: text("is_active").notNull().default("true"),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tabela de estágios do funil
export const funnelStages = pgTable("funnel_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  funnelId: varchar("funnel_id").references(() => salesFunnels.id).notNull(),
  name: text("name").notNull(),
  order: integer("order").notNull(),
  color: text("color").notNull().default("#6B7280"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  color: text("color").notNull().default("#3B82F6"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  clientId: varchar("client_id").references(() => clients.id).notNull(),
  funnelId: varchar("funnel_id").references(() => salesFunnels.id).notNull(),
  stageId: varchar("stage_id").references(() => funnelStages.id).notNull(),
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  assignedTo: varchar("assigned_to").references(() => users.id).notNull(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relações entre tabelas
export const usersRelations = relations(users, ({ many }) => ({
  createdFunnels: many(salesFunnels),
  assignedDeals: many(deals, { relationName: "assignedTo" }),
  createdDeals: many(deals, { relationName: "createdBy" }),
  responsibleClients: many(clients),
}));

export const salesFunnelsRelations = relations(salesFunnels, ({ one, many }) => ({
  creator: one(users, {
    fields: [salesFunnels.createdBy],
    references: [users.id],
  }),
  stages: many(funnelStages),
  deals: many(deals),
}));

export const funnelStagesRelations = relations(funnelStages, ({ one, many }) => ({
  funnel: one(salesFunnels, {
    fields: [funnelStages.funnelId],
    references: [salesFunnels.id],
  }),
  deals: many(deals),
}));

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
}));

export const dealsRelations = relations(deals, ({ one }) => ({
  client: one(clients, {
    fields: [deals.clientId],
    references: [clients.id],
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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  reminderDate: timestamp("reminder_date").notNull(),
  reminderType: varchar("reminder_type").notNull().default("email"), // email, notification, both
  daysBeforeBirthday: integer("days_before_birthday").notNull().default(1),
  isSent: varchar("is_sent").notNull().default("false"),
  sentAt: timestamp("sent_at"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Birthday reminder settings (global settings for the system)
export const birthdayReminderSettings = pgTable("birthday_reminder_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  isEnabled: varchar("is_enabled").notNull().default("true"),
  defaultDaysBeforeBirthday: integer("default_days_before_birthday").notNull().default(1),
  reminderTime: varchar("reminder_time").notNull().default("09:00"), // HH:MM format
  emailTemplate: text("email_template"),
  smsTemplate: text("sms_template"),
  lastProcessedDate: timestamp("last_processed_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tags system (marcadores, origens, categorias)
export const tags = pgTable("tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type", { enum: ["marcador", "origem", "categoria"] }).notNull(),
  color: text("color").default("#6B7280"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const clientInteractions = pgTable("client_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type", { enum: ["call", "email", "meeting", "whatsapp", "note", "visit", "other"] }).notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  duration: integer("duration"), // em minutos, opcional para calls/meetings
  status: text("status", { enum: ["completed", "scheduled", "cancelled"] }).notNull().default("completed"),
  attachments: text("attachments").array().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Client Interactions relations
export const clientInteractionsRelations = relations(clientInteractions, ({ one }) => ({
  client: one(clients, {
    fields: [clientInteractions.clientId],
    references: [clients.id],
  }),
  user: one(users, {
    fields: [clientInteractions.userId],
    references: [users.id],
  }),
}));

// Email Marketing Campaign tables
export const emailCampaigns = pgTable("email_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  content: text("content").notNull(),
  templateType: text("template_type", { enum: ["birthday", "promotion", "newsletter", "follow_up", "custom"] }).notNull().default("custom"),
  status: text("status", { enum: ["draft", "scheduled", "sent", "cancelled"] }).notNull().default("draft"),
  targetType: text("target_type", { enum: ["all", "category", "origin", "markers", "custom"] }).notNull(),
  targetCriteria: text("target_criteria"), // JSON string with filter criteria
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  totalRecipients: integer("total_recipients").default(0),
  sentCount: integer("sent_count").default(0),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const emailCampaignRecipients = pgTable("email_campaign_recipients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => emailCampaigns.id, { onDelete: "cascade" }).notNull(),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "cascade" }).notNull(),
  status: text("status", { enum: ["pending", "sent", "failed", "bounced"] }).notNull().default("pending"),
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Birthday reminder relations
export const birthdayRemindersRelations = relations(birthdayReminders, ({ one }) => ({
  client: one(clients, {
    fields: [birthdayReminders.clientId],
    references: [clients.id],
  }),
  creator: one(users, {
    fields: [birthdayReminders.createdBy],
    references: [users.id],
  }),
}));

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
});

export const insertBirthdayReminderSchema = createInsertSchema(birthdayReminders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBirthdayReminderSettingsSchema = createInsertSchema(birthdayReminderSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTagSchema = createInsertSchema(tags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Category schemas (usar tags como categories)
export const insertCategorySchema = insertTagSchema;

// Marker schemas (também usar tags como markers)
export const insertMarkerSchema = insertTagSchema;

// Origin schemas (também usar tags como origins)
export const insertOriginSchema = insertTagSchema;

export const insertClientInteractionSchema = createInsertSchema(clientInteractions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailCampaignRecipientSchema = createInsertSchema(emailCampaignRecipients).omit({
  id: true,
  createdAt: true,
});

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
export type Deal = typeof deals.$inferSelect;
export type InsertBirthdayReminder = z.infer<typeof insertBirthdayReminderSchema>;
export type BirthdayReminder = typeof birthdayReminders.$inferSelect;
export type InsertBirthdayReminderSettings = z.infer<typeof insertBirthdayReminderSettingsSchema>;
export type BirthdayReminderSettings = typeof birthdayReminderSettings.$inferSelect;
export type InsertTag = z.infer<typeof insertTagSchema>;
export type Tag = typeof tags.$inferSelect;
export type InsertClientInteraction = z.infer<typeof insertClientInteractionSchema>;
export type ClientInteraction = typeof clientInteractions.$inferSelect;
export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;
export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type InsertEmailCampaignRecipient = z.infer<typeof insertEmailCampaignRecipientSchema>;
export type EmailCampaignRecipient = typeof emailCampaignRecipients.$inferSelect;

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