import { Request, Response } from "express";
import { storage } from "../../storage";
import { insertTagSchema } from "../../../shared/schema";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";

/**
 * @route POST /api/tags
 * @description Cria uma nova tag no sistema
 * @access Private (apenas usuários autenticados)
 *
 * @body {Object} tag - Dados da tag a ser criada
 * @body {string} tag.name - Nome da tag (obrigatório)
 * @body {string} tag.type - Tipo da tag: categoria, origem ou marcador (obrigatório)
 * @body {string} [tag.color] - Cor da tag em hexadecimal (opcional)
 *
 * @returns {Object} 201 - Tag criada com sucesso
 * @returns {Object} 400 - Erro de validação dos dados
 * @returns {Object} 500 - Erro interno do servidor
 *
 * @example
 * // Request body:
 * {
 *   "name": "Premium",
 *   "type": "categoria",
 *   "color": "#3B82F6"
 * }
 *
 * // Response 201:
 * {
 *   "id": "tag-id-123",
 *   "name": "Premium",
 *   "type": "categoria",
 *   "color": "#3B82F6",
 *   "createdAt": "2025-01-15T10:30:00.000Z"
 * }
 */
export const createTagController = async (req: Request, res: Response) => {
  try {
    const validatedData = insertTagSchema.parse(req.body);
    const tag = await storage.createTag(validatedData);
    res.status(201).json(tag);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    res.status(500).json({ message: "Erro ao criar tag" });
  }
};
