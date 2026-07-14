import { eq, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { restaurantMenuItems } from "../../shared/schema";
import { decryptToken } from "../lib/token-crypto";
import { getBlingProdutos } from "../integrations/bling";
import { blingConnectionsService } from "./bling-connections.service";
import { TokenBucket } from "../lib/token-bucket";

export interface RestaurantMenuSyncResult {
  created: number;
  updated: number;
  skipped: number;
  total: number;
}

export async function syncMenuFromBling(
  connectionId: string,
  createdBy: string,
): Promise<RestaurantMenuSyncResult> {
  const connection = await blingConnectionsService.getById(connectionId);

  if (!connection) {
    throw new Error("Conexao Bling nao encontrada");
  }

  if (connection.status !== "connected") {
    throw new Error("Conexao Bling nao esta conectada. Reconecte a conta antes de sincronizar.");
  }

  if (!connection.accessTokenEncrypted) {
    throw new Error("Token de acesso da conexao Bling esta ausente");
  }

  let accessToken = decryptToken(connection.accessTokenEncrypted);

  const onTokenRefresh = async (): Promise<string> => {
    await blingConnectionsService.refreshConnection(connectionId);
    const refreshed = await blingConnectionsService.getById(connectionId);
    if (!refreshed?.accessTokenEncrypted) {
      throw new Error("Nao foi possivel obter o novo token apos refresh");
    }
    accessToken = decryptToken(refreshed.accessTokenEncrypted);
    return accessToken;
  };

  const existingItems = await db
    .select({
      id: restaurantMenuItems.id,
      blingProductId: restaurantMenuItems.blingProductId,
    })
    .from(restaurantMenuItems)
    .where(isNotNull(restaurantMenuItems.blingProductId));

  const itemsByBlingId = new Map<string, string>();
  for (const item of existingItems) {
    if (item.blingProductId) itemsByBlingId.set(item.blingProductId, item.id);
  }

  // Bling allows up to 3 req/s. Capacity=1 ensures every request waits ~333ms.
  const rateLimiter = new TokenBucket(1, 3);

  let page = 1;
  const LIMIT = 100;
  let created = 0;
  let updated = 0;
  let skipped = 0;

  while (true) {
    await rateLimiter.consume();
    const blingProducts = await getBlingProdutos(accessToken, page, LIMIT, onTokenRefresh);

    if (blingProducts.length === 0) break;

    for (const product of blingProducts) {
      if (product.situacao !== "Ativo") {
        skipped++;
        continue;
      }

      const blingIdStr = String(product.id);
      const price = (product.preco ?? 0).toFixed(2);
      const existingId = itemsByBlingId.get(blingIdStr);

      if (existingId) {
        await db
          .update(restaurantMenuItems)
          .set({ name: product.nome, price, updatedAt: new Date() })
          .where(eq(restaurantMenuItems.id, existingId));
        updated++;
      } else {
        const [inserted] = await db
          .insert(restaurantMenuItems)
          .values({
            name: product.nome,
            price,
            category: null,
            isActive: true,
            blingProductId: blingIdStr,
            createdBy,
          })
          .returning({ id: restaurantMenuItems.id });

        if (inserted) itemsByBlingId.set(blingIdStr, inserted.id);
        created++;
      }
    }

    if (blingProducts.length < LIMIT) break;
    page++;
  }

  return { created, updated, skipped, total: created + updated + skipped };
}
