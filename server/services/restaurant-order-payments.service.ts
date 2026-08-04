import { db } from "../db";
import { restaurantOrderPayments } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import type { RestaurantOrderPayment } from "../../shared/schema";
import { toCents, fromCents } from "../../shared/restaurant-order-totals";

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
      method: "pix" | "cartao_credito" | "cartao_debito" | "dinheiro" | "outros";
      amount: string;
      payerLabel?: string | null;
      blingPaymentMethodId?: string | null;
      blingPaymentMethodDescription?: string | null;
    },
  ): Promise<RestaurantOrderPayment> {
    // `amount` vinha do cliente e era gravado cru. A coluna é `numeric`, que no
    // Postgres aceita `'NaN'` — e `'NaN' > 0` é verdadeiro, então nem um CHECK
    // no banco pegaria. `toCents` recusa NaN, vazio e texto; aqui sobra barrar
    // zero e negativo, que são numeric perfeitamente válidos.
    const amountCents = toCents(data.amount);
    if (amountCents <= 0) {
      throw Object.assign(
        new Error("O valor do pagamento deve ser maior que zero"),
        { code: "INVALID_AMOUNT" },
      );
    }

    const [created] = await db
      .insert(restaurantOrderPayments)
      .values({
        orderId,
        method: data.method,
        amount: fromCents(amountCents),
        payerLabel: data.payerLabel ?? null,
        blingPaymentMethodId: data.blingPaymentMethodId ?? null,
        blingPaymentMethodDescription: data.blingPaymentMethodDescription ?? null,
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
