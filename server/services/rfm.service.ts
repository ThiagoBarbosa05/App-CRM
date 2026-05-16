import { db } from "server/db";
import { clients } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export type RfmSegment =
  | "campiao"
  | "fiel"
  | "promissor"
  | "em_risco"
  | "perdido"
  | "novo"
  | "hibernando"
  | "sem_compra";

export const RFM_SEGMENT_LABELS: Record<RfmSegment, string> = {
  campiao: "Campeão",
  fiel: "Fiel",
  promissor: "Promissor",
  em_risco: "Em Risco",
  perdido: "Perdido",
  novo: "Novo",
  hibernando: "Hibernando",
  sem_compra: "Sem Compra",
};

export const RFM_SEGMENT_COLORS: Record<RfmSegment, string> = {
  campiao: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  fiel: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  promissor: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  em_risco: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  perdido: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  novo: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  hibernando: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  sem_compra: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

export const RFM_SEGMENT_ORDER: RfmSegment[] = [
  "campiao",
  "fiel",
  "promissor",
  "em_risco",
  "perdido",
  "novo",
  "hibernando",
  "sem_compra",
];

function scoreRecency(daysSinceLast: number | null): number {
  if (daysSinceLast === null) return 0;
  if (daysSinceLast <= 30) return 5;
  if (daysSinceLast <= 90) return 4;
  if (daysSinceLast <= 180) return 3;
  if (daysSinceLast <= 365) return 2;
  return 1;
}

function scoreFrequency(orderCount: number): number {
  if (orderCount === 0) return 0;
  if (orderCount === 1) return 1;
  if (orderCount <= 3) return 2;
  if (orderCount <= 6) return 3;
  if (orderCount <= 12) return 4;
  return 5;
}

function scoreMonetary(totalSpent: number): number {
  if (totalSpent <= 0) return 0;
  if (totalSpent < 300) return 1;
  if (totalSpent < 800) return 2;
  if (totalSpent < 2000) return 3;
  if (totalSpent < 5000) return 4;
  return 5;
}

function assignSegment(r: number, f: number, m: number): RfmSegment {
  if (f === 0) return "sem_compra";
  if (f === 1) return "novo";
  if (r >= 4 && f >= 4 && m >= 4) return "campiao";
  if (r <= 2 && f >= 3 && m >= 3) return "em_risco";
  if (r === 1) return "perdido";
  if (r >= 4 && f >= 2 && m >= 2) return "promissor";
  if (f >= 3 && m >= 3) return "fiel";
  return "hibernando";
}

export interface RfmClientData {
  clientId: string;
  lastPurchaseDate: Date | null;
  orderCount: number;
  totalSpent: number;
  rfmRecency: number;
  rfmFrequency: number;
  rfmMonetary: number;
  rfmSegment: RfmSegment;
}

export async function calculateRfm(): Promise<{ updated: number; summary: Record<string, number> }> {
  // Agrega dados de compras de bling_orders e connect_orders por cliente
  const rows = await db.execute<{
    client_id: string;
    last_purchase_date: string | null;
    order_count: string;
    total_spent: string;
  }>(sql`
    SELECT
      c.id AS client_id,
      MAX(ord.order_date)::text AS last_purchase_date,
      COUNT(ord.order_id)::text AS order_count,
      COALESCE(SUM(ord.total_value), 0)::text AS total_spent
    FROM clients c
    LEFT JOIN (
      SELECT app_client_id, id AS order_id,
             TO_DATE(sale_date, 'YYYY-MM-DD') AS order_date,
             total_value
      FROM bling_orders
      WHERE deleted_at IS NULL AND app_client_id IS NOT NULL
      UNION ALL
      SELECT app_client_id, id AS order_id,
             sale_date::date AS order_date,
             total_value
      FROM connect_orders
      WHERE app_client_id IS NOT NULL
    ) AS ord ON ord.app_client_id = c.id
    GROUP BY c.id
  `);

  const now = new Date();
  const summary: Record<string, number> = {};
  let updated = 0;

  for (const row of rows) {
    const lastDate = row.last_purchase_date ? new Date(row.last_purchase_date) : null;
    const daysSinceLast = lastDate
      ? Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const orderCount = parseInt(row.order_count, 10) || 0;
    const totalSpent = parseFloat(row.total_spent) || 0;

    const r = scoreRecency(daysSinceLast);
    const f = scoreFrequency(orderCount);
    const m = scoreMonetary(totalSpent);
    const segment = assignSegment(r, f, m);

    summary[segment] = (summary[segment] || 0) + 1;

    await db
      .update(clients)
      .set({
        rfmRecency: r,
        rfmFrequency: f,
        rfmMonetary: m,
        rfmSegment: segment,
        rfmCalculatedAt: now,
      })
      .where(eq(clients.id, row.client_id));

    updated++;
  }

  return { updated, summary };
}

export async function getRfmSummary(): Promise<{ segment: string; label: string; count: number; color: string }[]> {
  const rows = await db.execute<{ rfm_segment: string | null; count: string }>(sql`
    SELECT rfm_segment, COUNT(*)::text AS count
    FROM clients
    GROUP BY rfm_segment
  `);

  const result: { segment: string; label: string; count: number; color: string }[] = [];

  for (const seg of RFM_SEGMENT_ORDER) {
    const row = rows.find((r) => r.rfm_segment === seg);
    if (!row && seg === "sem_compra") {
      const nullRow = rows.find((r) => r.rfm_segment === null);
      result.push({
        segment: seg,
        label: RFM_SEGMENT_LABELS[seg],
        count: nullRow ? parseInt(nullRow.count, 10) : 0,
        color: RFM_SEGMENT_COLORS[seg],
      });
    } else {
      result.push({
        segment: seg,
        label: RFM_SEGMENT_LABELS[seg],
        count: row ? parseInt(row.count, 10) : 0,
        color: RFM_SEGMENT_COLORS[seg],
      });
    }
  }

  return result;
}
