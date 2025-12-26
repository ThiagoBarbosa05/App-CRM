import { Request, Response } from "express";
import { storage } from "../../storage";
import { insertTagSchema } from "../../../shared/schema";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";

/**
 * @route PUT /api/categories/:id
 * @description Atualiza uma categoria existente
 * @access Private (apenas usuários autenticados)
 *
 * @param {string} id - ID da categoria a ser atualizada
 * @body {Object} category - Dados da categoria
 * @body {string} [category.name] - Nome da categoria (opcional)
 * @body {string} [category.color] - Cor da categoria em hexadecimal (opcional, padrão: #6B7280)
 *
 * @returns {Object} 200 - Categoria atualizada com sucesso
 * @returns {Object} 400 - Erro de validação dos dados
 * @returns {Object} 404 - Categoria não encontrada
 * @returns {Object} 500 - Erro interno do servidor
 *
 * @example
 * // Request:
 * PUT /api/categories/cat-123
 *
 * // Request body:
 * {
 *   "name": "VIP Premium",
 *   "color": "#FF5733"
 * }
 *
 * // Response 200:
 * {
 *   "id": "cat-123",
 *   "name": "VIP Premium",
 *   "type": "categoria",
 *   "color": "#FF5733",
 *   "updatedAt": "2025-01-15T10:30:00.000Z"
 * }
 *
 * @notes
 * - O tipo permanece sempre como "categoria"
 * - Cor padrão é #6B7280 (cinza) se não fornecida
 * - Atualização parcial é suportada
 */
export const updateCategoryController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const categoryData = {
      name: req.body.name,
      color: req.body.color || "#6B7280",
      type: "categoria",
    };

    const validatedData = insertTagSchema.parse(categoryData);
    const category = await storage.updateTag(id, validatedData);
    res.json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    res.status(500).json({ message: "Erro ao atualizar categoria" });
  }
};
