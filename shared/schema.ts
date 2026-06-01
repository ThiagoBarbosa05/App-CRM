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
  numeric,
  index,
  check,
  unique,
  uniqueIndex,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const sessions = pgTable("sessions", {
  sid: varchar("sid").primaryKey(),
  sess: jsonb("sess").notNull(),
  expire: timestamp("expire").notNull(),
});

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
  blingVendedorId: text("bling_vendedor_id"),
  blingVendedorName: text("bling_vendedor_name"),
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
  phone: text("phone").unique(),
  fixedPhone: text("fixed_phone"),
  cpf: text("cpf").unique(),
  email: text("email").unique(),
  birthday: text("birthday"),
  cep: text("cep"),
  address: text("address"),
  number: text("number"),
  complement: text("complement"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: text("state"),
  markers: text("markers").array().default([]).notNull(),
  responsavelId: varchar("responsavel_id").references(() => users.id),
  categoria: text("categoria").notNull(),
  origem: text("origem").notNull(),
  confirmationCode: text("confirmation_code"),
  status: text("status", { enum: ["pending", "confirmed"] })
    .notNull()
    .default("pending"),
  confirmationCodeSentAt: timestamp("confirmation_code_sent_at"),
  umblerContactId: text("umbler_contact_id"),
  blingContactId: text("bling_contact_id"),
  documentType: text("document_type", { enum: ["cpf", "cnpj"] }).default("cpf"),
  nomeFantasia: text("nome_fantasia"),
  inscricaoEstadual: text("inscricao_estadual"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  wineProfile: jsonb("wine_profile"),
  wineProfileGeneratedAt: timestamp("wine_profile_generated_at"),
  referralBenefit1At: timestamp("referral_benefit1_at"),
  referralBenefit2At: timestamp("referral_benefit2_at"),
  rfmRecency: integer("rfm_recency"),
  rfmFrequency: integer("rfm_frequency"),
  rfmMonetary: integer("rfm_monetary"),
  rfmSegment: text("rfm_segment"),
  rfmCalculatedAt: timestamp("rfm_calculated_at"),
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
  fixedPhone: text("fixed_phone"),
  email: text("email"),
  website: text("website"),
  cep: text("cep"),
  address: text("address"),
  neighborhood: text("neighborhood"), // Bairro
  city: text("city"),
  state: text("state"),
  markers: text("markers").array().default([]).notNull(),
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
  clientId: varchar("client_id").references(() => clients.id),
  companyId: varchar("company_id").references(() => companies.id),
  title: text("title"),
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

// Tabela de configurações de perguntas para deals
export const dealQuestions = pgTable(
  "deal_questions",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    question: text("question").notNull(), // Texto da pergunta
    questionType: text("question_type", {
      enum: ["boolean", "number", "text", "select", "multiselect"],
    }).notNull(), // Tipo de resposta esperada
    options: text("options").array().default([]), // Opções para select/multiselect
    isRequired: boolean("is_required").notNull().default(false), // Se a pergunta é obrigatória
    isActive: boolean("is_active").notNull().default(true), // Se a pergunta está ativa
    helpText: text("help_text"), // Texto de ajuda/descrição
    placeholder: text("placeholder"), // Texto placeholder para inputs
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Adicionar constraint para garantir que perguntas select/multiselect tenham opções
    check(
      "deal_questions_options_check",
      sql`
      (${table.questionType} IN ('select', 'multiselect') AND array_length(${table.options}, 1) > 0) 
      OR 
      (${table.questionType} NOT IN ('select', 'multiselect'))
    `,
    ),
    // Index para queries por status ativo
    index("deal_questions_active_idx").on(table.isActive),
  ],
);

// Tabela de respostas das perguntas dos deals
export const dealAnswers = pgTable(
  "deal_answers",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    dealId: varchar("deal_id")
      .references(() => deals.id, { onDelete: "cascade" })
      .notNull(),
    questionId: varchar("question_id")
      .references(() => dealQuestions.id, { onDelete: "cascade" })
      .notNull(),
    // Removido campo 'answer' genérico - usar campos tipados específicos
    answerBoolean: boolean("answer_boolean"), // Para questionType = 'boolean'
    answerNumber: decimal("answer_number", { precision: 15, scale: 2 }), // Para questionType = 'number'
    answerText: text("answer_text"), // Para questionType = 'text', 'select', 'multiselect'
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Constraint para garantir uma resposta única por pergunta por deal
    unique("deal_answers_unique_deal_question").on(
      table.dealId,
      table.questionId,
    ),
    // Constraint para garantir que apenas um campo de resposta esteja preenchido
    check(
      "deal_answers_single_answer_check",
      sql`
      (${table.answerBoolean} IS NOT NULL)::int + 
      (${table.answerNumber} IS NOT NULL)::int + 
      (${table.answerText} IS NOT NULL)::int = 1
    `,
    ),
    // Index para melhorar performance de queries por deal
    index("deal_answers_deal_id_idx").on(table.dealId),
  ],
);

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
  customNegotiatedPrice: decimal("custom_negotiated_price", {
    precision: 10,
    scale: 2,
  }), // Preço negociado específico para esta empresa
  isActive: text("is_active").notNull().default("true"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  addedBy: varchar("added_by")
    .references(() => users.id)
    .notNull(),
});

export const serviceChannels = pgTable("service_channels", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phoneNumber: text("phone_number"),
});

export const userServiceChannel = pgTable("user_service_channel", {
  id: text("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  serviceChannelId: text("service_channel_id").references(
    () => serviceChannels.id,
  ),
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

export const companyProductsRelations = relations(
  companyProducts,
  ({ one }) => ({
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
  }),
);

export const dealsRelations = relations(deals, ({ one, many }) => ({
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
  answers: many(dealAnswers),
}));

// Relações para as perguntas dos deals
export const dealQuestionsRelations = relations(
  dealQuestions,
  ({ one, many }) => ({
    answers: many(dealAnswers),
  }),
);

// Relações para as respostas dos deals
export const dealAnswersRelations = relations(dealAnswers, ({ one }) => ({
  deal: one(deals, {
    fields: [dealAnswers.dealId],
    references: [deals.id],
  }),
  question: one(dealQuestions, {
    fields: [dealAnswers.questionId],
    references: [dealQuestions.id],
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

export const externalTags = pgTable("external_tags", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  externalId: varchar("external_id"),
  externalTagName: text("external_tag_name"),
});

export const clientTags = pgTable("client_tags", {
  externalTagId: varchar("external_tag_id"),
  clientId: varchar("client_id"),
});

export const clientTagRelations = relations(clientTags, ({ one }) => ({
  externalTag: one(externalTags, {
    fields: [clientTags.externalTagId],
    references: [externalTags.id],
  }),
  client: one(clients, {
    fields: [clientTags.clientId],
    references: [clients.id],
  }),
}));

// Tabela de snapshot de sincronização Umbler → CRM
export const umblerContactSnapshot = pgTable(
  "umbler_contact_snapshot",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    crmClientId: varchar("crm_client_id")
      .notNull()
      .unique()
      .references(() => clients.id, { onDelete: "cascade" }),
    phoneE164: text("phone_e164").notNull(),
    umblerContactId: text("umbler_contact_id"),
    tagsHash: text("tags_hash"),
    tagsJson: text("tags_json"), // JSON stringified das tags
    lastSyncedAt: timestamp("last_synced_at"),
    lastCheckedAt: timestamp("last_checked_at").defaultNow().notNull(),
    notFoundAt: timestamp("not_found_at"),
    syncStatus: text("sync_status", {
      enum: ["pending", "synced", "not_found", "error"],
    })
      .notNull()
      .default("pending"),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("umbler_snapshot_client_idx").on(table.crmClientId),
    index("umbler_snapshot_phone_idx").on(table.phoneE164),
    index("umbler_snapshot_last_checked_idx").on(table.lastCheckedAt),
    index("umbler_snapshot_not_found_idx").on(table.notFoundAt),
    index("umbler_snapshot_status_idx").on(table.syncStatus),
  ],
);

export const clientInteractions = pgTable("client_interactions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id, {
    onDelete: "cascade",
  }),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  companyId: varchar("company_id").references(() => companies.id),
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
  latitude: numeric("latitude", { precision: 10, scale: 8 }),
  longitude: numeric("longitude", { precision: 11, scale: 8 }),
  address: text("address"),
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
    company: one(companies, {
      fields: [clientInteractions.companyId],
      references: [companies.id],
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
    itemsPerSale: decimal("items_per_sale", { precision: 5, scale: 2 })
      .notNull()
      .default("1.00"), // Itens por venda
    ordersGoal: integer("orders_goal").notNull().default(0), // Meta: total de GRFs no mês
    avgBottleValueGoal: decimal("avg_bottle_value_goal", {
      precision: 12,
      scale: 2,
    })
      .notNull()
      .default("0.00"), // Meta: valor médio por garrafa vendida
    positivityGoal: integer("positivity_goal").notNull().default(0), // Meta: clientes únicos com compra no mês (positivação)
    economicoGoalQty: integer("economico_goal_qty").notNull().default(0),
    intermediarioGoalQty: integer("intermediario_goal_qty")
      .notNull()
      .default(0),
    premiumGoalQty: integer("premium_goal_qty").notNull().default(0),
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

// Tabela de resultados semanais das metas.
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
  totalGrfsMonth: integer("total_grfs_month").notNull().default(0), // Total de GRFs no mês
  avgGrfValue: decimal("avg_grf_value", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"), // Valor médio de GRFs
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

// Tabela de metas de marcadores de clientes
export const markerGoals = pgTable(
  "marker_goals",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    markerName: text("marker_name").notNull(), // Nome do marcador alvo
    targetQuantity: integer("target_quantity").notNull(), // Quantidade de clientes com este marcador
    month: integer("month").notNull(), // Mês da meta (1-12)
    year: integer("year").notNull(), // Ano da meta
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Constraint composta: um usuário só pode ter uma meta por marcador/mês/ano
    uniqueUserMarkerMonthYear: sql`UNIQUE (${table.userId}, ${table.markerName}, ${table.month}, ${table.year})`,
  }),
);

// Tabela de resultados semanais das metas de marcadores
export const markerWeeklyResults = pgTable("marker_weekly_results", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  markerGoalId: varchar("marker_goal_id")
    .references(() => markerGoals.id, { onDelete: "cascade" })
    .notNull(),
  week: integer("week").notNull(), // Semana do mês (1-4)
  quantityAchieved: integer("quantity_achieved").notNull().default(0), // Quantidade de clientes com o marcador
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tabela de metas de interações com clientes
export const interactionGoals = pgTable(
  "interaction_goals",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    interactionType: text("interaction_type").notNull(), // Tipo de interação (telemarketing, email, meeting, whatsapp, visit, note, other)
    targetQuantity: integer("target_quantity").notNull(), // Quantidade de interações alvo
    month: integer("month").notNull(), // Mês da meta (1-12)
    year: integer("year").notNull(), // Ano da meta
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    // Constraint composta: um usuário só pode ter uma meta por tipo de interação/mês/ano
    uniqueUserInteractionMonthYear: sql`UNIQUE (${table.userId}, ${table.interactionType}, ${table.month}, ${table.year})`,
  }),
);

// Tabela de resultados semanais das metas de interações
export const interactionWeeklyResults = pgTable("interaction_weekly_results", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  interactionGoalId: varchar("interaction_goal_id")
    .references(() => interactionGoals.id, { onDelete: "cascade" })
    .notNull(),
  week: integer("week").notNull(), // Semana do mês (1-4)
  quantityAchieved: integer("quantity_achieved").notNull().default(0), // Quantidade de interações realizadas
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tabela de indicações (programa de referral)
export const referrals = pgTable("referrals", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  referrerId: varchar("referrer_id")
    .references(() => clients.id, { onDelete: "cascade" })
    .notNull(),
  referredName: text("referred_name").notNull(),
  referredPhone: text("referred_phone").notNull(),
  referredClientId: varchar("referred_client_id").references(
    () => clients.id,
    { onDelete: "set null" },
  ),
  messageSent: boolean("message_sent").notNull().default(false),
  hasPurchased: boolean("has_purchased").notNull().default(false),
  purchasedAt: timestamp("purchased_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertReferralSchema = createInsertSchema(referrals).omit({
  id: true,
  createdAt: true,
  hasPurchased: true,
  purchasedAt: true,
  messageSent: true,
});

export type InsertReferral = z.infer<typeof insertReferralSchema>;
export type Referral = typeof referrals.$inferSelect;

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

export const insertClientSchema = createInsertSchema(clients)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    externalTagIds: z.array(z.string()).optional(), // IDs das tags externas do Umbler
  })
  .refine(
    (data) => {
      // Se birthday foi informado, validar maioridade
      if (!data.birthday) return true;

      let birthDate: Date;

      // Formato ISO (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(data.birthday)) {
        birthDate = new Date(data.birthday);
      }
      // Formato brasileiro (DD/MM/YYYY)
      else if (/^\d{2}\/\d{2}\/\d{4}$/.test(data.birthday)) {
        const [day, month, year] = data.birthday.split("/");
        birthDate = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
        );
      } else {
        return false; // Formato inválido
      }

      if (isNaN(birthDate.getTime())) return false;

      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const dayDiff = today.getDate() - birthDate.getDate();

      // Verifica se já fez 18 anos
      if (age > 18) return true;
      if (age === 18) {
        if (monthDiff > 0) return true;
        if (monthDiff === 0 && dayDiff >= 0) return true;
      }

      return false;
    },
    {
      message: "Cliente deve ser maior de idade (18 anos ou mais)",
      path: ["birthday"],
    },
  );

// Schema para atualização de clientes (partial, sem validação de maioridade para não bloquear atualizações)
export const updateClientSchema = createInsertSchema(clients)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    externalTagIds: z.array(z.string()).optional(), // IDs das tags externas do Umbler
  })
  .partial()
  .refine(
    (data) => {
      // Se birthday foi informado na atualização, validar maioridade
      if (!data.birthday) return true;

      let birthDate: Date;

      // Formato ISO (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(data.birthday)) {
        birthDate = new Date(data.birthday);
      }
      // Formato brasileiro (DD/MM/YYYY)
      else if (/^\d{2}\/\d{2}\/\d{4}$/.test(data.birthday)) {
        const [day, month, year] = data.birthday.split("/");
        birthDate = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
        );
      } else {
        return false; // Formato inválido
      }

      if (isNaN(birthDate.getTime())) return false;

      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      const dayDiff = today.getDate() - birthDate.getDate();

      // Verifica se já fez 18 anos
      if (age > 18) return true;
      if (age === 18) {
        if (monthDiff > 0) return true;
        if (monthDiff === 0 && dayDiff >= 0) return true;
      }

      return false;
    },
    {
      message: "Cliente deve ser maior de idade (18 anos ou mais)",
      path: ["birthday"],
    },
  );

export const insertSectorSchema = createInsertSchema(sectors).omit({
  id: true,
  createdAt: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDealSchema = createInsertSchema(deals)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    title: z.string().optional(),
  })
  .refine(
    (data) => {
      // Pelo menos um de clientId ou companyId deve estar presente
      return !!(data.clientId || data.companyId);
    },
    {
      message: "Cliente ou empresa é obrigatório",
      path: ["clientId"],
    },
  );

// Schema para atualizações - sem validação restritiva
export const updateDealSchema = createInsertSchema(deals)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    title: z.string().optional(),
  })
  .partial();

// Schemas para perguntas dos deals
const baseDealQuestionSchema = createInsertSchema(dealQuestions)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    question: z.string().min(5, "Pergunta deve ter pelo menos 5 caracteres"),
    options: z.array(z.string()).default([]),
  });

export const insertDealQuestionSchema = baseDealQuestionSchema.refine(
  (data) => {
    // Se for select/multiselect, deve ter pelo menos uma opção
    if (data.questionType === "select" || data.questionType === "multiselect") {
      return data.options && data.options.length > 0;
    }
    return true;
  },
  {
    message: "Perguntas do tipo seleção devem ter pelo menos uma opção",
    path: ["options"],
  },
);

export const updateDealQuestionSchema = baseDealQuestionSchema
  .omit({ questionType: true }) // Não permitir alterar o tipo após criação
  .partial();

// Schema para respostas dos deals
const baseDealAnswerSchema = createInsertSchema(dealAnswers)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    // Campos específicos por tipo - apenas um deve estar preenchido
    answerBoolean: z.boolean().optional(),
    answerNumber: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined || val === "") return undefined;
        const num = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(num) ? undefined : num.toString();
      }),
    answerText: z
      .string()
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined || val === "") return undefined;
        return val;
      }),
  });

export const insertDealAnswerSchema = baseDealAnswerSchema.refine(
  (data) => {
    // Garantir que apenas um campo de resposta esteja preenchido
    // Usar typeof para distinguir boolean false de undefined
    const hasBoolean = typeof data.answerBoolean === "boolean";
    const hasNumber =
      data.answerNumber !== undefined && data.answerNumber !== "";
    const hasText = data.answerText !== undefined && data.answerText !== "";

    const filledFields = [hasBoolean, hasNumber, hasText].filter(
      Boolean,
    ).length;

    return filledFields === 1;
  },
  {
    message: "Apenas um campo de resposta deve estar preenchido",
    path: ["root"],
  },
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

export const baseInsertClientInteractionSchema = createInsertSchema(
  clientInteractions,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    clientId: z
      .string()
      .optional()
      .nullable()
      .transform((val) => (val === "" ? null : val)),
    companyId: z
      .string()
      .optional()
      .nullable()
      .transform((val) => (val === "" ? null : val)),
    // Fix latitude and longitude to accept both string and number
    latitude: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined || val === "") return null;
        const num = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(num) ? null : num.toString();
      }),
    longitude: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .transform((val) => {
        if (val === null || val === undefined || val === "") return null;
        const num = typeof val === "string" ? parseFloat(val) : val;
        return isNaN(num) ? null : num.toString();
      }),
  });

export const insertClientInteractionSchema =
  baseInsertClientInteractionSchema.refine(
    (data) => !!data.clientId || !!data.companyId,
    {
      message:
        "A interação deve estar associada a um cliente ou a uma empresa.",
      path: ["clientId"],
    },
  );
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

export const insertUserGoalSchema = createInsertSchema(userGoals)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    economicoGoalQty: true,
    intermediarioGoalQty: true,
    premiumGoalQty: true,
  })
  .extend({
    salesGoal: z
      .union([z.string(), z.number()])
      .transform((val) => val.toString())
      .default("0.00"),
    averageTicket: z
      .union([z.string(), z.number()])
      .transform((val) => val.toString())
      .default("0.00"),
    itemsPerSale: z.coerce.number().default(1),
    month: z.coerce.number(),
    year: z.coerce.number(),
  });

export const insertWeeklyResultSchema = createInsertSchema(weeklyResults)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    salesAchieved: z
      .union([z.string(), z.number()])
      .transform((val) => val.toString())
      .default("0.00"),
    ticketAchieved: z
      .union([z.string(), z.number()])
      .transform((val) => val.toString())
      .default("0.00"),
    week: z.coerce.number(),
    itemsAchieved: z.coerce.number().default(0),
    totalGrfsMonth: z.coerce.number().default(0),
    avgGrfValue: z
      .union([z.string(), z.number()])
      .transform((val) => val.toString())
      .default("0.00"),
  });

export const insertTelemarketingGoalSchema = createInsertSchema(
  telemarketingGoals,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    targetQuantity: z.coerce.number().min(1),
    month: z.coerce.number().min(1).max(12),
    year: z.coerce.number().min(2000),
  });

export const insertTelemarketingWeeklyResultSchema = createInsertSchema(
  telemarketingWeeklyResults,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    quantityAchieved: z.coerce.number().min(0),
    week: z.coerce.number().min(1).max(5),
  });

export const insertClientRegistrationGoalSchema = createInsertSchema(
  clientRegistrationGoals,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    targetQuantity: z.coerce.number().min(1),
    month: z.coerce.number().min(1).max(12),
    year: z.coerce.number().min(2000),
  });

export const insertTrainingAttachment = createInsertSchema(
  trainingAttachments,
).omit({
  id: true,
  createdAt: true,
});

export const insertClientRegistrationWeeklyResultSchema = createInsertSchema(
  clientRegistrationWeeklyResults,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    quantityAchieved: z.coerce.number().min(0),
    week: z.coerce.number().min(1).max(5),
  });

export const insertMarkerGoalSchema = createInsertSchema(markerGoals)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    targetQuantity: z.coerce.number().min(1),
    month: z.coerce.number().min(1).max(12),
    year: z.coerce.number().min(2000),
  });

export const insertMarkerWeeklyResultSchema = createInsertSchema(
  markerWeeklyResults,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    quantityAchieved: z.coerce.number().min(0),
    week: z.coerce.number().min(1).max(5),
  });

export const insertInteractionGoalSchema = createInsertSchema(interactionGoals)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    targetQuantity: z.coerce.number().min(1),
    month: z.coerce.number().min(1).max(12),
    year: z.coerce.number().min(2000),
  });

export const insertInteractionWeeklyResultSchema = createInsertSchema(
  interactionWeeklyResults,
)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    quantityAchieved: z.coerce.number().min(0),
    week: z.coerce.number().min(1).max(5),
  });

export const insertCompanyProductSchema = createInsertSchema(
  companyProducts,
).omit({
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
export type UpdateClient = z.infer<typeof updateClientSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertSector = z.infer<typeof insertSectorSchema>;
export type Sector = typeof sectors.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type InsertTraining = z.infer<typeof insertTrainingSchema>;
export type Deal = typeof deals.$inferSelect;

// Tipos para perguntas e respostas dos deals
export type InsertDealQuestion = z.infer<typeof insertDealQuestionSchema>;
export type UpdateDealQuestion = z.infer<typeof updateDealQuestionSchema>;
export type DealQuestion = typeof dealQuestions.$inferSelect;
export type InsertDealAnswer = z.infer<typeof insertDealAnswerSchema>;
export type DealAnswer = typeof dealAnswers.$inferSelect;

export interface DealWithClient extends Deal {
  client?: Client | null;
  company?: Company | null;
  assignedUser?: User | null;
  stage?: FunnelStage | null;
  funnel?: SalesFunnel | null;
  answers?: DealAnswerWithQuestion[];
}

// Interface para resposta com pergunta incluída
export interface DealAnswerWithQuestion extends DealAnswer {
  question: DealQuestion;
}

// Interface para deal completo com todas as informações
export interface DealWithDetails extends Deal {
  client?: Client | null;
  company?: Company | null;
  assignedUser?: User | null;
  stage?: FunnelStage | null;
  funnel?: SalesFunnel | null;
  creator?: User | null;
  answers?: DealAnswerWithQuestion[];
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
export type InsertMarkerGoal = z.infer<typeof insertMarkerGoalSchema>;
export type MarkerGoal = typeof markerGoals.$inferSelect;
export type InsertMarkerWeeklyResult = z.infer<
  typeof insertMarkerWeeklyResultSchema
>;
export type MarkerWeeklyResult = typeof markerWeeklyResults.$inferSelect;
export type InsertInteractionGoal = z.infer<typeof insertInteractionGoalSchema>;
export type InteractionGoal = typeof interactionGoals.$inferSelect;
export type InsertInteractionWeeklyResult = z.infer<
  typeof insertInteractionWeeklyResultSchema
>;
export type InteractionWeeklyResult =
  typeof interactionWeeklyResults.$inferSelect;

export type InsertTrainingAttachment = z.infer<typeof insertTrainingAttachment>;
export type TrainingAttachment = typeof trainingAttachments.$inferSelect;

// Interfaces com relacionamentos

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
export const cashbackTransactions = pgTable(
  "cashback_transactions",
  {
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
    cashbackRate: decimal("cashback_rate", {
      precision: 5,
      scale: 2,
    }).notNull(), // % aplicada
    status: text("status", {
      enum: ["pending", "approved", "paid", "cancelled"],
    })
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
  },
  (table) => [
    // Garante idempotência: apenas 1 cashback ativo por (cliente, nota fiscal)
    // status != 'cancelled' permite múltiplos registros cancelados (histórico de updates)
    uniqueIndex("cashback_transactions_active_unique")
      .on(table.clientId, table.invoiceNumber)
      .where(sql`invoice_number IS NOT NULL AND status != 'cancelled'`),
  ],
);

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
  expiresAt: z
    .union([z.date(), z.string().transform((str) => new Date(str))])
    .optional(),
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

export const sales = pgTable("sales", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  clientId: varchar("client_id")
    .references(() => clients.id)
    .notNull(),
  date: timestamp("date").notNull(),
  grossValue: decimal("gross_value", { precision: 12, scale: 2 }).notNull(),
  cashbackUsed: decimal("cashback_used", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  netValue: decimal("net_value", { precision: 12, scale: 2 }).notNull(),
  cashbackGenerated: decimal("cashback_generated", { precision: 12, scale: 2 })
    .notNull()
    .default("0.00"),
  notes: text("notes"),
  invoiceNumber: varchar("invoice_number", { length: 50 }),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const productCategories = pgTable("product_categories", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProductCategorySchema = createInsertSchema(
  productCategories,
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertProductCategory = z.infer<typeof insertProductCategorySchema>;
export type ProductCategory = typeof productCategories.$inferSelect;

export const products = pgTable("products", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull().default("OUTROS"),
  country: text("country", {
    enum: [
      "CHILE",
      "ARGENTINA",
      "URUGUAI",
      "BRASIL",
      "EUA",
      "FRANÇA",
      "ITÁLIA",
      "PORTUGAL",
      "ESPANHA",
      "ALEMANHA",
      "OUTROS",
    ],
  }),
  volume: text("volume", {
    enum: ["187ml", "375ml", "750ml", "1500ml"],
  }).notNull(),
  type: text("type", {
    enum: ["ESPUMANTE", "BRANCO", "ROSE", "TINTO", "PÓS-REFEIÇÃO"],
  }),
  negotiatedPrice: decimal("negotiated_price", {
    precision: 10,
    scale: 2,
  }).notNull(),
  createdBy: varchar("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  blingProductId: text("bling_product_id"),
  imageUrl: text("image_url"),
  deletedAt: timestamp("deleted_at"),
  aiProfile: jsonb("ai_profile"),
  aiProfileGeneratedAt: timestamp("ai_profile_generated_at"),
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
  deletedAt: true,
});

export type InsertSale = z.infer<typeof insertSaleSchema>;
export type Sale = typeof sales.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

export const messageAutomationSettings = pgTable(
  "message_automation_settings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`), // uuid
    enabled: boolean("enabled").notNull().default(true),
    sendTime: varchar("send_time").notNull(), // "09:00" (HH:mm) OR store as time
    daysBefore: integer("days_before").notNull().default(0),
    type: text("type").notNull().default("template"), // template, bot
    externalTemplateId: varchar("template_id"), // id do template de mensagem
    externalChannelId: varchar("external_channel_id"), // canal de comunicação
    externalFileId: varchar("external_file_id"), // arquivo de mídia (opcional)
    externalFileUrl: text("external_file_url"), // url do arquivo de mídia (opcional)
    waTemplateId: varchar("wa_template_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
);

export const messageJobsLogs = pgTable("message_jobs_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  automationId: varchar("automation_id")
    .references(() => messageAutomationSettings.id, { onDelete: "cascade" })
    .notNull(),
  clientId: varchar("client_id")
    .references(() => clients.id)
    .notNull(),
  scheduledSendAt: timestamp("scheduled_send_at").notNull(),
  actualSendAt: timestamp("actual_send_at"),
  status: text("status", { enum: ["agendado", "enviado", "falhou"] })
    .notNull()
    .default("agendado"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  externalId: varchar("external_id"), // id retornado pelo canal externo
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tabela para rastrear execuções de automações (serverless-safe)
export const automationExecutionLogs = pgTable("automation_execution_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  automationId: varchar("automation_id")
    .references(() => messageAutomationSettings.id, { onDelete: "cascade" })
    .notNull(),
  executionDate: text("execution_date").notNull(), // YYYY-MM-DD
  scheduledTime: varchar("scheduled_time").notNull(), // HH:mm
  actualExecutionTime: timestamp("actual_execution_time")
    .notNull()
    .defaultNow(),
  status: text("status", { enum: ["success", "partial", "failed"] })
    .notNull()
    .default("success"),
  messagesProcessed: integer("messages_processed").notNull().default(0),
  messagesSent: integer("messages_sent").notNull().default(0),
  messagesFailed: integer("messages_failed").notNull().default(0),
  error: text("error"),
  triggeredBy: text("triggered_by", {
    enum: ["cron", "manual", "catchup", "external"],
  })
    .notNull()
    .default("cron"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
// Tabela de eventos
export const events = pgTable("events", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  eventDate: timestamp("event_date").notNull(),
  registrationDeadline: timestamp("registration_deadline"),
  location: text("location").notNull(),
  pricePerPerson: decimal("price_per_person", {
    precision: 10,
    scale: 2,
  }).notNull(),
  maxCapacity: integer("max_capacity"),
  category: text("category").notNull().default("Geral"),
  status: text("status", {
    enum: ["planejado", "ativo", "finalizado", "cancelado"],
  })
    .notNull()
    .default("planejado"),
  notes: text("notes"),
  imageUrl: text("image_url"),
  wineRevenue: decimal("wine_revenue", { precision: 10, scale: 2 }),
  slug: text("slug").unique(),
  landingPageHtmlKey: text("landing_page_html_key"),
  createdBy: varchar("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const eventAttachments = pgTable("event_attachments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  eventId: varchar("event_id")
    .references(() => events.id, { onDelete: "cascade" })
    .notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// Tabela de participantes dos eventos
export const eventParticipants = pgTable("event_participants", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  eventId: varchar("event_id")
    .references(() => events.id, { onDelete: "cascade" })
    .notNull(),
  clientId: varchar("client_id").references(() => clients.id, {
    onDelete: "set null",
  }),
  registrationDate: timestamp("registration_date").defaultNow().notNull(),
  status: text("status", {
    enum: ["pago", "convidado", "pendente", "pagar_na_hora", "cancelado"],
  })
    .notNull()
    .default("pago"),
  numberOfParticipants: integer("number_of_participants").notNull().default(1),
  customPrice: numeric("custom_price"),
  notes: text("notes"),
  attended: boolean("attended"),
  registeredBy: varchar("registered_by")
    .references(() => users.id)
    .notNull(),
});

// Tabela de convidados dos eventos (pessoas não registradas como clientes)
export const eventGuests = pgTable("event_guests", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  eventId: varchar("event_id")
    .references(() => events.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  registrationDate: timestamp("registration_date").defaultNow().notNull(),
  status: text("status", {
    enum: ["pago", "convidado", "pendente", "pagar_na_hora", "cancelado"],
  })
    .notNull()
    .default("convidado"), // Convidados começam como "convidado"
  numberOfParticipants: integer("number_of_participants").notNull().default(1),
  notes: text("notes"),
  registeredBy: varchar("registered_by")
    .references(() => users.id)
    .notNull(),
});

// Relações para eventos
export const eventsRelations = relations(events, ({ one, many }) => ({
  creator: one(users, {
    fields: [events.createdBy],
    references: [users.id],
  }),
  participants: many(eventParticipants),
  guests: many(eventGuests),
  attachments: many(eventAttachments),
}));

export const eventAttachmentsRelations = relations(
  eventAttachments,
  ({ one }) => ({
    event: one(events, {
      fields: [eventAttachments.eventId],
      references: [events.id],
    }),
  }),
);

export const eventParticipantsRelations = relations(
  eventParticipants,
  ({ one }) => ({
    event: one(events, {
      fields: [eventParticipants.eventId],
      references: [events.id],
    }),
    client: one(clients, {
      fields: [eventParticipants.clientId],
      references: [clients.id],
    }),
    registeredByUser: one(users, {
      fields: [eventParticipants.registeredBy],
      references: [users.id],
    }),
  }),
);

export const eventGuestsRelations = relations(eventGuests, ({ one }) => ({
  event: one(events, {
    fields: [eventGuests.eventId],
    references: [events.id],
  }),
  registeredByUser: one(users, {
    fields: [eventGuests.registeredBy],
    references: [users.id],
  }),
}));

// Schemas de inserção para eventos
export const insertEventSchema = createInsertSchema(events)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().default("Novo Evento"),
    location: z.string().default("A definir"),
    eventDate: z.coerce.date().default(() => new Date()),
    pricePerPerson: z.string().default("0"),
    category: z.string().default("Geral"),
    status: z
      .enum(["planejado", "ativo", "finalizado", "cancelado"])
      .default("planejado"),
    wineRevenue: z.string().nullable().optional().default(null),
  });

export const insertEventAttachmentSchema = createInsertSchema(
  eventAttachments,
).omit({
  id: true,
  uploadedAt: true,
});

export const insertEventParticipantSchema = createInsertSchema(
  eventParticipants,
)
  .omit({
    id: true,
    registrationDate: true,
  })
  .extend({
    status: z
      .enum(["pago", "convidado", "pendente", "pagar_na_hora", "cancelado"])
      .default("pago"),
    attended: z.boolean().nullable().optional(),
  });

// Tipos para eventos
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEventAttachment = z.infer<typeof insertEventAttachmentSchema>;
export type EventAttachment = typeof eventAttachments.$inferSelect;
export type InsertEventParticipant = z.infer<
  typeof insertEventParticipantSchema
>;
export type EventParticipant = typeof eventParticipants.$inferSelect;

// Interface com relacionamentos
export interface EventWithDetails extends Event {
  creator: User;
  participants: (EventParticipant & {
    client: Client;
    registeredByUser: User;
  })[];
  participantCount?: number;
  paidParticipants?: number;
  pendingParticipants?: number;
  ausenteParticipants?: number;
  confirmedParticipants?: number;
  presentCount?: number;
  convidadoCount?: number;
  absentCount?: number;
  eventRevenue?: number;
  creatorName?: string;
  attachments?: EventAttachment[];
}

// Tabelas de conexao OAuth com Bling
export const blingConnections = pgTable(
  "bling_connections",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    name: text("name").notNull(),
    oauthClientId: text("oauth_client_id").notNull(),
    oauthClientSecretEncrypted: text("oauth_client_secret_encrypted").notNull(),
    status: text("status", {
      enum: [
        "pending",
        "connected",
        "expired",
        "reauth_required",
        "revoked",
        "error",
      ],
    })
      .notNull()
      .default("pending"),
    blingUserId: text("bling_user_id"),
    blingLogin: text("bling_login"),
    blingAccountId: text("bling_account_id"),
    blingAccountName: text("bling_account_name"),
    accessTokenEncrypted: text("access_token_encrypted"),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    tokenType: text("token_type"),
    scope: text("scope"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    lastRefreshAt: timestamp("last_refresh_at"),
    lastSyncAt: timestamp("last_sync_at"),
    lastError: text("last_error"),
    blingCompanyId: text("bling_company_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("bling_connections_user_idx").on(table.userId),
    index("bling_connections_status_idx").on(table.status),
    index("bling_connections_company_id_idx").on(table.blingCompanyId),
    uniqueIndex("bling_connections_user_name_uidx").on(
      table.userId,
      table.name,
    ),
  ],
);

export const blingOAuthStates = pgTable(
  "bling_oauth_states",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    state: text("state").notNull().unique(),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    connectionId: varchar("connection_id")
      .references(() => blingConnections.id)
      .notNull(),
    redirectUri: text("redirect_uri").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    consumedAt: timestamp("consumed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("bling_oauth_states_user_idx").on(table.userId),
    index("bling_oauth_states_expires_idx").on(table.expiresAt),
  ],
);

// Tabela de pedidos do Bling Control
export const blingOrders = pgTable(
  "bling_orders",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    blingOrderId: text("bling_order_id").notNull(),

    // FK para a conexão Bling que originou o pedido (null em registros legados)
    connectionId: varchar("connection_id").references(() => blingConnections.id),

    orderNumber: text("order_number").notNull(),

    storeOrderNumber: text("store_order_number"),

    saleDate: text("sale_date").notNull(),

    departureDate: text("departure_date"),

    expectedDeliveryDate: text("expected_delivery_date"),

    totalValue: numeric("total_value", { precision: 15, scale: 2 }).notNull(),

    sellerId: text("seller_id"),
    sellerName: text("seller_name"),

    contactId: text("contact_id").notNull(),
    contactName: text("contact_name"),
    contactType: text("contact_type"),
    contactDocument: text("contact_document"),

    storeId: text("store_id").notNull(),

    situationId: text("situation_id"),
    situationValue: text("situation_value"),

    paymentMethodId: text("payment_method_id"),
    paymentMethodName: text("payment_method_name"),

    observations: text("observations"),
    internalObservations: text("internal_observations"),

    accountId: text("account_id").notNull(),
    userId: text("user_id").notNull(),
    accountName: text("account_name"),
    companyId: text("company_id").notNull(),
    eventId: text("event_id").notNull(),

    rawOrderData: text("raw_order_data").notNull(),

    // Dados originais de telefone do contato Bling (PF)
    contactPhone: text("contact_phone"),
    contactCellphone: text("contact_cellphone"),

    // Vínculo com cliente do app (encontrado por telefone/celular, somente PF)
    appClientId: varchar("app_client_id").references(() => clients.id),

    // Última ação recebida via Pub/Sub (created | updated | deleted)
    lastEventAction: text("last_event_action", {
      enum: ["created", "updated", "deleted"],
    }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("bling_orders_bling_id_idx").on(table.blingOrderId),
    uniqueIndex("bling_orders_conn_order_uidx").on(table.connectionId, table.blingOrderId),
    index("bling_orders_connection_idx").on(table.connectionId),
    index("bling_orders_account_idx").on(table.accountId),
    index("bling_orders_user_idx").on(table.userId),
    index("bling_orders_contact_idx").on(table.contactId),
    index("bling_orders_sale_date_idx").on(table.saleDate),
    index("bling_orders_deleted_idx").on(table.deletedAt),
    // Performance indices for filters and aggregations
    index("bling_orders_seller_idx").on(table.sellerId),
    index("bling_orders_store_idx").on(table.storeId),
    index("bling_orders_situation_idx").on(table.situationId),
    index("bling_orders_payment_method_idx").on(table.paymentMethodId),
    index("bling_orders_total_value_idx").on(table.totalValue),
    // Composite index for common query pattern (date range + filters)
    index("bling_orders_date_deleted_idx").on(table.saleDate, table.deletedAt),
    // Index for contact name search (case-insensitive)
    index("bling_orders_contact_name_idx").on(sql`LOWER(${table.contactName})`),
    // Index para lookup de pedidos por cliente do app
    index("bling_orders_app_client_idx").on(table.appClientId),
  ],
);

// Tabela de itens dos pedidos do Bling
export const blingOrderItems = pgTable(
  "bling_order_items",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orderId: varchar("order_id")
      .references(() => blingOrders.id, { onDelete: "cascade" })
      .notNull(),

    productId: text("product_id"),

    productCode: text("product_code"),

    description: text("description"),

    quantity: numeric("quantity", { precision: 15, scale: 3 }).notNull(),

    value: numeric("value", { precision: 15, scale: 2 }).notNull(),

    discount: numeric("discount", { precision: 15, scale: 2 }).default("0"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("bling_order_items_order_idx").on(table.orderId),
    index("bling_order_items_product_idx").on(table.productId),
  ],
);

// Tabela de parcelas dos pedidos do Bling
export const blingOrderInstallments = pgTable(
  "bling_order_installments",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orderId: varchar("order_id")
      .references(() => blingOrders.id, { onDelete: "cascade" })
      .notNull(),

    installmentId: text("installment_id").notNull(),

    dueDate: text("due_date").notNull(),

    value: numeric("value", { precision: 15, scale: 2 }).notNull(),

    observations: text("observations"),

    paymentMethodId: text("payment_method_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("bling_order_installments_order_idx").on(table.orderId),
    index("bling_order_installments_due_date_idx").on(table.dueDate),
  ],
);

// Tabela de logs de processamento de mensagens do Pub/Sub
export const pubsubProcessingLogs = pgTable(
  "pubsub_processing_logs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    messageId: text("message_id").notNull().unique(),

    eventType: text("event_type", {
      enum: ["created", "updated", "deleted"],
    }).notNull(),

    blingOrderId: text("bling_order_id"),

    status: text("status", {
      enum: ["processing", "success", "failed", "retrying"],
    })
      .notNull()
      .default("processing"),

    attempts: integer("attempts").notNull().default(1),

    errorMessage: text("error_message"),
    errorStack: text("error_stack"),

    rawMessage: text("raw_message").notNull(),

    accountId: text("account_id"),
    userId: text("user_id"),

    processedAt: timestamp("processed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("pubsub_logs_message_id_idx").on(table.messageId),
    index("pubsub_logs_status_idx").on(table.status),
    index("pubsub_logs_event_type_idx").on(table.eventType),
    index("pubsub_logs_bling_order_idx").on(table.blingOrderId),
  ],
);

// Tabela de pedidos importados da plataforma Connect (via CSV)
export const connectOrders = pgTable(
  "connect_orders",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),

    // Hash de deduplicação (SHA256 do saleCode)
    importHash: text("import_hash").notNull(),

    // Dados da venda
    saleCode: text("sale_code"),
    saleDate: timestamp("sale_date").notNull(),
    totalValue: numeric("total_value", { precision: 15, scale: 2 }).notNull(),

    // Dados do cliente
    contactName: text("contact_name"),
    contactCpf: text("contact_cpf"),
    contactBirthDate: text("contact_birth_date"),
    contactCep: text("contact_cep"),
    contactStreet: text("contact_street"),
    contactNumber: text("contact_number"),
    contactNeighborhood: text("contact_neighborhood"),
    contactComplement: text("contact_complement"),
    contactCity: text("contact_city"),
    contactPhone: text("contact_phone"),
    contactCellphone: text("contact_cellphone"),

    // Vínculo com cliente do app (encontrado ou criado na importação)
    appClientId: varchar("app_client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    appClientStatus: text("app_client_status", {
      enum: ["found", "created", "not_found"],
    }),

    // Dados do vendedor
    sellerNameRaw: text("seller_name_raw"),
    sellerId: varchar("seller_id").references(() => users.id, {
      onDelete: "set null",
    }),
    sellerMatchScore: real("seller_match_score"),

    // Metadados de importação
    sourceFile: text("source_file"),
    importedAt: timestamp("imported_at").defaultNow().notNull(),
    importedBy: varchar("imported_by")
      .references(() => users.id, { onDelete: "set null" })
      .notNull(),
  },
  (table) => [
    index("connect_orders_sale_date_idx").on(table.saleDate),
    index("connect_orders_seller_id_idx").on(table.sellerId),
    index("connect_orders_imported_by_idx").on(table.importedBy),
    index("connect_orders_contact_name_idx").on(table.contactName),
    uniqueIndex("connect_orders_sale_code_uidx").on(table.saleCode),
    index("connect_orders_import_hash_idx").on(table.importHash),
    index("connect_orders_app_client_id_idx").on(table.appClientId),
  ],
);

export const insertConnectOrderSchema = createInsertSchema(connectOrders).omit({
  importedAt: true,
});

// Tabela de itens de pedidos Connect (um pedido pode ter vários itens/produtos)
export const connectOrderItems = pgTable(
  "connect_order_items",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    orderId: integer("order_id")
      .notNull()
      .references(() => connectOrders.id, { onDelete: "cascade" }),
    productCode: text("product_code"),
    productName: text("product_name"),
    quantity: numeric("quantity", { precision: 15, scale: 3 }).notNull(),
    unitValue: numeric("unit_value", { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("connect_order_items_order_idx").on(table.orderId)],
);

export const insertConnectOrderItemSchema = createInsertSchema(
  connectOrderItems,
).omit({
  id: true,
  createdAt: true,
});
export type InsertConnectOrderItem = z.infer<
  typeof insertConnectOrderItemSchema
>;

// Schemas de inserção
export const insertBlingConnectionSchema = createInsertSchema(
  blingConnections,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  oauthClientSecretEncrypted: true,
  accessTokenEncrypted: true,
  refreshTokenEncrypted: true,
  lastRefreshAt: true,
  lastSyncAt: true,
  lastError: true,
  blingUserId: true,
  blingLogin: true,
  blingAccountId: true,
  blingAccountName: true,
  accessTokenExpiresAt: true,
  refreshTokenExpiresAt: true,
  tokenType: true,
  scope: true,
  status: true,
});

export const insertBlingOAuthStateSchema = createInsertSchema(
  blingOAuthStates,
).omit({
  id: true,
  createdAt: true,
  consumedAt: true,
});

export const insertBlingOrderSchema = createInsertSchema(blingOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBlingOrderItemSchema = createInsertSchema(
  blingOrderItems,
).omit({
  id: true,
  createdAt: true,
});

export const insertBlingOrderInstallmentSchema = createInsertSchema(
  blingOrderInstallments,
).omit({
  id: true,
  createdAt: true,
});

export const insertPubsubProcessingLogSchema = createInsertSchema(
  pubsubProcessingLogs,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Tipos
export type BlingConnection = typeof blingConnections.$inferSelect;
export type InsertBlingConnection = z.infer<typeof insertBlingConnectionSchema>;
export type BlingOAuthState = typeof blingOAuthStates.$inferSelect;
export type InsertBlingOAuthState = z.infer<typeof insertBlingOAuthStateSchema>;
export type BlingOrder = typeof blingOrders.$inferSelect;
export type InsertBlingOrder = z.infer<typeof insertBlingOrderSchema>;
export type BlingOrderItem = typeof blingOrderItems.$inferSelect;
export type InsertBlingOrderItem = z.infer<typeof insertBlingOrderItemSchema>;
export type BlingOrderInstallment = typeof blingOrderInstallments.$inferSelect;
export type InsertBlingOrderInstallment = z.infer<
  typeof insertBlingOrderInstallmentSchema
>;
export type PubsubProcessingLog = typeof pubsubProcessingLogs.$inferSelect;
export type InsertPubsubProcessingLog = z.infer<
  typeof insertPubsubProcessingLogSchema
>;

// Interface com relacionamentos
export interface BlingOrderWithDetails extends BlingOrder {
  items: BlingOrderItem[];
  installments: BlingOrderInstallment[];
}

// Relações
export const blingConnectionsRelations = relations(
  blingConnections,
  ({ one, many }) => ({
    user: one(users, {
      fields: [blingConnections.userId],
      references: [users.id],
    }),
    oauthStates: many(blingOAuthStates),
  }),
);

export const blingOAuthStatesRelations = relations(
  blingOAuthStates,
  ({ one }) => ({
    user: one(users, {
      fields: [blingOAuthStates.userId],
      references: [users.id],
    }),
    connection: one(blingConnections, {
      fields: [blingOAuthStates.connectionId],
      references: [blingConnections.id],
    }),
  }),
);

export const blingOrdersRelations = relations(blingOrders, ({ many }) => ({
  items: many(blingOrderItems),
  installments: many(blingOrderInstallments),
}));

export const blingOrderItemsRelations = relations(
  blingOrderItems,
  ({ one }) => ({
    order: one(blingOrders, {
      fields: [blingOrderItems.orderId],
      references: [blingOrders.id],
    }),
  }),
);

export const blingOrderInstallmentsRelations = relations(
  blingOrderInstallments,
  ({ one }) => ({
    order: one(blingOrders, {
      fields: [blingOrderInstallments.orderId],
      references: [blingOrders.id],
    }),
  }),
);

// Tabela de status de sincronização de clientes com o Bling
export const blingClientSync = pgTable(
  "bling_client_sync",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    clientId: varchar("client_id")
      .notNull()
      .unique()
      .references(() => clients.id, { onDelete: "cascade" }),
    syncStatus: text("sync_status", {
      enum: ["pending", "synced", "error"],
    })
      .notNull()
      .default("pending"),
    lastSyncedAt: timestamp("last_synced_at"),
    errorMessage: text("error_message"),
    retryCount: integer("retry_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("bling_client_sync_client_idx").on(table.clientId),
    index("bling_client_sync_status_idx").on(table.syncStatus),
  ],
);

export const blingClientSyncRelations = relations(
  blingClientSync,
  ({ one }) => ({
    client: one(clients, {
      fields: [blingClientSync.clientId],
      references: [clients.id],
    }),
  }),
);

export const insertBlingClientSyncSchema = createInsertSchema(
  blingClientSync,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BlingClientSync = typeof blingClientSync.$inferSelect;
export type InsertBlingClientSync = z.infer<typeof insertBlingClientSyncSchema>;

// ---------------------------------------------------------------------------
// Tabelas de mapeamento multi-conta Bling
// ---------------------------------------------------------------------------

// Mapeia (connectionId, blingProductId) → productId local
export const blingProductMappings = pgTable(
  "bling_product_mappings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    connectionId: varchar("connection_id")
      .references(() => blingConnections.id)
      .notNull(),
    blingProductId: text("bling_product_id").notNull(),
    productId: varchar("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("bling_product_mappings_conn_prod_uidx").on(t.connectionId, t.blingProductId),
    index("bling_product_mappings_product_idx").on(t.productId),
    index("bling_product_mappings_connection_idx").on(t.connectionId),
  ],
);

// Mapeia (connectionId, blingVendedorId) → userId local
export const blingSellerMappings = pgTable(
  "bling_seller_mappings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    connectionId: varchar("connection_id")
      .references(() => blingConnections.id)
      .notNull(),
    blingVendedorId: text("bling_vendedor_id").notNull(),
    blingVendedorName: text("bling_vendedor_name"),
    // nullable: vendedor pode não ter usuário correspondente no app
    userId: varchar("user_id").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("bling_seller_mappings_conn_vendor_uidx").on(t.connectionId, t.blingVendedorId),
    index("bling_seller_mappings_user_idx").on(t.userId),
    index("bling_seller_mappings_connection_idx").on(t.connectionId),
  ],
);

// Mapeia (connectionId, blingContactId) → clientId local
export const blingContactMappings = pgTable(
  "bling_contact_mappings",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    connectionId: varchar("connection_id")
      .references(() => blingConnections.id)
      .notNull(),
    blingContactId: text("bling_contact_id").notNull(),
    clientId: varchar("client_id")
      .references(() => clients.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("bling_contact_mappings_conn_contact_uidx").on(t.connectionId, t.blingContactId),
    index("bling_contact_mappings_client_idx").on(t.clientId),
    index("bling_contact_mappings_connection_idx").on(t.connectionId),
  ],
);

export const insertBlingProductMappingSchema = createInsertSchema(blingProductMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBlingSellerMappingSchema = createInsertSchema(blingSellerMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBlingContactMappingSchema = createInsertSchema(blingContactMappings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type BlingProductMapping = typeof blingProductMappings.$inferSelect;
export type InsertBlingProductMapping = z.infer<typeof insertBlingProductMappingSchema>;
export type BlingSellerMapping = typeof blingSellerMappings.$inferSelect;
export type InsertBlingSellerMapping = z.infer<typeof insertBlingSellerMappingSchema>;
export type BlingContactMapping = typeof blingContactMappings.$inferSelect;
export type InsertBlingContactMapping = z.infer<typeof insertBlingContactMappingSchema>;

export const blingProductMappingsRelations = relations(blingProductMappings, ({ one }) => ({
  connection: one(blingConnections, {
    fields: [blingProductMappings.connectionId],
    references: [blingConnections.id],
  }),
  product: one(products, {
    fields: [blingProductMappings.productId],
    references: [products.id],
  }),
}));

export const blingSellerMappingsRelations = relations(blingSellerMappings, ({ one }) => ({
  connection: one(blingConnections, {
    fields: [blingSellerMappings.connectionId],
    references: [blingConnections.id],
  }),
  user: one(users, {
    fields: [blingSellerMappings.userId],
    references: [users.id],
  }),
}));

export const blingContactMappingsRelations = relations(blingContactMappings, ({ one }) => ({
  connection: one(blingConnections, {
    fields: [blingContactMappings.connectionId],
    references: [blingConnections.id],
  }),
  client: one(clients, {
    fields: [blingContactMappings.clientId],
    references: [clients.id],
  }),
}));

// Tabela de campanhas Umbler
export const umblerCampaigns = pgTable("umbler_campaigns", {
  id: varchar("id").primaryKey(),
  title: text("title").notNull(),
  status: text("status", {
    enum: ["created", "in_progress", "completed", "failed", "cancelled"],
  })
    .notNull()
    .default("created"),
  totalContacts: integer("total_contacts").notNull(),
  scheduledMessages: integer("scheduled_messages").notNull(),
  sentMessages: integer("sent_messages").notNull().default(0),
  failedMessages: integer("failed_messages").notNull().default(0),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  completedAt: timestamp("completed_at"),
  botId: text("bot_id").notNull(),
  botTriggerName: text("bot_trigger_name").notNull(),
  channelId: text("channel_id").notNull(),
  fromPhone: text("from_phone").notNull(),
  intervalSeconds: integer("interval_seconds").notNull().default(5),
  exclusiveTagFilter: boolean("exclusive_tag_filter").notNull().default(true),
  tagIds: text("tag_ids").array().notNull(),
  organizationId: text("organization_id").notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tabela de mensagens de campanhas
export const umblerCampaignMessages = pgTable("umbler_campaign_messages", {
  id: varchar("id").primaryKey(),
  campaignId: varchar("campaign_id")
    .references(() => umblerCampaigns.id)
    .notNull(),
  contactId: text("contact_id"),
  contactName: text("contact_name").notNull(),
  phoneNumber: text("phone_number").notNull(),
  status: text("status", {
    enum: ["scheduled", "sent", "failed", "cancelled"],
  })
    .notNull()
    .default("scheduled"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
  messageId: text("message_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Schemas de inserção
export const insertUmblerCampaignSchema = createInsertSchema(umblerCampaigns);
export const insertUmblerCampaignMessageSchema = createInsertSchema(
  umblerCampaignMessages,
);

// Tipos
export type UmblerCampaign = typeof umblerCampaigns.$inferSelect;
export type InsertUmblerCampaign = z.infer<typeof insertUmblerCampaignSchema>;
export type UmblerCampaignMessage = typeof umblerCampaignMessages.$inferSelect;
export type InsertUmblerCampaignMessage = z.infer<
  typeof insertUmblerCampaignMessageSchema
>;

// Relações
export const umblerCampaignsRelations = relations(
  umblerCampaigns,
  ({ many, one }) => ({
    messages: many(umblerCampaignMessages),
    createdByUser: one(users, {
      fields: [umblerCampaigns.createdBy],
      references: [users.id],
    }),
  }),
);

export const umblerCampaignMessagesRelations = relations(
  umblerCampaignMessages,
  ({ one }) => ({
    campaign: one(umblerCampaigns, {
      fields: [umblerCampaignMessages.campaignId],
      references: [umblerCampaigns.id],
    }),
  }),
);

// Tabela de controle de execuções de automação
// Gerencia o estado de cada execução para permitir cancelamento e monitoramento
export const automationExecutions = pgTable("automation_executions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  automationId: varchar("automation_id")
    .references(() => messageAutomationSettings.id)
    .notNull(),
  executionType: text("execution_type", {
    enum: ["scheduled", "manual", "catchup"],
  })
    .notNull()
    .default("scheduled"),
  status: text("status", {
    enum: ["queued", "running", "completed", "cancelled", "failed"],
  })
    .notNull()
    .default("queued"),
  targetDate: text("target_date").notNull(), // Data alvo do aniversário (YYYY-MM-DD)
  scheduledTime: text("scheduled_time").notNull(), // Horário agendado (HH:mm)
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: varchar("cancelled_by").references(() => users.id),
  totalClients: integer("total_clients").notNull().default(0),
  processedClients: integer("processed_clients").notNull().default(0),
  successfulMessages: integer("successful_messages").notNull().default(0),
  failedMessages: integer("failed_messages").notNull().default(0),
  errorMessage: text("error_message"),
  metadata: text("metadata"), // JSON com dados adicionais
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Schema de inserção
export const insertAutomationExecutionSchema =
  createInsertSchema(automationExecutions);

// Tipo
export type AutomationExecution = typeof automationExecutions.$inferSelect;
export type InsertAutomationExecution = z.infer<
  typeof insertAutomationExecutionSchema
>;

// Relações
export const automationExecutionsRelations = relations(
  automationExecutions,
  ({ one }) => ({
    automation: one(messageAutomationSettings, {
      fields: [automationExecutions.automationId],
      references: [messageAutomationSettings.id],
    }),
    cancelledByUser: one(users, {
      fields: [automationExecutions.cancelledBy],
      references: [users.id],
    }),
  }),
);

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
});

// ─── WhatsApp Business API ────────────────────────────────────────────────────

export const whatsappSettings = pgTable("whatsapp_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
  isSensitive: boolean("is_sensitive").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const whatsappTemplates = pgTable("whatsapp_templates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  languageCode: text("language_code").notNull().default("pt_BR"),
  category: text("category"),
  useCase: text("use_case", {
    enum: ["birthday_today", "birthday_days_before", "post_call", "campaign", "custom"],
  }).notNull(),
  description: text("description"),
  headerParams: jsonb("header_params"),
  bodyParams: jsonb("body_params"),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: varchar("created_by")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type WhatsappSetting = typeof whatsappSettings.$inferSelect;
export type WhatsappTemplate = typeof whatsappTemplates.$inferSelect;
export type InsertWhatsappTemplate = typeof whatsappTemplates.$inferInsert;

// Tabela de boards (quadros) do kanban de tarefas
export const taskBoards = pgTable("task_boards", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  color: text("color").notNull().default("slate"),
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(false),
  createdById: varchar("created_by_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tabela de etapas do kanban de tarefas (dinâmicas, por board)
export const taskStages = pgTable("task_stages", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  boardId: varchar("board_id").references(() => taskBoards.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  slug: varchar("slug").notNull().unique(),
  color: text("color").notNull().default("slate"),
  order: integer("order").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tabela de tarefas internas
export const tasks = pgTable("tasks", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: varchar("assignee_id")
    .references(() => users.id)
    .notNull(),
  createdById: varchar("created_by_id")
    .references(() => users.id)
    .notNull(),
  dueDate: timestamp("due_date"),
  category: text("category", {
    enum: ["marketing", "operacao", "financeiro", "comercial", "outro"],
  })
    .notNull()
    .default("outro"),
  priority: text("priority", {
    enum: ["baixa", "media", "alta", "urgente"],
  })
    .notNull()
    .default("media"),
  status: varchar("status").notNull().default("a_fazer"),
  order: integer("order"),
  boardId: varchar("board_id").references(() => taskBoards.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Tabela de comentários de tarefas
export const taskComments = pgTable("task_comments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  taskId: varchar("task_id")
    .references(() => tasks.id, { onDelete: "cascade" })
    .notNull(),
  userId: varchar("user_id")
    .references(() => users.id)
    .notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
    relationName: "taskAssignee",
  }),
  createdBy: one(users, {
    fields: [tasks.createdById],
    references: [users.id],
    relationName: "taskCreator",
  }),
  comments: many(taskComments),
}));

export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskComments.taskId],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskComments.userId],
    references: [users.id],
  }),
}));

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskCommentSchema = createInsertSchema(taskComments).omit({
  id: true,
  createdAt: true,
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type TaskComment = typeof taskComments.$inferSelect;

// ─── Anotações (estilo OneNote) ──────────────────────────────────────────────

export const noteSections = pgTable("note_sections", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  color: text("color").notNull().default("slate"),
  order: integer("order").notNull().default(0),
  createdById: varchar("created_by_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notes = pgTable("notes", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  sectionId: varchar("section_id")
    .references(() => noteSections.id, { onDelete: "cascade" })
    .notNull(),
  createdById: varchar("created_by_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const noteSectionsRelations = relations(noteSections, ({ many }) => ({
  notes: many(notes),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  section: one(noteSections, {
    fields: [notes.sectionId],
    references: [noteSections.id],
  }),
  createdBy: one(users, {
    fields: [notes.createdById],
    references: [users.id],
  }),
}));

export type TaskBoard = typeof taskBoards.$inferSelect;
export type NoteSection = typeof noteSections.$inferSelect;
export type Note = typeof notes.$inferSelect;

// ─── Arquivos de tarefas ──────────────────────────────────────────────────────

export const taskFileFolders = pgTable("task_file_folders", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  color: text("color").notNull().default("slate"),
  order: integer("order").notNull().default(0),
  createdById: varchar("created_by_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const taskFiles = pgTable("task_files", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  url: text("url").notNull(),
  size: integer("size").notNull().default(0),
  mimeType: text("mime_type").notNull().default("application/octet-stream"),
  folderId: varchar("folder_id")
    .references(() => taskFileFolders.id, { onDelete: "cascade" })
    .notNull(),
  uploadedById: varchar("uploaded_by_id")
    .references(() => users.id)
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type TaskFileFolder = typeof taskFileFolders.$inferSelect;
export type TaskFile = typeof taskFiles.$inferSelect;

// ─── Telephony: Campanhas, Chamadas, Triggers e Notificações ─────────────────

export const campaigns = pgTable("campaigns", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", {
    enum: ["rascunho", "ativa", "pausada", "encerrada"],
  })
    .notNull()
    .default("rascunho"),
  type: text("type", { enum: ["humano", "ia"] }).notNull(),
  elevenLabsAgentId: text("eleven_labs_agent_id"),
  elevenLabsVoiceId: text("eleven_labs_voice_id"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  umblerEnabled: boolean("umbler_enabled").default(false).notNull(),
  umblerChannelId: text("umbler_channel_id"),
  umblerBotId: text("umbler_bot_id"),
  umblerBotTriggerName: text("umbler_bot_trigger_name"),
  umblerMessageText: text("umbler_message_text"),
  umblerTriggerDecision: text("umbler_trigger_decision"),
  waEnabled: boolean("wa_enabled").default(false).notNull(),
  waTemplateId: varchar("wa_template_id").references(() => whatsappTemplates.id),
  waTriggerDecision: text("wa_trigger_decision"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const calls = pgTable("calls", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id),
  operatorId: varchar("operator_id")
    .notNull()
    .references(() => users.id),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  twilioCallSid: text("twilio_call_sid"),
  elevenLabsConversationId: text("eleven_labs_conversation_id"),
  status: text("status", {
    enum: [
      "iniciando",
      "em_andamento",
      "encerrada",
      "nao_atendeu",
      "ocupado",
      "falhou",
      "caixa_postal",
    ],
  })
    .notNull()
    .default("iniciando"),
  outcome: text("outcome", {
    enum: [
      "atendeu",
      "nao_atendeu",
      "ocupado",
      "caixa_postal",
      "numero_invalido",
      "convertido",
      "reagendado",
    ],
  }),
  duration: integer("duration"),
  notes: text("notes"),
  recordingUrl: text("recording_url"),
  recordingSid: text("recording_sid"),
  transcription: text("transcription"),
  twilioTranscription: text("twilio_transcription"),
  summary: text("summary"),
  sentiment: text("sentiment", {
    enum: ["positivo", "neutro", "negativo"],
  }),
  aiDecision: text("ai_decision", {
    enum: ["sim", "nao", "sem_resposta"],
  }),
  nextStep: text("next_step"),
  toPhone: text("to_phone"),
  contactName: text("contact_name"),
  umblerMessageStatus: text("umbler_message_status", {
    enum: ["enviado", "falhou"],
  }),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const campaignTriggers = pgTable("campaign_triggers", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  keyword: text("keyword").notNull(),
  instruction: text("instruction"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const callNotifications = pgTable("call_notifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id),
  callId: varchar("call_id").references(() => calls.id),
  clientId: varchar("client_id").references(() => clients.id),
  triggerId: varchar("trigger_id").references(() => campaignTriggers.id),
  message: text("message"),
  excerpt: text("excerpt"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCallSchema = createInsertSchema(calls).omit({
  id: true,
  createdAt: true,
});
export const insertCampaignTriggerSchema = createInsertSchema(
  campaignTriggers,
).omit({ id: true, createdAt: true });
export const insertCallNotificationSchema = createInsertSchema(
  callNotifications,
).omit({ id: true, createdAt: true });

export const campaignClients = pgTable(
  "campaign_clients",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    campaignId: varchar("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    clientId: varchar("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: [
        "novo",
        "contactado",
        "nao_atendeu",
        "ocupado",
        "caixa_postal",
        "convite_aceito",
        "convite_recusado",
        "convertido",
        "desqualificado",
      ],
    })
      .notNull()
      .default("novo"),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: timestamp("last_attempt_at"),
    nextAttemptAt: timestamp("next_attempt_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    unique().on(t.campaignId, t.clientId),
    index("campaign_clients_next_attempt_idx").on(t.nextAttemptAt),
  ],
);

// Idempotência de webhooks externos (Twilio, ElevenLabs)
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    payloadHash: text("payload_hash"),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
  },
  (t) => [unique("webhook_events_provider_event_id_key").on(t.provider, t.eventId)],
);
export type WebhookEvent = typeof webhookEvents.$inferSelect;

export const insertCampaignClientSchema = createInsertSchema(
  campaignClients,
).omit({ id: true, createdAt: true });

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Call = typeof calls.$inferSelect;
export type InsertCall = z.infer<typeof insertCallSchema>;
export type CampaignTrigger = typeof campaignTriggers.$inferSelect;
export type InsertCampaignTrigger = z.infer<typeof insertCampaignTriggerSchema>;
export type CallNotification = typeof callNotifications.$inferSelect;
export type InsertCallNotification = z.infer<
  typeof insertCallNotificationSchema
>;
export type CampaignClient = typeof campaignClients.$inferSelect;
export type InsertCampaignClient = z.infer<typeof insertCampaignClientSchema>;
