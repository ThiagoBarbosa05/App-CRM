import { db } from "../db";
import { sql } from "drizzle-orm";
import {
  getClientRegistrationQuality,
  type ClientRegistrationQuality,
} from "@shared/client-registration-quality";

export interface RegistrationQualityCandidate {
  id: string;
  name: string;
  phone: string | null;
  cpf: string | null;
  birthday: string | null;
  email: string | null;
  responsavelId: string | null;
  responsavelName: string | null;
  orderCount: number;
  totalSpent: number;
  lastPurchaseDate: string | null;
  registrationQuality: ClientRegistrationQuality;
  /** true quando o cliente compra bem ou com frequência (RFM frequency/monetary >= 3). */
  isPriority: boolean;
}

type CandidateRow = {
  id: string;
  name: string;
  phone: string | null;
  cpf: string | null;
  birthday: string | null;
  email: string | null;
  responsavel_id: string | null;
  responsavel_name: string | null;
  rfm_frequency: number;
  rfm_monetary: number;
  order_count: string;
  total_spent: string;
  last_purchase_date: string | null;
};

/**
 * Todos os clientes com cadastro incompleto (registrationQuality.score <=
 * maxQualityScore), sem exigir histórico de compra. Ordenado por prioridade:
 * primeiro quem compra bem ou com frequência (RFM frequency/monetary >= 3,
 * na escala 0-5 de rfm.service.ts) — dentro de cada grupo, por valor gasto
 * desc — e só depois os demais clientes da base, também por valor gasto.
 */
export async function getClientsNeedingRegistrationUpdate(params: {
  responsavelId?: string;
  maxQualityScore?: number;
}): Promise<RegistrationQualityCandidate[]> {
  const { responsavelId, maxQualityScore = 3 } = params;

  const result = await db.execute<CandidateRow>(sql`
    SELECT
      c.id, c.name, c.phone, c.cpf, c.birthday, c.email,
      c.responsavel_id,
      u.name AS responsavel_name,
      COALESCE(c.rfm_frequency, 0) AS rfm_frequency,
      COALESCE(c.rfm_monetary, 0) AS rfm_monetary,
      COALESCE(p.order_count, 0)::text AS order_count,
      COALESCE(p.total_spent, 0)::text AS total_spent,
      p.last_purchase_date::text AS last_purchase_date
    FROM clients c
    LEFT JOIN users u ON u.id = c.responsavel_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) AS order_count,
        SUM(o.total_value) AS total_spent,
        MAX(o.order_date) AS last_purchase_date
      FROM (
        SELECT total_value, TO_DATE(sale_date, 'YYYY-MM-DD') AS order_date
        FROM bling_orders
        WHERE deleted_at IS NULL AND app_client_id = c.id
        UNION ALL
        SELECT total_value, sale_date::date AS order_date
        FROM connect_orders
        WHERE app_client_id = c.id
      ) o
    ) p ON true
    ${responsavelId ? sql`WHERE c.responsavel_id = ${responsavelId}` : sql``}
  `);

  return result.rows
    .map((row): RegistrationQualityCandidate => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      cpf: row.cpf,
      birthday: row.birthday,
      email: row.email,
      responsavelId: row.responsavel_id,
      responsavelName: row.responsavel_name,
      orderCount: parseInt(row.order_count, 10) || 0,
      totalSpent: parseFloat(row.total_spent) || 0,
      lastPurchaseDate: row.last_purchase_date,
      registrationQuality: getClientRegistrationQuality(row),
      isPriority: row.rfm_frequency >= 3 || row.rfm_monetary >= 3,
    }))
    .filter((candidate) => candidate.registrationQuality.score <= maxQualityScore)
    .sort((a, b) => {
      if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
      return b.totalSpent - a.totalSpent;
    });
}
