import { Request, Response } from "express";
import { storage } from "../../storage";
import { insertTagSchema } from "../../../shared/schema";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";

/**
 * @route POST /api/markers
 * @description Cria um novo marcador (tag do tipo "marcador")
 * @access Private (requer autenticação)
 * @body {Object} marker - Dados do marcador
 * @body {string} marker.name - Nome do marcador
 * @body {string} [marker.color] - Cor em hexadecimal (padrão: #6B7280)
 * @returns {Object} Marcador criado
 *
 * @example Request
 * POST /api/markers
 * {
 *   "name": "Urgente",
 *   "color": "#EF4444"
 * }
 *
 * @example Success Response (201)
 * {
 *   "id": "mark-123",
 *   "name": "Urgente",
 *   "type": "marcador",
 *   "color": "#EF4444",
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
 *   "message": "Erro ao criar marcador"
 * }
 *
 * @notes
 * - O tipo é fixado automaticamente como "marcador"
 * - A cor padrão é #6B7280 (cinza) se não fornecida
 * - Usado para etiquetar e classificar clientes com marcadores visuais
 */
export const createMarkerController = async (req: Request, res: Response) => {
  try {
    const markerData = {
      name: req.body.name,
      color: req.body.color || "#6B7280",
      type: "marcador",
    };

    const validatedData = insertTagSchema.parse(markerData);
    const marker = await storage.createTag(validatedData);
    res.status(201).json(marker);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    res.status(500).json({ message: "Erro ao criar marcador" });
  }
};
