import { sql } from "drizzle-orm";
import { db } from "../db";

/**
 * Mantém as tabelas do fluxo de orçamento de evento disponíveis antes das
 * rotas aceitarem tráfego. É idempotente para que o deploy não dependa de uma
 * etapa manual de schema.
 */
export async function migrateEventBudgets() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS event_budgets (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      event_id varchar REFERENCES events(id) ON DELETE SET NULL,
      title text NOT NULL DEFAULT 'Novo orçamento',
      client_name text,
      status text NOT NULL DEFAULT 'rascunho'
        CHECK (status IN ('rascunho', 'aprovado', 'arquivado')),
      participants integer NOT NULL DEFAULT 1,
      planned_cost numeric(12, 2) NOT NULL DEFAULT 0,
      planned_price numeric(12, 2) NOT NULL DEFAULT 0,
      target_margin numeric(5, 2) NOT NULL DEFAULT 40,
      actual_participants integer,
      revenue_override numeric(12, 2),
      proposal_text text,
      calculator_data jsonb NOT NULL DEFAULT '{}'::jsonb,
      approved_at timestamp,
      approved_by varchar REFERENCES users(id),
      created_by varchar NOT NULL REFERENCES users(id),
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS event_cost_entries (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      budget_id varchar NOT NULL REFERENCES event_budgets(id) ON DELETE CASCADE,
      category text NOT NULL DEFAULT 'outros',
      spent_on date,
      supplier text,
      description text NOT NULL DEFAULT 'Novo lançamento',
      quantity numeric(12, 3) NOT NULL DEFAULT 1,
      unit text NOT NULL DEFAULT 'un',
      unit_value numeric(12, 2) NOT NULL DEFAULT 0,
      is_paid boolean NOT NULL DEFAULT false,
      notes text,
      created_by varchar NOT NULL REFERENCES users(id),
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS event_budgets_event_id_idx ON event_budgets(event_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS event_budgets_created_by_idx ON event_budgets(created_by)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS event_cost_entries_budget_id_idx ON event_cost_entries(budget_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS event_cost_entries_category_idx ON event_cost_entries(category)`);
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE event_budgets ADD CONSTRAINT event_budgets_positive_values_check
        CHECK (
          participants > 0
          AND planned_cost >= 0
          AND planned_price >= 0
          AND target_margin >= 0
          AND (actual_participants IS NULL OR actual_participants > 0)
          AND (revenue_override IS NULL OR revenue_override >= 0)
        );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE event_cost_entries ADD CONSTRAINT event_cost_entries_non_negative_values_check
        CHECK (quantity >= 0 AND unit_value >= 0);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `);
  console.log("[Migrate] Tabelas de orçamentos e custos de eventos verificadas/criadas.");
}