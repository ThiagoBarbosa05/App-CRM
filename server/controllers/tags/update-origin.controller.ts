import { Request, Response } from "express";
import { storage } from "../../storage";
import { insertTagSchema } from "../../../shared/schema";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";

/**
 * @route PUT /api/origins/:id
 * @description Atualiza uma origem existente
 * @access Private (requer autenticação)
 * @param {string} id - ID da origem
 * @body {Object} origin - Dados da origem
 * @body {string} [origin.name] - Nome da origem (opcional)
 * @body {string} [origin.color] - Cor em hexadecimal (opcional)
 * @returns {Object} Origem atualizada
 *
 * @example Request
 * PUT /api/origins/orig-123
 * {
 *   "name": "Referência Premium",
 *   "color": "#10B981"
 * }
 *
 * @example Success Response (200)
 * {
 *   "id": "orig-123",
 *   "name": "Referência Premium",
 *   "type": "origem",
 *   "color": "#10B981",
 *   "updatedAt": "2025-01-15T10:30:00.000Z"
 * }
 *
 * @example Error Response (400 - Validation Error)
 * {
 *   "message": "Validation error: Invalid color format at 'color'"
 * }
 *
 * @example Error Response (500)
 * {
 *   "message": "Erro ao atualizar origem"
 * }
 *
 * @notes
 * - O tipo permanece sempre como "origem"
 * - Atualização parcial é suportada
 * - A cor padrão é #6B7280 (cinza) se não fornecida
 */
export const updateOriginController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const originData = {
      name: req.body.name,
      color: req.body.color || "#6B7280",
      type: "origem",
    };

    const validatedData = insertTagSchema.parse(originData);
    const origin = await storage.updateTag(id, validatedData);
    res.json(origin);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    res.status(500).json({ message: "Erro ao atualizar origem" });
  }
};
