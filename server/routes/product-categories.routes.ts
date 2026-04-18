import { Router } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { storage } from "../storage";
import { insertProductCategorySchema } from "@shared/schema";

export const productCategoriesRouter = Router();

const DEFAULT_CATEGORIES = ["VINHOS", "RESTAURANTE", "ACESSORIOS", "NATAL", "OUTROS"];

productCategoriesRouter.get("/", async (_req, res) => {
  try {
    const categories = await storage.getProductCategories();

    // Se não há categorias, seed com os padrões
    if (categories.length === 0) {
      for (const name of DEFAULT_CATEGORIES) {
        await storage.createProductCategory({ name });
      }
      return res.json(await storage.getProductCategories());
    }

    return res.json(categories);
  } catch (error) {
    console.error("Error fetching product categories:", error);
    return res.status(500).json({ message: "Erro ao buscar categorias de produto" });
  }
});

productCategoriesRouter.post("/", async (req, res) => {
  try {
    const validated = insertProductCategorySchema.parse(req.body);
    const category = await storage.createProductCategory(validated);
    return res.status(201).json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: fromZodError(error).toString() });
    }
    console.error("Error creating product category:", error);
    return res.status(500).json({ message: "Erro ao criar categoria de produto" });
  }
});

productCategoriesRouter.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const validated = insertProductCategorySchema.partial().parse(req.body);
    const category = await storage.updateProductCategory(id, validated);
    if (!category) {
      return res.status(404).json({ message: "Categoria não encontrada" });
    }
    return res.json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: fromZodError(error).toString() });
    }
    console.error("Error updating product category:", error);
    return res.status(500).json({ message: "Erro ao atualizar categoria de produto" });
  }
});

productCategoriesRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteProductCategory(id);
    if (!success) {
      return res.status(404).json({ message: "Categoria não encontrada" });
    }
    return res.json({ message: "Categoria excluída com sucesso" });
  } catch (error) {
    console.error("Error deleting product category:", error);
    return res.status(500).json({ message: "Erro ao excluir categoria de produto" });
  }
});
