import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, integer } from "drizzle-orm/pg-core";
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
  cpf: text("cpf").notNull().unique(),
  email: text("email"),
  birthday: text("birthday").notNull(),
  cep: text("cep").notNull(),
  address: text("address").notNull(),
  number: text("number").notNull(),
  neighborhood: text("neighborhood").notNull(),
  city: text("city").notNull(),
  state: text("state").notNull(),
  markers: text("markers").array().default([]).notNull(),
  responsible: text("responsible").notNull(),
  categoria: text("categoria").notNull(),
  origem: text("origem").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

export const clientsRelations = relations(clients, ({ many }) => ({
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

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
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
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;

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
