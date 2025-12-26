import { Request, Response } from "express";
import { storage } from "../../storage";
import { insertTagSchema } from "../../../shared/schema";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";

/**
 * @route POST /api/origins
 * @description Cria uma nova origem (tag do tipo "origem")
 * @access Private (requer autenticação)
 * @body {Object} origin - Dados da origem
 * @body {string} origin.name - Nome da origem
 * @body {string} [origin.color] - Cor em hexadecimal (padrão: #6B7280)
 * @returns {Object} Origem criada
 *
 * @example Request
 * POST /api/origins
 * {
 *   "name": "Indicação",
 *   "color": "#3B82F6"
 * }
 *
 * @example Success Response (201)
 * {
 *   "id": "orig-123",
 *   "name": "Indicação",
 *   "type": "origem",
 *   "color": "#3B82F6",
 *   "createdAt": "2025-01-15T10:30:00.000Z"
 * }
 *
 * @example Error Response (400 - Validation Error)
 * {
 *   "message": "Validation error: Name is required at 'name'"
 * }
 *
 * @example Error Response (500)
 * {
 *   "message": "Erro ao criar origem"
 * }
 *
 * @notes
 * - O tipo é fixado automaticamente como "origem"
 * - A cor padrão é #6B7280 (cinza) se não fornecida
 * - Usado para rastrear a fonte de aquisição de clientes
 */
export const createOriginController = async (req: Request, res: Response) => {
  try {
    const originData = {
      name: req.body.name,
      color: req.body.color || "#6B7280",
      type: "origem",
    };

    const validatedData = insertTagSchema.parse(originData);
    const origin = await storage.createTag(validatedData);
    res.status(201).json(origin);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    res.status(500).json({ message: "Erro ao criar origem" });
  }
};
