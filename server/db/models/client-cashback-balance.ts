import { clients } from "@shared/schema";
import { sql } from "drizzle-orm";
import { decimal, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

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