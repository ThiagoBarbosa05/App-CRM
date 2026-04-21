import { Request, Response } from "express";
import { db } from "../../db";
import { clients, products } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { clientPurchaseInsightsService } from "../../services/client-purchase-insights.service";
import { generateClientWineProfile, WineAIProfile } from "../../ai-helpers";
import { storage } from "../../storage";

export const generateWineProfileController = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;

    const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!client) return res.status(404).json({ message: "Cliente não encontrado" });

    const insights = await clientPurchaseInsightsService.getInsights({ clientId, historyLimit: 50 });

    if (insights.linkStatus === "unlinked" || insights.productMix.length === 0) {
      return res.status(400).json({ message: "Cliente sem histórico de compras suficiente para gerar perfil" });
    }

    const topProducts = insights.productMix
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);

    const blingProductIds = topProducts
      .map((p) => p.productId)
      .filter((id): id is string => !!id);

    let productProfiles: Record<string, WineAIProfile> = {};
    if (blingProductIds.length > 0) {
      const dbProducts = await db
        .select({ blingProductId: products.blingProductId, aiProfile: products.aiProfile })
        .from(products)
        .where(inArray(products.blingProductId, blingProductIds));

      for (const p of dbProducts) {
        if (p.blingProductId && p.aiProfile) {
          productProfiles[p.blingProductId] = p.aiProfile as WineAIProfile;
        }
      }
    }

    const productsForAI = topProducts.map((p) => ({
      name: p.description,
      type: null,
      country: null,
      quantity: p.totalQuantity,
      totalValue: p.totalValue,
      aiProfile: p.productId ? (productProfiles[p.productId] ?? null) : null,
    }));

    const wineProfile = await generateClientWineProfile(client.name, productsForAI);

    await storage.updateClient(clientId, {
      wineProfile,
      wineProfileGeneratedAt: new Date(),
    } as any);

    return res.json({ profile: wineProfile, generatedAt: new Date() });
  } catch (error) {
    console.error("Error generating client wine profile:", error);
    return res.status(500).json({ message: "Erro ao gerar perfil de gosto" });
  }
};
