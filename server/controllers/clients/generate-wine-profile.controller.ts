import { Request, Response } from "express";
import { db } from "../../db";
import { clients, products } from "@shared/schema";
import { and, eq, gte, inArray, isNull, lte, notInArray, sql } from "drizzle-orm";
import { clientPurchaseInsightsService } from "../../services/client-purchase-insights.service";
import { generateClientWineProfile, WineAIProfile } from "../../ai-helpers";
import { storage } from "../../storage";

interface SuggestedWine {
  id: string;
  name: string;
  type: string | null;
  country: string | null;
  negotiatedPrice: string;
}

const PRODUCT_TYPES = ["ESPUMANTE", "BRANCO", "ROSE", "TINTO", "PÓS-REFEIÇÃO"] as const;
type ProductType = (typeof PRODUCT_TYPES)[number];

function asProductType(value: string | null): ProductType | null {
  return value && (PRODUCT_TYPES as readonly string[]).includes(value) ? (value as ProductType) : null;
}

async function findSuggestedWines(
  preferredTypeInput: string | null,
  priceRange: { min: number; max: number } | null,
  excludeProductIds: string[],
): Promise<SuggestedWine[]> {
  const preferredType = asProductType(preferredTypeInput);
  const baseConditions = [isNull(products.deletedAt)];
  if (excludeProductIds.length > 0) {
    baseConditions.push(notInArray(products.id, excludeProductIds));
  }

  const runQuery = (withType: boolean, withPriceRange: boolean) => {
    const conditions = [...baseConditions];
    if (withType && preferredType) conditions.push(eq(products.type, preferredType));
    if (withPriceRange && priceRange) {
      conditions.push(gte(sql`${products.negotiatedPrice}::numeric`, priceRange.min * 0.6));
      conditions.push(lte(sql`${products.negotiatedPrice}::numeric`, priceRange.max * 1.4));
    }
    return db
      .select({
        id: products.id,
        name: products.name,
        type: products.type,
        country: products.country,
        negotiatedPrice: products.negotiatedPrice,
      })
      .from(products)
      .where(and(...conditions))
      .orderBy(sql`RANDOM()`)
      .limit(2);
  };

  let results = await runQuery(true, true);
  if (results.length < 2) results = await runQuery(true, false);
  if (results.length < 2) results = await runQuery(false, false);
  return results;
}

export const generateWineProfileController = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;

    const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!client) return res.status(404).json({ message: "Cliente não encontrado" });

    if (client.wineProfileGeneratedAt && Date.now() - new Date(client.wineProfileGeneratedAt).getTime() < 30_000) {
      return res.status(429).json({ message: "Perfil gerado há poucos segundos. Aguarde antes de gerar novamente." });
    }

    const insights = await clientPurchaseInsightsService.getInsights({ clientId, historyLimit: 50 });

    if (insights.linkStatus === "unlinked" || insights.productMix.length === 0) {
      return res.status(400).json({ message: "Cliente sem histórico de compras suficiente para gerar perfil" });
    }

    const topProducts = insights.productMix
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);

    const internalProductIds = insights.productMix
      .map((p) => p.productId)
      .filter((id): id is string => !!id);

    const productInfo: Record<string, { type: string | null; country: string | null; aiProfile: WineAIProfile | null }> = {};
    if (internalProductIds.length > 0) {
      const dbProducts = await db
        .select({
          id: products.id,
          type: products.type,
          country: products.country,
          aiProfile: products.aiProfile,
        })
        .from(products)
        .where(inArray(products.id, internalProductIds));

      for (const p of dbProducts) {
        productInfo[p.id] = {
          type: p.type,
          country: p.country,
          aiProfile: (p.aiProfile as WineAIProfile | null) ?? null,
        };
      }
    }

    const productsForAI = topProducts.map((p) => {
      const info = p.productId ? productInfo[p.productId] : undefined;
      return {
        name: p.description,
        type: info?.type ?? null,
        country: info?.country ?? null,
        quantity: p.totalQuantity,
        unitPrice: p.totalQuantity > 0 ? p.totalValue / p.totalQuantity : 0,
        aiProfile: info?.aiProfile ?? null,
      };
    });

    // Distribuição real por tipo (base: quantidade de garrafas em todo o mix de compras)
    const typeTotals = new Map<string, number>();
    let totalQuantity = 0;
    // Preço unitário real (base: R$/garrafa de cada item do mix, não o valor total gasto no produto)
    let minUnitPrice = Infinity;
    let maxUnitPrice = -Infinity;
    for (const item of insights.productMix) {
      if (item.totalQuantity <= 0) continue;
      const info = item.productId ? productInfo[item.productId] : undefined;
      const tipo = info?.type ?? "OUTROS";
      typeTotals.set(tipo, (typeTotals.get(tipo) ?? 0) + item.totalQuantity);
      totalQuantity += item.totalQuantity;

      const unitPrice = item.totalValue / item.totalQuantity;
      if (unitPrice < minUnitPrice) minUnitPrice = unitPrice;
      if (unitPrice > maxUnitPrice) maxUnitPrice = unitPrice;
    }
    const distribuicaoTipos =
      totalQuantity > 0
        ? Array.from(typeTotals.entries())
            .map(([tipo, quantidade]) => ({
              tipo,
              quantidade,
              percentual: Math.round((quantidade / totalQuantity) * 1000) / 10,
            }))
            .sort((a, b) => b.quantidade - a.quantidade)
        : [];
    const faixaDePrecoReal =
      totalQuantity > 0
        ? { min: Math.round(minUnitPrice * 100) / 100, max: Math.round(maxUnitPrice * 100) / 100 }
        : null;

    const aiProfile = await generateClientWineProfile(client.name, productsForAI);

    const preferredType = distribuicaoTipos[0]?.tipo ?? aiProfile.tipos_preferidos[0] ?? null;
    const vinhosSugeridos = await findSuggestedWines(
      preferredType,
      faixaDePrecoReal ?? aiProfile.faixa_de_preco,
      internalProductIds,
    );

    const wineProfile = {
      ...aiProfile,
      // Sobrescreve a estimativa da IA com a faixa real de preço unitário (R$/garrafa) do histórico
      faixa_de_preco: faixaDePrecoReal ?? aiProfile.faixa_de_preco,
      distribuicao_tipos: distribuicaoTipos,
      vinhos_sugeridos: vinhosSugeridos,
    };

    const generatedAt = new Date();
    await storage.updateClient(clientId, {
      wineProfile,
      wineProfileGeneratedAt: generatedAt,
    });

    return res.json({ profile: wineProfile, generatedAt });
  } catch (error) {
    console.error("Error generating client wine profile:", error);
    return res.status(500).json({ message: "Erro ao gerar perfil de gosto" });
  }
};
