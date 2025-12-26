import { Request, Response } from "express";
import { storage } from "../../storage";
import { insertTagSchema } from "../../../shared/schema";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";

/**
 * @route PUT /api/markers/:id
 * @description Atualiza um marcador existente
 * @access Private (requer autenticação)
 * @param {string} id - ID do marcador
 * @body {Object} marker - Dados do marcador
 * @body {string} [marker.name] - Nome do marcador (opcional)
 * @body {string} [marker.color] - Cor em hexadecimal (opcional)
 * @returns {Object} Marcador atualizado
 *
 * @example Request
 * PUT /api/markers/mark-123
 * {
 *   "name": "Muito Urgente",
 *   "color": "#DC2626"
 * }
 *
 * @example Success Response (200)
 * {
 *   "id": "mark-123",
 *   "name": "Muito Urgente",
 *   "type": "marcador",
 *   "color": "#DC2626",
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
 *   "message": "Erro ao atualizar marcador"
 * }
 *
 * @notes
 * - O tipo permanece sempre como "marcador"
 * - Atualização parcial é suportada
 * - A cor padrão é #6B7280 (cinza) se não fornecida
 */
export const updateMarkerController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const markerData = {
      name: req.body.name,
      color: req.body.color || "#6B7280",
      type: "marcador",
    };

    const validatedData = insertTagSchema.parse(markerData);
    const marker = await storage.updateTag(id, validatedData);
    res.json(marker);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    res.status(500).json({ message: "Erro ao atualizar marcador" });
  }
};
