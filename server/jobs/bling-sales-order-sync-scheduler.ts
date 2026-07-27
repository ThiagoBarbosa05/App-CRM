import cron from "node-cron";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "../db";
import { restaurantOrders } from "../../shared/schema";
import { sendOrderToBling } from "../services/bling-sales-order.service";

const MAX_SYNC_ATTEMPTS = 5;

async function retryPendingBlingSyncs(): Promise<void> {
  try {
    const pending = await db
      .select({ id: restaurantOrders.id })
      .from(restaurantOrders)
      .where(
        and(
          eq(restaurantOrders.status, "fechada"),
          inArray(restaurantOrders.blingSyncStatus, ["pendente", "erro"]),
          lt(restaurantOrders.blingSyncAttempts, MAX_SYNC_ATTEMPTS),
        ),
      );

    if (pending.length === 0) return;

    console.log(`[Bling Sales Order Sync] ${pending.length} comanda(s) pendente(s) de envio.`);

    for (const order of pending) {
      await sendOrderToBling(order.id);
    }
  } catch (error) {
    console.error("[Bling Sales Order Sync] Erro na varredura de retry:", error);
  }
}

cron.schedule(
  "*/5 * * * *",
  async () => {
    await retryPendingBlingSyncs();
  },
  {
    timezone: "America/Sao_Paulo",
  },
);

retryPendingBlingSyncs().catch((error) => {
  console.error("[Bling Sales Order Sync] Erro ao iniciar rotina de retry:", error);
});
