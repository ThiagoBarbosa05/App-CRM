import cron from "node-cron";
import { and, eq, inArray, isNull, lt, or } from "drizzle-orm";
import { db } from "../db";
import { restaurantOrders } from "../../shared/schema";
import {
  MAX_SYNC_ATTEMPTS,
  sendOrderToBling,
} from "../services/bling-sales-order.service";

async function retryPendingBlingSyncs(): Promise<void> {
  try {
    const pending = await db
      .select({ id: restaurantOrders.id })
      .from(restaurantOrders)
      .where(
        and(
          eq(restaurantOrders.status, "fechada"),
          // NULL entra junto: `closeOrder` agora carimba 'pendente', mas
          // qualquer caminho futuro que feche sem carimbar deixaria a comanda
          // fora da fila em silêncio — foi exatamente esse o bug.
          or(
            inArray(restaurantOrders.blingSyncStatus, ["pendente", "erro"]),
            isNull(restaurantOrders.blingSyncStatus),
          ),
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
