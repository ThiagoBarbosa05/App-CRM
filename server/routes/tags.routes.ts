import { Router } from "express";
import { getCategoriesController } from "../controllers/tags/get-categories.controller";
import { getOriginsController } from "../controllers/tags/get-origins.controller";
import { getMarkersController } from "../controllers/tags/get-markers.controller";
import {
  getTagsController,
  createTagController,
  createCategoryController,
  updateCategoryController,
  deleteCategoryController,
  createOriginController,
  updateOriginController,
  deleteOriginController,
  createMarkerController,
  updateMarkerController,
  deleteMarkerController,
  createCountryController,
  updateCountryController,
  deleteCountryController,
} from "../controllers/tags/index";
import { getCountriesController } from "../controllers/tags/get-countries.controller";

/**
 * Router específico para endpoints relacionados a tags
 * Tags incluem: categorias, origens e marcadores
 * Segue padrão RESTful e organiza todas as rotas de tags
 */
const tagsRouter = Router();

/**
 * Router para operações CRUD de categorias
 * Montado em /api/categories
 */
const categoriesRouter = Router();

/**
 * Router para operações CRUD de origens
 * Montado em /api/origins
 */
const originsRouter = Router();

/**
 * Router para operações CRUD de marcadores
 * Montado em /api/markers
 */
const markersRouter = Router();

/**
 * @route GET /api/tags
 * @description Busca todas as tags do sistema
 * @access Private (requer autenticação)
 * @returns {Array} Lista de todas as tags
 *
 * @example Request
 * GET /api/tags
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "tag-id-1",
 *     "name": "Premium",
 *     "type": "categoria",
 *     "color": "#3B82F6",
 *     "createdAt": "2025-01-15T10:30:00.000Z"
 *   },
 *   {
 *     "id": "tag-id-2",
 *     "name": "Indicação",
 *     "type": "origem",
 *     "color": "#10B981",
 *     "createdAt": "2025-01-15T10:30:00.000Z"
 *   }
 * ]
 *
 * @notes
 * - Retorna todas as tags independente do tipo
 * - Tipos incluem: categoria, origem, marcador
 * - Sem filtros ou paginação
 */
tagsRouter.get("/tags", getTagsController);

/**
 * @route POST /api/tags
 * @description Cria uma nova tag no sistema
 * @access Private (requer autenticação)
 * @body {Object} tag - Dados da tag
 * @body {string} tag.name - Nome da tag (obrigatório)
 * @body {string} tag.type - Tipo: categoria, origem ou marcador (obrigatório)
 * @body {string} [tag.color] - Cor em hexadecimal (opcional)
 * @returns {Object} Tag criada
 *
 * @example Request Body
 * {
 *   "name": "Premium",
 *   "type": "categoria",
 *   "color": "#3B82F6"
 * }
 *
 * @example Success Response (201)
 * {
 *   "id": "tag-id-123",
 *   "name": "Premium",
 *   "type": "categoria",
 *   "color": "#3B82F6",
 *   "createdAt": "2025-01-15T10:30:00.000Z"
 * }
 *
 * @notes
 * - Valida dados com insertTagSchema
 * - Tipos válidos: categoria, origem, marcador
 * - Retorna erro 400 se validação falhar
 */
tagsRouter.post("/tags", createTagController);

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

/**
 * @route POST /api/categories
 * @description Cria uma nova categoria no sistema
 * @access Private (requer autenticação)
 * @body {Object} category - Dados da categoria
 * @body {string} category.name - Nome da categoria (obrigatório)
 * @body {string} [category.color] - Cor em hexadecimal (opcional, padrão: #6B7280)
 * @returns {Object} Categoria criada
 *
 * @example Request Body
 * {
 *   "name": "Premium",
 *   "color": "#3B82F6"
 * }
 *
 * @example Success Response (201)
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
 * - Usado para classificar clientes
 */
categoriesRouter.post("/", createCategoryController);

/**
 * @route PUT /api/categories/:id
 * @description Atualiza uma categoria existente
 * @access Private (requer autenticação)
 * @param {string} id - ID da categoria
 * @body {Object} category - Dados da categoria
 * @body {string} [category.name] - Nome da categoria (opcional)
 * @body {string} [category.color] - Cor em hexadecimal (opcional)
 * @returns {Object} Categoria atualizada
 *
 * @example Request
 * PUT /api/categories/cat-123
 * {
 *   "name": "VIP Premium",
 *   "color": "#FF5733"
 * }
 *
 * @example Success Response (200)
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
 * - Atualização parcial é suportada
 */
categoriesRouter.put("/:id", updateCategoryController);

/**
 * @route DELETE /api/categories/:id
 * @description Exclui uma categoria existente
 * @access Private (requer autenticação)
 * @param {string} id - ID da categoria
 * @returns {Object} Confirmação de exclusão
 *
 * @example Request
 * DELETE /api/categories/cat-123
 *
 * @example Success Response (200)
 * {
 *   "success": true
 * }
 *
 * @notes
 * - Remove permanentemente a categoria
 */
categoriesRouter.delete("/:id", deleteCategoryController);

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
 * @notes
 * - O tipo é fixado automaticamente como "origem"
 * - Usado para rastrear a fonte de aquisição de clientes
 */
originsRouter.post("/", createOriginController);

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
 * @notes
 * - O tipo permanece sempre como "origem"
 * - Atualização parcial é suportada
 */
originsRouter.put("/:id", updateOriginController);

/**
 * @route DELETE /api/origins/:id
 * @description Exclui uma origem existente
 * @access Private (requer autenticação)
 * @param {string} id - ID da origem
 * @returns {Object} Confirmação de exclusão
 *
 * @example Request
 * DELETE /api/origins/orig-123
 *
 * @example Success Response (200)
 * {
 *   "success": true
 * }
 *
 * @notes
 * - Remove permanentemente a origem
 */
originsRouter.delete("/:id", deleteOriginController);

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
 * @notes
 * - O tipo é fixado automaticamente como "marcador"
 * - Usado para etiquetar e classificar clientes
 */
markersRouter.post("/", createMarkerController);

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
 * @notes
 * - O tipo permanece sempre como "marcador"
 * - Atualização parcial é suportada
 */
markersRouter.put("/:id", updateMarkerController);

/**
 * @route DELETE /api/markers/:id
 * @description Exclui um marcador existente
 * @access Private (requer autenticação)
 * @param {string} id - ID do marcador
 * @returns {Object} Confirmação de exclusão
 *
 * @example Request
 * DELETE /api/markers/mark-123
 *
 * @example Success Response (200)
 * {
 *   "success": true
 * }
 *
 * @notes
 * - Remove permanentemente o marcador
 */
markersRouter.delete("/:id", deleteMarkerController);

/**
 * Router para operações CRUD de países
 * Montado em /api/countries
 */
const countriesRouter = Router();

tagsRouter.get("/countries", getCountriesController);

countriesRouter.post("/", createCountryController);
countriesRouter.put("/:id", updateCountryController);
countriesRouter.delete("/:id", deleteCountryController);

export default tagsRouter;
export { categoriesRouter, originsRouter, markersRouter, countriesRouter };
