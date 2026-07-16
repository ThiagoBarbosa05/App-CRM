import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

import { storage } from "../storage";
import {
  insertProductSchema,
  products,
  systemSettings,
  blingProductMappings,
  companyProducts,
  blingOrderItems,
} from "@shared/schema";
import { generateWineProductProfile } from "../ai-helpers";
import { db } from "../db";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/validation";

async function getWineAIInstructions(): Promise<string | null> {
  try {
    const [row] = await db
      .select({ value: systemSettings.value })
      .from(systemSettings)
      .where(eq(systemSettings.key, "wine_ai_profile_instructions"));
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export const productsRouter = Router();
export const companyProductsRouter = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Acesso restrito a administradores" });
  }
  return next();
}

productsRouter.get("/", async (req, res) => {
  try {
    const { name, type, country, volume, category, connectionId } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const filters = {
      name: name as string | undefined,
      type: type as string | undefined,
      country: country as string | undefined,
      volume: volume as string | undefined,
      category: category as string | undefined,
      connectionId: connectionId as string | undefined,
    };

    const { data, total } = await storage.getProducts(filters, page, pageSize);

    return res.json({
      data,
      currentPage: page,
      totalPages: Math.ceil(total / pageSize),
      totalItems: total,
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    return res.status(500).json({ message: "Erro ao buscar produtos" });
  }
});

async function triggerAIProfileGeneration(product: { id: string; name: string; type?: string | null; country?: string | null; volume?: string | null; category?: string }) {
  try {
    const instructions = await getWineAIInstructions();
    const profile = await generateWineProductProfile(product, instructions);
    await storage.updateProduct(product.id, {
      aiProfile: profile,
      aiProfileGeneratedAt: new Date(),
    });
  } catch (err) {
    console.error(`AI profile generation failed for product ${product.id}:`, err);
  }
}

productsRouter.post("/", requireAdmin, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const productData = {
      ...req.body,
      createdBy: userId,
    };

    const validatedData = insertProductSchema.parse(productData);
    const product = await storage.createProduct(validatedData);

    // Gerar perfil IA em background
    triggerAIProfileGeneration(product);

    return res.status(201).json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Error creating product:", error);
    return res.status(500).json({ message: "Erro ao criar produto" });
  }
});

const bulkUpdateProductsSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1).max(200),
  updates: insertProductSchema
    .pick({ category: true, country: true, volume: true, type: true, winery: true })
    .partial()
    .refine((u) => Object.values(u).some((v) => v !== undefined && v !== null), {
      message: "Informe ao menos um campo para alterar",
    }),
});

// GET /duplicates — agrupa produtos com mesmo nome normalizado (case-insensitive, trim)
productsRouter.get("/duplicates", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        p.id,
        p.name,
        p.type,
        p.country,
        p.volume,
        p.image_url        AS "imageUrl",
        p.negotiated_price AS "negotiatedPrice",
        p.created_at       AS "createdAt",
        lower(trim(p.name)) AS normalized_name,
        (SELECT COUNT(*) FROM bling_product_mappings bpm WHERE bpm.product_id = p.id)::int AS mapping_count,
        (SELECT COUNT(*) FROM bling_order_items     boi WHERE boi.product_id  = p.id)::int AS order_count,
        (SELECT COUNT(*) FROM company_products       cp  WHERE cp.product_id   = p.id)::int AS company_count
      FROM products p
      WHERE p.deleted_at IS NULL
      ORDER BY lower(trim(p.name)), p.created_at ASC
    `);

    const groupsMap = new Map<string, object[]>();
    for (const row of rows.rows as Record<string, unknown>[]) {
      const key = row.normalized_name as string;
      if (!groupsMap.has(key)) groupsMap.set(key, []);
      groupsMap.get(key)!.push(row);
    }

    const duplicateGroups = Array.from(groupsMap.entries())
      .filter(([, prods]) => prods.length >= 2)
      .map(([key, prods]) => ({ key, products: prods }));

    return res.json(duplicateGroups);
  } catch (error) {
    console.error("[GET /products/duplicates]", error);
    return res.status(500).json({ message: "Erro ao buscar duplicatas de produtos" });
  }
});

// POST /:productId/merge/:duplicateId — mescla duplicata no produto canônico
productsRouter.post("/:productId/merge/:duplicateId", requireAuth, requireAdmin, async (req, res) => {
  const { productId, duplicateId } = req.params;

  if (productId === duplicateId) {
    return res.status(400).json({ message: "Produto principal e duplicata não podem ser iguais" });
  }

  try {
    const [[canonical], [duplicate]] = await Promise.all([
      db.select({ id: products.id }).from(products).where(and(eq(products.id, productId), isNull(products.deletedAt))).limit(1),
      db.select({ id: products.id }).from(products).where(and(eq(products.id, duplicateId), isNull(products.deletedAt))).limit(1),
    ]);

    if (!canonical) return res.status(404).json({ message: "Produto principal não encontrado" });
    if (!duplicate) return res.status(404).json({ message: "Produto duplicado não encontrado" });

    // 1. Reatribui blingProductMappings → produto canônico
    await db.update(blingProductMappings)
      .set({ productId })
      .where(eq(blingProductMappings.productId, duplicateId));

    // 2. Reatribui companyProducts → produto canônico
    //    Remove conflitos (empresa já tem o produto canônico) antes de atualizar
    const existingCos = await db
      .select({ companyId: companyProducts.companyId })
      .from(companyProducts)
      .where(eq(companyProducts.productId, productId));

    if (existingCos.length > 0) {
      await db.delete(companyProducts).where(
        and(
          eq(companyProducts.productId, duplicateId),
          inArray(companyProducts.companyId, existingCos.map((r) => r.companyId)),
        ),
      );
    }
    await db.update(companyProducts)
      .set({ productId })
      .where(eq(companyProducts.productId, duplicateId));

    // 3. Reatribui blingOrderItems → produto canônico
    await db.update(blingOrderItems)
      .set({ productId })
      .where(eq(blingOrderItems.productId, duplicateId));

    // 4. Soft-delete da duplicata
    await db.update(products)
      .set({ deletedAt: new Date() })
      .where(eq(products.id, duplicateId));

    return res.json({ success: true });
  } catch (error) {
    console.error("[POST /products/merge]", error);
    return res.status(500).json({ message: "Erro ao mesclar produtos" });
  }
});

// POST /batch-merge — unifica N produtos em um canônico (admin)
productsRouter.post("/batch-merge", requireAuth, requireAdmin, async (req, res) => {
  const schema = z.object({
    canonicalId: z.string().min(1),
    duplicateIds: z.array(z.string().min(1)).min(1).max(50),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: fromZodError(parsed.error).toString() });
  }

  const { canonicalId, duplicateIds } = parsed.data;

  if (duplicateIds.includes(canonicalId)) {
    return res.status(400).json({ message: "O produto principal não pode estar na lista de duplicatas" });
  }

  try {
    // Valida que o produto canônico existe
    const [canonical] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, canonicalId), isNull(products.deletedAt)))
      .limit(1);
    if (!canonical) return res.status(404).json({ message: "Produto principal não encontrado" });

    // Valida que todos os duplicados existem
    const existingDuplicates = await db
      .select({ id: products.id })
      .from(products)
      .where(and(inArray(products.id, duplicateIds), isNull(products.deletedAt)));
    const foundIds = new Set(existingDuplicates.map((r) => r.id));
    const missing = duplicateIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      return res.status(404).json({ message: `Produto(s) não encontrado(s): ${missing.join(", ")}` });
    }

    // Para cada duplicata: reatribui vínculos e soft-delete
    for (const duplicateId of duplicateIds) {
      // 1. blingProductMappings
      await db.update(blingProductMappings)
        .set({ productId: canonicalId })
        .where(eq(blingProductMappings.productId, duplicateId));

      // 2. companyProducts (com deduplicação)
      const existingCos = await db
        .select({ companyId: companyProducts.companyId })
        .from(companyProducts)
        .where(eq(companyProducts.productId, canonicalId));
      if (existingCos.length > 0) {
        await db.delete(companyProducts).where(
          and(
            eq(companyProducts.productId, duplicateId),
            inArray(companyProducts.companyId, existingCos.map((r) => r.companyId)),
          ),
        );
      }
      await db.update(companyProducts)
        .set({ productId: canonicalId })
        .where(eq(companyProducts.productId, duplicateId));

      // 3. blingOrderItems
      await db.update(blingOrderItems)
        .set({ productId: canonicalId })
        .where(eq(blingOrderItems.productId, duplicateId));

      // 4. Soft-delete da duplicata
      await db.update(products)
        .set({ deletedAt: new Date() })
        .where(eq(products.id, duplicateId));
    }

    return res.json({ success: true, merged: duplicateIds.length });
  } catch (error) {
    console.error("[POST /products/batch-merge]", error);
    return res.status(500).json({ message: "Erro ao unificar produtos" });
  }
});

// Edição em massa (somente admin). Não regenera perfis de IA para evitar
// centenas de chamadas à OpenAI em uma única operação.
productsRouter.patch("/bulk-update", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { productIds, updates } = bulkUpdateProductsSchema.parse(req.body);

    const updated = await db
      .update(products)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(inArray(products.id, productIds), isNull(products.deletedAt)))
      .returning({ id: products.id });

    return res.json({ updated: updated.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Error bulk updating products:", error);
    return res.status(500).json({ message: "Erro ao atualizar produtos em massa" });
  }
});

productsRouter.put("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = insertProductSchema.partial().parse(req.body);
    const product = await storage.updateProduct(id, validatedData);

    // Regenerar perfil IA em background se mudou nome, tipo ou país
    if (validatedData.name || validatedData.type || validatedData.country) {
      const detail = await storage.getProductById(id);
      if (detail) triggerAIProfileGeneration(detail);
    }

    return res.json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Error updating product:", error);
    return res.status(500).json({ message: "Erro ao atualizar produto" });
  }
});

productsRouter.post("/:productId/generate-ai-profile", async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await storage.getProductById(productId);
    if (!product) return res.status(404).json({ message: "Produto não encontrado" });

    const instructions = await getWineAIInstructions();
    const profile = await generateWineProductProfile(product, instructions);
    await storage.updateProduct(productId, {
      aiProfile: profile,
      aiProfileGeneratedAt: new Date(),
    });

    return res.json({ profile, generatedAt: new Date() });
  } catch (error) {
    console.error("Error generating AI profile:", error);
    return res.status(500).json({ message: "Erro ao gerar perfil IA" });
  }
});

productsRouter.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteProduct(id);
    if (!success) {
      return res.status(404).json({ message: "Produto não encontrado" });
    }
    return res.json({ message: "Produto excluído com sucesso" });
  } catch (error) {
    console.error("Error deleting product:", error);
    return res.status(500).json({ message: "Erro ao excluir produto" });
  }
});

productsRouter.get("/:productId/buyers", async (req, res) => {
  try {
    const { productId } = req.params;
    const buyers = await storage.getProductAllBuyers(productId);
    return res.json(buyers);
  } catch (error) {
    console.error("Error fetching product buyers:", error);
    return res.status(500).json({ message: "Erro ao buscar compradores" });
  }
});

productsRouter.get("/:productId/detail", async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await storage.getProductById(productId);
    if (!product) return res.status(404).json({ message: "Produto não encontrado" });
    return res.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    return res.status(500).json({ message: "Erro ao buscar produto" });
  }
});

productsRouter.get("/:productId/profile", async (req, res) => {
  try {
    const { productId } = req.params;
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const profile = await storage.getProductProfile(productId, startDate, endDate);
    return res.json(profile);
  } catch (error) {
    console.error("Error fetching product profile:", error);
    return res.status(500).json({ message: "Erro ao buscar perfil do produto" });
  }
});

productsRouter.get("/:productId/companies", async (req, res) => {
  try {
    const { productId } = req.params;
    const companiesWithProduct = await storage.getCompaniesWithProduct(productId);
    return res.json(companiesWithProduct);
  } catch (error) {
    console.error("Error fetching companies with product:", error);
    return res
      .status(500)
      .json({ message: "Erro ao buscar empresas com o produto" });
  }
});

productsRouter.get("/statistics", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const statistics = await storage.getProductsStatistics(
      startDate as string | undefined,
      endDate as string | undefined,
    );

    return res.json(statistics);
  } catch (error) {
    console.error("Error fetching products statistics:", error);
    return res.status(500).json({ message: "Erro ao buscar estatísticas dos produtos" });
  }
});

companyProductsRouter.get("/companies/:companyId/products", async (req, res) => {
  try {
    const { companyId } = req.params;
    const products = await storage.getCompanyProducts(companyId);
    return res.json(products);
  } catch (error) {
    console.error("Error fetching company products:", error);
    return res.status(500).json({ message: "Erro ao buscar carta de vinhos" });
  }
});

companyProductsRouter.get(
  "/companies/:companyId/available-products",
  async (req, res) => {
    try {
      const { companyId } = req.params;
      const products = await storage.getAvailableProductsForCompany(companyId);
      return res.json(products);
    } catch (error) {
      console.error("Error fetching available products:", error);
      return res.status(500).json({ message: "Erro ao buscar produtos disponíveis" });
    }
  },
);

companyProductsRouter.post("/companies/:companyId/products", async (req, res) => {
  try {
    const { companyId } = req.params;
    const { productId } = req.body;
    const userId = req.user!.userId;

    const companyProduct = await storage.addProductToCompany({
      companyId,
      productId,
      addedBy: userId,
      isActive: "true",
    });

    return res.status(201).json(companyProduct);
  } catch (error) {
    console.error("Error adding product to company:", error);
    if (
      error instanceof Error &&
      error.message === "Produto já vinculado a esta empresa"
    ) {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: "Erro ao adicionar produto à carta" });
  }
});

companyProductsRouter.delete(
  "/companies/:companyId/products/:productId",
  async (req, res) => {
    const { companyId, productId } = req.params;

    try {
      await storage.removeProductFromCompany(companyId, productId);
      return res.json({ message: "Product removed from company wine list" });
    } catch (error) {
      console.error("Error removing product from company:", error);
      return res
        .status(500)
        .json({ error: "Failed to remove product from company" });
    }
  },
);

companyProductsRouter.put(
  "/companies/:companyId/products/:productId/price",
  async (req, res) => {
    try {
      const { companyId, productId } = req.params;
      const { customPrice } = req.body;

      if (!companyId || !productId) {
        return res
          .status(400)
          .json({ message: "CompanyId e ProductId são obrigatórios" });
      }

      if (!customPrice || customPrice === "" || isNaN(parseFloat(customPrice))) {
        return res.status(400).json({ message: "Preço inválido" });
      }

      const numericPrice = parseFloat(customPrice);
      if (numericPrice < 0) {
        return res.status(400).json({ message: "Preço não pode ser negativo" });
      }

      const result = await storage.updateCompanyProductPrice(
        companyId,
        productId,
        numericPrice.toString(),
      );

      if (!result) {
        return res
          .status(404)
          .json({ message: "Produto não encontrado na carta da empresa" });
      }

      return res.json({ message: "Preço atualizado com sucesso", data: result });
    } catch (error) {
      console.error("Erro ao atualizar preço customizado:", error);
      return res.status(500).json({ message: "Erro interno do servidor" });
    }
  },
);

export default productsRouter;
