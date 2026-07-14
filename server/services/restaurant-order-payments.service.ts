import { db } from "../db";
import { restaurantOrderPayments } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import type { RestaurantOrderPayment } from "../../shared/schema";

function toCents(value: string | number): number {
  return Math.round(Number(value) * 100);
}

export const restaurantOrderPaymentsService = {
  async listPayments(orderId: string): Promise<RestaurantOrderPayment[]> {
    return db
      .select()
      .from(restaurantOrderPayments)
      .where(eq(restaurantOrderPayments.orderId, orderId))
      .orderBy(restaurantOrderPayments.createdAt);
  },

  async addPayment(
    orderId: string,
    data: {
      method: "pix" | "cartao_credito" | "cartao_debito" | "dinheiro";
      amount: string;
      payerLabel?: string | null;
    },
  ): Promise<RestaurantOrderPayment> {
    const [created] = await db
      .insert(restaurantOrderPayments)
      .values({
        orderId,
        method: data.method,
        amount: data.amount,
        payerLabel: data.payerLabel ?? null,
      })
      .returning();
    return created;
  },

  async removePayment(orderId: string, paymentId: string): Promise<void> {
    await db
      .delete(restaurantOrderPayments)
      .where(
        and(
          eq(restaurantOrderPayments.id, paymentId),
          eq(restaurantOrderPayments.orderId, orderId),
        ),
      );
  },

  async getPaymentsTotalCents(orderId: string): Promise<number> {
    const payments = await this.listPayments(orderId);
    return payments.reduce((sum, p) => sum + toCents(p.amount), 0);
  },
};
