import { Router } from "express";
import { getCategoriesController } from "../controllers/tags/get-categories.controller";
import { getOriginsController } from "../controllers/tags/get-origins.controller";
import { getMarkersController } from "../controllers/tags/get-markers.controller";

/**
 * Router específico para endpoints relacionados a tags
 * Tags incluem: categorias, origens e marcadores
 * Segue padrão RESTful e organiza todas as rotas de tags
 */
export const tagsRouter = Router();

/**
 * @route GET /api/tags/categories
 * @description Busca todas as categorias do sistema
 * @access Private (requer autenticação)
 * @returns {Array} Lista de tags do tipo "categoria"
 *
 * @example Request
 * GET /api/tags/categories
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "cat-id-1",
 *     "name": "VIP",
 *     "type": "categoria",
 *     "createdAt": "2023-01-15T10:30:00.000Z"
 *   },
 *   {
 *     "id": "cat-id-2",
 *     "name": "Premium",
 *     "type": "categoria",
 *     "createdAt": "2023-01-10T14:20:00.000Z"
 *   }
 * ]
 *
 * @notes
 * - Categorias são usadas para classificar clientes
 * - Retorna lista ordenada por data de criação (mais recentes primeiro)
 * - Útil para popular dropdowns e filtros
 */
tagsRouter.get("/categories", getCategoriesController);

/**
 * @route GET /api/tags/origins
 * @description Busca todas as origens do sistema
 * @access Private (requer autenticação)
 * @returns {Array} Lista de tags do tipo "origem"
 *
 * @example Request
 * GET /api/tags/origins
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "origin-id-1",
 *     "name": "Facebook",
 *     "type": "origem",
 *     "createdAt": "2023-01-15T10:30:00.000Z"
 *   },
 *   {
 *     "id": "origin-id-2",
 *     "name": "Instagram",
 *     "type": "origem",
 *     "createdAt": "2023-01-10T14:20:00.000Z"
 *   }
 * ]
 *
 * @notes
 * - Origens indicam de onde o cliente veio (canal de aquisição)
 * - Retorna lista ordenada por data de criação (mais recentes primeiro)
 * - Útil para rastreamento de origem de leads
 */
tagsRouter.get("/origins", getOriginsController);

/**
 * @route GET /api/tags/markers
 * @description Busca todos os marcadores do sistema
 * @access Private (requer autenticação)
 * @returns {Array} Lista de tags do tipo "marcador"
 *
 * @example Request
 * GET /api/tags/markers
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "marker-id-1",
 *     "name": "Urgente",
 *     "type": "marcador",
 *     "createdAt": "2023-01-15T10:30:00.000Z"
 *   },
 *   {
 *     "id": "marker-id-2",
 *     "name": "Follow-up",
 *     "type": "marcador",
 *     "createdAt": "2023-01-10T14:20:00.000Z"
 *   }
 * ]
 *
 * @notes
 * - Marcadores são labels adicionais para organizar clientes
 * - Retorna lista ordenada por data de criação (mais recentes primeiro)
 * - Útil para filtros e organização visual
 */
tagsRouter.get("/markers", getMarkersController);

export default tagsRouter;
