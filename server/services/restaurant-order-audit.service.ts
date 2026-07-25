import { db } from "../db";
import { restaurantOrderAuditLog, users } from "../../shared/schema";
import { eq, desc } from "drizzle-orm";
import type { RestaurantOrderAuditLog } from "../../shared/schema";
import type { DbExecutor } from "../db";

export interface RestaurantOrderAuditLogWithActor extends RestaurantOrderAuditLog {
  actorName: string;
}

/**
 * Derivado do schema em vez de reescrito: esta lista já existiu como união
 * literal própria e saiu de sincronia com `restaurantOrderAuditLog.action`,
 * fazendo ação válida no banco não compilar aqui.
 */
export type OrderAuditAction = RestaurantOrderAuditLog["action"];

export const restaurantOrderAuditService = {
  async logOrderAudit(
    orderId: string,
    action: OrderAuditAction,
    actorId: string,
    options?: {
      reason?: string;
      metadata?: Record<string, unknown>;
      /** Transação do chamador — o log precisa cair junto se ela reverter. */
      tx?: DbExecutor;
    },
  ): Promise<void> {
    await (options?.tx ?? db).insert(restaurantOrderAuditLog).values({
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
