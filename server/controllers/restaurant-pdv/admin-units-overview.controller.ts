import { Request, Response } from "express";
import { db } from "../../db";
import {
  pdvUnits,
  restaurantCashSessions,
  restaurantOrders,
  restaurantOrderItems,
  restaurantTables,
  users,
} from "@shared/schema";
import { eq, inArray, and, sql } from "drizzle-orm";

export const adminUnitsOverviewController = async (req: Request, res: Response) => {
  try {
    const allUnits = await db
      .select()
      .from(pdvUnits)
      .where(eq(pdvUnits.isActive, true))
      .orderBy(pdvUnits.name);

    if (allUnits.length === 0) {
      return res.json([]);
    }

    const unitIds = allUnits.map((u) => u.id);

    const [openSessions, openOrders, tableCounts] = await Promise.all([
      db
        .select({
          id: restaurantCashSessions.id,
          unitId: restaurantCashSessions.unitId,
          openedAt: restaurantCashSessions.openedAt,
          status: restaurantCashSessions.status,
        })
        .from(restaurantCashSessions)
        .where(
          and(
            eq(restaurantCashSessions.status, "aberto"),
            inArray(restaurantCashSessions.unitId, unitIds),
          ),
        ),

      db
        .select({
          id: restaurantOrders.id,
          tableNumber: restaurantOrders.tableNumber,
          tableId: restaurantOrders.tableId,
          peopleCount: restaurantOrders.peopleCount,
          clientName: restaurantOrders.clientName,
          openedAt: restaurantOrders.openedAt,
          paymentRequestedAt: restaurantOrders.paymentRequestedAt,
          waiterId: restaurantOrders.waiterId,
          unitId: restaurantOrders.unitId,
          waiterName: users.name,
        })
        .from(restaurantOrders)
        .leftJoin(users, eq(restaurantOrders.waiterId, users.id))
        .where(
          and(
            eq(restaurantOrders.status, "aberta"),
            inArray(restaurantOrders.unitId, unitIds),
          ),
        )
        .orderBy(restaurantOrders.tableNumber),

      db
        .select({
          unitId: restaurantTables.unitId,
          total: sql<number>`COUNT(*)`.mapWith(Number),
        })
        .from(restaurantTables)
        .where(
          and(
            eq(restaurantTables.isActive, true),
            inArray(restaurantTables.unitId, unitIds),
          ),
        )
        .groupBy(restaurantTables.unitId),
    ]);

    const orderIds = openOrders.map((o) => o.id);
    let subtotalMap: Record<string, { subtotal: number; itemCount: number }> = {};

    if (orderIds.length > 0) {
      const subtotals = await db
        .select({
          orderId: restaurantOrderItems.orderId,
          subtotal: sql<number>`SUM(${restaurantOrderItems.unitPrice}::numeric * ${restaurantOrderItems.quantity})`.mapWith(Number),
          itemCount: sql<number>`COUNT(*)`.mapWith(Number),
        })
        .from(restaurantOrderItems)
        .where(
          and(
            inArray(restaurantOrderItems.orderId, orderIds),
            eq(restaurantOrderItems.status, "ativo"),
          ),
        )
        .groupBy(restaurantOrderItems.orderId);

      for (const row of subtotals) {
        subtotalMap[row.orderId] = { subtotal: row.subtotal, itemCount: row.itemCount };
      }
    }

    const sessionByUnit: Record<string, (typeof openSessions)[number]> = {};
    for (const s of openSessions) {
      if (s.unitId) sessionByUnit[s.unitId] = s;
    }

    const ordersByUnit: Record<string, typeof openOrders> = {};
    for (const o of openOrders) {
      if (!o.unitId) continue;
      if (!ordersByUnit[o.unitId]) ordersByUnit[o.unitId] = [];
      ordersByUnit[o.unitId].push(o);
    }

    const tableCountByUnit: Record<string, number> = {};
    for (const tc of tableCounts) {
      if (tc.unitId) tableCountByUnit[tc.unitId] = tc.total;
    }

    const overview = allUnits.map((unit) => {
      const session = sessionByUnit[unit.id] ?? null;
      const orders = (ordersByUnit[unit.id] ?? []).map((o) => ({
        id: o.id,
        tableNumber: o.tableNumber,
        tableId: o.tableId,
        peopleCount: o.peopleCount,
        clientName: o.clientName,
        openedAt: o.openedAt,
        paymentRequestedAt: o.paymentRequestedAt,
        waiterId: o.waiterId,
        waiterName: o.waiterName,
        itemCount: subtotalMap[o.id]?.itemCount ?? 0,
        subtotal: subtotalMap[o.id]?.subtotal ?? 0,
      }));

      return {
        unit,
        cashSession: session,
        openOrders: orders,
        stats: {
          totalTables: tableCountByUnit[unit.id] ?? 0,
          occupiedTables: orders.length,
          cashStatus: session ? "aberto" : "fechado",
        },
      };
    });

    return res.json(overview);
  } catch (error) {
    console.error("[Admin Overview] Erro:", error);
    return res.status(500).json({ message: "Erro ao buscar visão geral das unidades" });
  }
};
