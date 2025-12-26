import { Request, Response } from "express";
import { storage } from "../../storage";
import { insertSectorSchema } from "../../../shared/schema";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";

/**
 * @route POST /api/sectors
 * @description Cria um novo setor no sistema
 * @access Private (apenas usuários autenticados)
 *
 * @body {Object} sector - Dados do setor a ser criado
 * @body {string} sector.name - Nome do setor (obrigatório)
 *
 * @returns {Object} 201 - Setor criado com sucesso
 * @returns {Object} 400 - Erro de validação dos dados
 * @returns {Object} 500 - Erro interno do servidor
 *
 * @example
 * // Request body:
 * {
 *   "name": "Televendas"
 * }
 *
 * // Response 201:
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "name": "Televendas",
 *   "createdAt": "2025-01-15T10:30:00.000Z"
 * }
 */
export const createSectorController = async (req: Request, res: Response) => {
  try {
    const validatedData = insertSectorSchema.parse(req.body);
    const sector = await storage.createSector(validatedData);
    res.status(201).json(sector);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    res.status(500).json({ message: "Erro ao criar setor" });
  }
};
