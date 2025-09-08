import { clients, deals, users } from "@shared/schema";
import { sql } from "drizzle-orm";
import { decimal, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { cashbackSettings } from "./cashback-settings";

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
