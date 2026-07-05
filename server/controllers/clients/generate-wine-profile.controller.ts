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
        totalValue: p.totalValue,
        aiProfile: info?.aiProfile ?? null,
      };
    });

    // Distribuição real por tipo (base: quantidade de garrafas em todo o mix de compras)
    console.log("[WineProfile] productMix items:", JSON.stringify(insights.productMix.map(p => ({ id: p.productId, desc: p.description, qty: p.totalQuantity }))));
    console.log("[WineProfile] productInfo keys:", Object.keys(productInfo));
    const typeTotals = new Map<string, number>();
    let totalQuantity = 0;
    for (const item of insights.productMix) {
      if (item.totalQuantity <= 0) continue;
      const info = item.productId ? productInfo[item.productId] : undefined;
      const tipo = info?.type ?? "OUTROS";
      console.log(`[WineProfile] item="${item.description}" productId=${item.productId} info=${JSON.stringify(info)} tipo=${tipo}`);
      typeTotals.set(tipo, (typeTotals.get(tipo) ?? 0) + item.totalQuantity);
      totalQuantity += item.totalQuantity;
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

    const aiProfile = await generateClientWineProfile(client.name, productsForAI);
    const wineProfile = { ...aiProfile, distribuicao_tipos: distribuicaoTipos };

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
