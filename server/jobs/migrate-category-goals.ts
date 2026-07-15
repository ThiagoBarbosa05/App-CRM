import { db } from "../db";
import { sql } from "drizzle-orm";

export async function migrateCategoryGoals() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS category_goals (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR REFERENCES users(id) NOT NULL,
        category_name TEXT NOT NULL,
        goal_qty INTEGER NOT NULL DEFAULT 1,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log("[Migrate] Tabela category_goals verificada/criada.");
  } catch (err) {
    console.error("[Migrate] Erro ao criar tabela category_goals:", err);
  }
}
