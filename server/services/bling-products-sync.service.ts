import { eq } from "drizzle-orm";
import { db } from "../db";
import { products } from "../../shared/schema";
import { decryptToken } from "../lib/token-crypto";
import { getBlingProdutos, getBlingProduto } from "../integrations/bling";
import { blingConnectionsService } from "./bling-connections.service";

export type SyncProgressEvent =
  | { type: "start" }
  | { type: "progress"; page: number; processed: number; linked: number; updated: number; created: number; skipped: number }
  | { type: "done"; linked: number; updated: number; created: number; skipped: number }
  | { type: "error"; message: string };

export interface ProductDefaults {
  country: string;
  volume: string;
  type: string;
  createdBy: string;
}

/**
 * Token bucket rate limiter.
 * Allows up to `capacity` burst requests, then throttles to `ratePerSecond` req/s.
 */
class TokenBucket {
  private tokens: number;
  private lastRefillAt: number;
  private readonly refillRatePerMs: number;

  constructor(
    private readonly capacity: number,
    ratePerSecond: number,
  ) {
    this.tokens = capacity;
    this.lastRefillAt = Date.now();
    this.refillRatePerMs = ratePerSecond / 1000;
  }

  async consume(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait for one token to become available
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRatePerMs);
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    return this.consume();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefillAt;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRatePerMs);
    this.lastRefillAt = now;
  }
}

type ProductCountry = "CHILE" | "ARGENTINA" | "URUGUAI" | "BRASIL" | "EUA" | "FRANÇA" | "ITÁLIA" | "PORTUGAL" | "ESPANHA" | "ALEMANHA" | "OUTROS";
type ProductVolume = "187ml" | "375ml" | "750ml" | "1500ml";
type ProductType = "ESPUMANTE" | "BRANCO" | "ROSE" | "TINTO" | "PÓS-REFEIÇÃO";

export async function syncBlingProducts(
  connectionId: string,
  userId: string,
  defaults: ProductDefaults,
  onProgress: (event: SyncProgressEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const connection = await blingConnectionsService.getById(connectionId, userId);

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
    await blingConnectionsService.refreshConnection(connectionId, userId);
    const refreshed = await blingConnectionsService.getById(connectionId, userId);
    if (!refreshed?.accessTokenEncrypted) {
      throw new Error("Nao foi possivel obter o novo token apos refresh");
    }
    accessToken = decryptToken(refreshed.accessTokenEncrypted);
    return accessToken;
  };

  // Load all app products indexed by blingProductId for O(1) lookup
  const rawProducts = await db
    .select({ id: products.id, name: products.name, blingProductId: products.blingProductId })
    .from(products);

  const productsByBlingId = new Map<string, { id: string; name: string }>();
  for (const p of rawProducts) {
    if (p.blingProductId) {
      productsByBlingId.set(p.blingProductId, { id: p.id, name: p.name });
    }
  }

  onProgress({ type: "start" });

  // Bling allows up to 3 req/s. The bucket starts full (burst of 3) and refills at 3/s.
  const rateLimiter = new TokenBucket(3, 3);

  let page = 1;
  const LIMIT = 100;
  const linked = 0;
  let updated = 0;
  let created = 0;
  let skipped = 0;
  let processed = 0;

  const defaultCountry = (defaults.country || "OUTROS") as ProductCountry;
  const defaultVolume = defaults.volume as ProductVolume;
  const defaultType = (defaults.type || "OUTROS") as ProductType;

  while (true) {
    if (signal?.aborted) break;

    await rateLimiter.consume();
    const blingProductList = await getBlingProdutos(accessToken, page, LIMIT, onTokenRefresh);

    if (blingProductList.length === 0) break;

    for (const summary of blingProductList) {
      if (signal?.aborted) break;

      // Fetch full product details to get midia.imagens.internas
      await rateLimiter.consume();
      const blingProduct = await getBlingProduto(accessToken, summary.id, onTokenRefresh);

      const blingIdStr = String(blingProduct.id);
      const imageUrl = blingProduct.midia?.imagens?.internas?.[0]?.link ?? null;
      const preco = blingProduct.preco ?? 0;

      const existing = productsByBlingId.get(blingIdStr);

      if (existing) {
        await db
          .update(products)
          .set({
            ...(preco > 0 ? { negotiatedPrice: preco.toFixed(2) } : {}),
            ...(imageUrl ? { imageUrl } : {}),
            updatedAt: new Date(),
          })
          .where(eq(products.id, existing.id));

        updated++;
      } else {
        const [inserted] = await db
          .insert(products)
          .values({
            name: blingProduct.nome ?? summary.nome,
            country: defaultCountry,
            volume: defaultVolume,
            type: defaultType,
            negotiatedPrice: preco.toFixed(2),
            createdBy: defaults.createdBy,
            blingProductId: blingIdStr,
            ...(imageUrl ? { imageUrl } : {}),
          })
          .returning({ id: products.id, name: products.name });

        if (inserted) {
          productsByBlingId.set(blingIdStr, { id: inserted.id, name: inserted.name });
        }

        created++;
      }

      processed++;
    }

    onProgress({ type: "progress", page, processed, linked, updated, created, skipped });

    if (blingProductList.length < LIMIT) break;
    page++;
  }

  onProgress({ type: "done", linked, updated, created, skipped });
}
