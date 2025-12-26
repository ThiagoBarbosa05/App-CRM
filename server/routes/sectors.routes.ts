import { Router } from "express";
import {
  getSectorsController,
  createSectorController,
} from "../controllers/sectors/index";

/**
 * Router para operações de setores
 */
export const sectorsRouter = Router();

/**
 * @route GET /api/sectors
 * @description Busca todos os setores do sistema
 * @access Private (requer autenticação)
 * @returns {Array} Lista de setores
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "sector-id-1",
 *     "name": "Vendas",
 *     "createdAt": "2025-12-25T10:00:00.000Z"
 *   },
 *   {
 *     "id": "sector-id-2",
 *     "name": "Marketing",
 *     "createdAt": "2025-12-25T10:00:00.000Z"
 *   }
 * ]
 *
 * @notes
 * - Retorna todos os setores cadastrados
 * - Sem filtros ou paginação
 */
sectorsRouter.get("/sectors", getSectorsController);

/**
 * @route POST /api/sectors
 * @description Cria um novo setor no sistema
 * @access Private (requer autenticação)
 * @body {Object} sector - Dados do setor
 * @body {string} sector.name - Nome do setor (obrigatório)
 * @returns {Object} Setor criado
 *
 * @example Request Body
 * {
 *   "name": "Televendas"
 * }
 *
 * @example Success Response (201)
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440000",
 *   "name": "Televendas",
 *   "createdAt": "2025-01-15T10:30:00.000Z"
 * }
 *
 * @notes
 * - Valida dados com insertSectorSchema
 * - Nome é obrigatório
 * - Retorna erro 400 se validação falhar
 */
sectorsRouter.post("/sectors", createSectorController);
