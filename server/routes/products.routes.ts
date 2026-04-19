import { Router } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

import { storage } from "../storage";
import { insertProductSchema } from "@shared/schema";

export const productsRouter = Router();
export const companyProductsRouter = Router();

productsRouter.get("/", async (req, res) => {
  try {
    const { name, type, country, volume, category } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const filters = {
      name: name as string | undefined,
      type: type as string | undefined,
      country: country as string | undefined,
      volume: volume as string | undefined,
      category: category as string | undefined,
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

productsRouter.post("/", async (req, res) => {
  try {
    const userId = req.user!.userId;

    const productData = {
      ...req.body,
      createdBy: userId,
    };

    const validatedData = insertProductSchema.parse(productData);
    const product = await storage.createProduct(validatedData);
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

productsRouter.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = insertProductSchema.partial().parse(req.body);
    const product = await storage.updateProduct(id, validatedData);
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

productsRouter.delete("/:id", async (req, res) => {
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

productsRouter.get("/:productId/companies", async (req, res) => {
  try {
    const { productId } = req.params;
    console.log(`API: Fetching companies for product ${productId}`);
    const companiesWithProduct = await storage.getCompaniesWithProduct(productId);
    console.log(
      `API: Found ${companiesWithProduct.length} companies for product ${productId}`,
    );
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
    console.log("Fetching products statistics...");
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

      console.log("Atualizando preço:", {
        companyId,
        productId,
        customPrice,
      });

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

      console.log("Preço atualizado com sucesso:", result);
      return res.json({ message: "Preço atualizado com sucesso", data: result });
    } catch (error) {
      console.error("Erro ao atualizar preço customizado:", error);
      return res.status(500).json({ message: "Erro interno do servidor" });
    }
  },
);

export default productsRouter;
