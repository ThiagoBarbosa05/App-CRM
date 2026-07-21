/**
 * Cria a estrutura de caixa do PDV Restaurante:
 *   - restaurant_cash_sessions  — sessão de caixa (abertura, fechamento, conferência)
 *   - restaurant_cash_movements — sangria e suprimento durante o turno
 *   - restaurant_orders.cash_session_id — vínculo da comanda com a sessão
 *
 * A comanda é vinculada no FECHAMENTO, não na abertura: a receita pertence ao
 * caixa que recebeu o dinheiro. A coluna é nullable de propósito — comandas
 * anteriores ao caixa ficam nulas e não há backfill (inventar sessões que não
 * existiram seria pior que admitir a lacuna).
 *
 * Idempotente: pode rodar mais de uma vez.
 *
 * Uso:
 *   node scripts/create-restaurant-cash-session-tables.mjs
 */
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Defina DATABASE_URL no .env");
  process.exit(1);
}

const sql = neon(url);

await sql`
  CREATE SEQUENCE IF NOT EXISTS restaurant_cash_sessions_session_number_seq
`;

await sql`
  CREATE TABLE IF NOT EXISTS restaurant_cash_sessions (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    session_number integer NOT NULL DEFAULT nextval('restaurant_cash_sessions_session_number_seq'),
    status text NOT NULL DEFAULT 'aberto',
    opened_by varchar NOT NULL REFERENCES users(id),
    opened_at timestamp NOT NULL DEFAULT now(),
    opening_float numeric(10, 2) NOT NULL DEFAULT 0.00,
    closed_by varchar REFERENCES users(id),
    closed_at timestamp,
    expected_cash numeric(10, 2),
    counted_cash numeric(10, 2),
    difference numeric(10, 2),
    summary jsonb,
    notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )
`;

await sql`
  ALTER SEQUENCE restaurant_cash_sessions_session_number_seq
    OWNED BY restaurant_cash_sessions.session_number
`;

await sql`
  CREATE INDEX IF NOT EXISTS restaurant_cash_sessions_status_idx
    ON restaurant_cash_sessions (status)
`;

// Uma sessão aberta por vez — no banco, não na aplicação. Duas aberturas
// simultâneas viram erro de constraint em vez de dois caixas abertos.
await sql`
  CREATE UNIQUE INDEX IF NOT EXISTS restaurant_cash_sessions_single_open
    ON restaurant_cash_sessions ((status)) WHERE status = 'aberto'
`;

await sql`
  CREATE TABLE IF NOT EXISTS restaurant_cash_movements (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id varchar NOT NULL REFERENCES restaurant_cash_sessions(id),
    type text NOT NULL,
    amount numeric(10, 2) NOT NULL,
    reason text NOT NULL,
    actor_id varchar NOT NULL REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now()
  )
`;

await sql`
  CREATE INDEX IF NOT EXISTS restaurant_cash_movements_session_idx
    ON restaurant_cash_movements (session_id)
`;

await sql`
  ALTER TABLE restaurant_orders
    ADD COLUMN IF NOT EXISTS cash_session_id varchar REFERENCES restaurant_cash_sessions(id)
`;

await sql`
  CREATE INDEX IF NOT EXISTS restaurant_orders_cash_session_idx
    ON restaurant_orders (cash_session_id)
`;

console.log(
  "[migration] Estrutura de caixa criada: restaurant_cash_sessions, restaurant_cash_movements e restaurant_orders.cash_session_id (ou já existentes).",
);
