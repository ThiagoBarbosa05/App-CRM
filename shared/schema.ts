import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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
  value: decimal("value", { precision: 10, scale: 2 }).notNull(),
  stage: text("stage", { enum: ["prospeccao", "negociacao", "fechamento"] }).notNull().default("prospeccao"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
});

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  createdAt: true,
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type Deal = typeof deals.$inferSelect;

export interface DealWithClient extends Deal {
  client: Client;
}
