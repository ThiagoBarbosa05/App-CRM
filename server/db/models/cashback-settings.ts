import { users } from "@shared/schema";
import { sql } from "drizzle-orm";
import { decimal, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

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
