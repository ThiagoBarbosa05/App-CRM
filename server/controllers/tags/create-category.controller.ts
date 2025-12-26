import { Request, Response } from "express";
import { storage } from "../../storage";
import { insertTagSchema } from "../../../shared/schema";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";

/**
 * @route POST /api/categories
 * @description Cria uma nova categoria no sistema
 * @access Private (apenas usuários autenticados)
 *
 * @body {Object} category - Dados da categoria a ser criada
 * @body {string} category.name - Nome da categoria (obrigatório)
 * @body {string} [category.color] - Cor da categoria em hexadecimal (opcional, padrão: #6B7280)
 *
 * @returns {Object} 201 - Categoria criada com sucesso
 * @returns {Object} 400 - Erro de validação dos dados
 * @returns {Object} 500 - Erro interno do servidor
 *
 * @example
 * // Request body:
 * {
 *   "name": "Premium",
 *   "color": "#3B82F6"
 * }
 *
 * // Response 201:
 * {
 *   "id": "cat-id-123",
 *   "name": "Premium",
 *   "type": "categoria",
 *   "color": "#3B82F6",
 *   "createdAt": "2025-01-15T10:30:00.000Z"
 * }
 *
 * @notes
 * - O tipo é automaticamente definido como "categoria"
 * - Cor padrão é #6B7280 (cinza) se não fornecida
 * - Usado para classificar clientes no sistema
 */
export const createCategoryController = async (req: Request, res: Response) => {
  try {
    const categoryData = {
      name: req.body.name,
      color: req.body.color || "#6B7280",
      type: "categoria",
    };

    const validatedData = insertTagSchema.parse(categoryData);
    const category = await storage.createTag(validatedData);
    res.status(201).json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    res.status(500).json({ message: "Erro ao criar categoria" });
  }
};
