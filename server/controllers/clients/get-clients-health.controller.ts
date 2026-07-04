import { Request, Response } from "express";
import { db } from "../../db";
import { sql } from "drizzle-orm";

export const getClientsHealthController = async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string | undefined;
    const userRole = req.query.userRole as string | undefined;
    const days = parseInt(req.query.purchaseStatusDays as string ?? "60", 10);

    const isVendedor =
      userRole === "vendedor" && userId;

    const roleFilter = isVendedor
      ? sql`AND c.responsavel_id = ${userId}`
      : sql``;

    const result = await db.execute(sql`
      WITH client_purchases AS (
        SELECT app_client_id, MAX(sale_date)::date AS last_purchase
        FROM (
          SELECT app_client_id, sale_date::date AS sale_date
          FROM bling_orders
          WHERE deleted_at IS NULL AND app_client_id IS NOT NULL
          UNION ALL
          SELECT app_client_id, sale_date::date AS sale_date
          FROM connect_orders
          WHERE app_client_id IS NOT NULL
        ) p
        GROUP BY app_client_id
      ),
      client_stats AS (
        SELECT
          c.id,
          cp.last_purchase,
          CASE
            WHEN cp.last_purchase >= CURRENT_DATE - (${days} || ' days')::INTERVAL THEN 'active'
            ELSE 'inactive'
          END AS purchase_status,
          CASE
            WHEN (c.phone IS NULL OR c.phone = '')
              OR (c.cpf IS NULL OR c.cpf = '')
              OR (c.birthday IS NULL OR c.birthday = '')
              OR (c.email IS NULL OR c.email = '')
            THEN 1 ELSE 0
          END AS is_incomplete
        FROM clients c
        LEFT JOIN client_purchases cp ON c.id = cp.app_client_id
        WHERE 1=1 ${roleFilter}
      )
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN purchase_status = 'active' THEN 1 ELSE 0 END)::int AS active,
        SUM(CASE WHEN purchase_status = 'inactive' OR last_purchase IS NULL THEN 1 ELSE 0 END)::int AS inactive,
        SUM(is_incomplete)::int AS incomplete
      FROM client_stats
    `);

    const row = result.rows[0] as {
      total: number;
      active: number;
      inactive: number;
      incomplete: number;
    };

    return res.json({
      total: row.total ?? 0,
      active: row.active ?? 0,
      inactive: row.inactive ?? 0,
      incomplete: row.incomplete ?? 0,
    });
  } catch (error) {
    console.error("Erro no getClientsHealthController:", error);
    return res.status(500).json({ message: "Erro ao buscar saúde da carteira" });
  }
};
