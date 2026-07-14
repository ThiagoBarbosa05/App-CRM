import { db } from "../db";
import { restaurantOrderAuditLog, users } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";
import type { RestaurantOrderAuditLog } from "../../shared/schema";

export interface RestaurantOrderAuditLogWithActor extends RestaurantOrderAuditLog {
  actorName: string;
}

export type OrderAuditAction =
  | "item_cancelado"
  | "desconto_aplicado"
  | "desconto_removido"
  | "itens_transferidos"
  | "mesas_mescladas"
  | "pagamento_solicitado"
  | "pagamento_cancelado"
  | "comanda_fechada";

export const restaurantOrderAuditService = {
  async logOrderAudit(
    orderId: string,
    action: OrderAuditAction,
    actorId: string,
    options?: { reason?: string; metadata?: Record<string, unknown> },
  ): Promise<void> {
    await db.insert(restaurantOrderAuditLog).values({
      orderId,
      action,
      actorId,
      reason: options?.reason ?? null,
      metadata: options?.metadata ?? null,
    });
  },

  async listOrderAudit(orderId: string): Promise<RestaurantOrderAuditLogWithActor[]> {
    const rows = await db
      .select({
        log: restaurantOrderAuditLog,
        actorName: users.name,
      })
      .from(restaurantOrderAuditLog)
      .innerJoin(users, eq(restaurantOrderAuditLog.actorId, users.id))
      .where(eq(restaurantOrderAuditLog.orderId, orderId))
      .orderBy(desc(restaurantOrderAuditLog.createdAt));

    return rows.map((row) => ({ ...row.log, actorName: row.actorName }));
  },
};
