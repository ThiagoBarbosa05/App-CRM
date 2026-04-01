import { eq } from "drizzle-orm";
import { db } from "../db";
import { products } from "../../shared/schema";
import { decryptToken } from "../lib/token-crypto";
import { getBlingProdutos } from "../integrations/bling";
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

function normalizeTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

function jaccardScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  return intersection / Math.max(setA.size, setB.size);
}

interface AppProduct {
  id: string;
  name: string;
  tokens: string[];
}

function findBestMatch(blingName: string, appProducts: AppProduct[]): AppProduct | null {
  const blingTokens = normalizeTokens(blingName);
  let bestScore = 0;
  let bestMatch: AppProduct | null = null;

  for (const product of appProducts) {
    const score = jaccardScore(blingTokens, product.tokens);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = product;
    }
  }

  return bestScore >= 0.5 ? bestMatch : null;
}

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

  // Load all app products into memory for matching
  const rawProducts = await db
    .select({ id: products.id, name: products.name, blingProductId: products.blingProductId })
    .from(products);
  const appProducts: AppProduct[] = rawProducts.map((p) => ({
    id: p.id,
    name: p.name,
    tokens: normalizeTokens(p.name),
  }));

  onProgress({ type: "start" });

  let page = 1;
  const LIMIT = 100;
  let linked = 0;
  let updated = 0;
  let created = 0;
  let skipped = 0;
  let processed = 0;

  while (true) {
    if (signal?.aborted) break;

    const blingProducts = await getBlingProdutos(accessToken, page, LIMIT, onTokenRefresh);

    if (blingProducts.length === 0) break;

    for (const blingProduct of blingProducts) {
      if (signal?.aborted) break;

      const match = findBestMatch(blingProduct.nome, appProducts);

      if (match) {
        const existing = rawProducts.find((p) => p.id === match.id);
        const wasAlreadyLinked = existing?.blingProductId != null;

        await db
          .update(products)
          .set({
            blingProductId: String(blingProduct.id),
            ...(blingProduct.preco > 0 ? { negotiatedPrice: blingProduct.preco.toFixed(2) } : {}),
            updatedAt: new Date(),
          })
          .where(eq(products.id, match.id));

        if (wasAlreadyLinked) {
          updated++;
        } else {
          linked++;
        }
      } else {
        // No match — create a new product with the user-defined defaults
        const [inserted] = await db
          .insert(products)
          .values({
            name: blingProduct.nome,
            country: defaults.country as "CHILE" | "ARGENTINA" | "URUGUAI" | "BRASIL" | "EUA" | "FRANÇA" | "ITÁLIA" | "PORTUGAL" | "ESPANHA" | "ALEMANHA" | "OUTROS",
            volume: defaults.volume as "187ml" | "375ml" | "750ml" | "1500ml",
            type: defaults.type as "ESPUMANTE" | "BRANCO" | "ROSE" | "TINTO" | "PÓS-REFEIÇÃO",
            negotiatedPrice: blingProduct.preco.toFixed(2),
            createdBy: defaults.createdBy,
            blingProductId: String(blingProduct.id),
          })
          .returning({ id: products.id, name: products.name });

        // Add the new product to the in-memory list so duplicate Bling names don't create duplicates
        if (inserted) {
          appProducts.push({ id: inserted.id, name: inserted.name, tokens: normalizeTokens(inserted.name) });
          rawProducts.push({ id: inserted.id, name: inserted.name, blingProductId: String(blingProduct.id) });
        }

        created++;
      }

      processed++;
    }

    onProgress({ type: "progress", page, processed, linked, updated, created, skipped });

    if (blingProducts.length < LIMIT) break;
    page++;
  }

  onProgress({ type: "done", linked, updated, created, skipped });
}
