import type { Request, Response } from "express";
import { eq, sql } from "drizzle-orm";

import { db } from "../../db";
import { blingOrderItems, blingOrders } from "@shared/schema";

export async function getSalesReportsController(_req: Request, res: Response) {
  try {
    const salesReport = await db
      .select({
        id: blingOrders.id,
        saleDate: blingOrders.saleDate,
        totalValue: blingOrders.totalValue,
        sellerName: blingOrders.sellerName,
        contactName: blingOrders.contactName,
        accountName: blingOrders.accountName,
        items: sql<
          Array<{
            productName: string;
            quantity: number;
            unitPrice: number;
          }>
        >`ARRAY_AGG(
            JSON_BUILD_OBJECT(
              'productName', ${blingOrderItems.description},
              'quantity', ${blingOrderItems.quantity},
              'unitPrice', ${blingOrderItems.value}
            )
          )`.as("items"),
      })
      .from(blingOrders)
      .leftJoin(blingOrderItems, eq(blingOrders.id, blingOrderItems.orderId))
      .groupBy(blingOrders.id);

    return res.json(salesReport);
  } catch (error) {
    console.error("Erro ao gerar relatório de vendas:", error);
    return res.status(500).json({ message: "Erro ao gerar relatório de vendas" });
  }
}
