/**
 * Cria a tabela job_runs: histórico de execução dos grupos de jobs agendados
 * (um registro por rodada, ex. grupo "daily-night"), com o resultado de cada
 * job da rodada em `results`.
 *
 * A tabela já existe no banco de produção — foi criada fora do drizzle-kit e
 * não está declarada em shared/schema.ts. Este script é idempotente e serve
 * para provisioná-la em bancos novos (test/staging) sem `db:push`.
 *
 * Uso:
 *   node scripts/create-job-runs-table.mjs
 *
 * Para provisionar o banco de teste em vez do de produção:
 *   DATABASE_URL="$TEST_DATABASE_URL" node scripts/create-job-runs-table.mjs
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
  CREATE TABLE IF NOT EXISTS job_runs (
    id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
    group_name text NOT NULL,
    status text NOT NULL DEFAULT 'running',
    triggered_by text NOT NULL DEFAULT 'schedule',
    started_at timestamp NOT NULL DEFAULT now(),
    finished_at timestamp,
    duration_ms integer,
    jobs_total integer NOT NULL DEFAULT 0,
    jobs_failed integer NOT NULL DEFAULT 0,
    results jsonb,
    error text
  )
`;

await sql`
  CREATE INDEX IF NOT EXISTS job_runs_group_started_idx
    ON job_runs (group_name, started_at DESC)
`;

console.log("[migration] Tabela job_runs criada (ou já existente).");
