import { Router } from "express";
import { getUpcomingBirthdaysController } from "../controllers/birthdays/get-upcoming-birthdays.controller";

/**
 * Router específico para endpoints relacionados a aniversários
 * Segue padrão RESTful e organiza todas as rotas de birthdays
 */
export const birthdaysRouter = Router();

/**
 * @route GET /api/birthdays/upcoming
 * @description Busca clientes com aniversários próximos nos próximos N dias
 * @access Private (requer autenticação)
 * @queryParams {number} [days=7] - Número de dias para buscar aniversários (padrão: 7)
 * @queryParams {string} [responsibleId] - UUID do responsável para filtrar clientes
 * @headers {string} x-user-id - ID do usuário autenticado (obrigatório)
 * @headers {string} x-user-role - Role do usuário: admin, gerente ou vendedor (obrigatório)
 * @returns {Array} Lista de clientes com aniversários próximos, ordenados por data
 *
 * @example Request 1 - Admin buscando todos os aniversários dos próximos 30 dias
 * GET /api/birthdays/upcoming?days=30
 * Headers: {
 *   "x-user-id": "admin-id",
 *   "x-user-role": "admin"
 * }
 *
 * @example Request 2 - Vendedor buscando aniversários dos seus clientes
 * GET /api/birthdays/upcoming?days=7
 * Headers: {
 *   "x-user-id": "vendor-id",
 *   "x-user-role": "vendedor"
 * }
 *
 * @example Request 3 - Admin buscando aniversários de clientes de um vendedor específico
 * GET /api/birthdays/upcoming?days=365&responsibleId=123e4567-e89b-12d3-a456-426614174000
 * Headers: {
 *   "x-user-id": "admin-id",
 *   "x-user-role": "admin"
 * }
 *
 * @example Success Response (200)
 * [
 *   {
 *     "id": "client-id-1",
 *     "name": "João Silva",
 *     "phone": "+5511999999999",
 *     "email": "joao@example.com",
 *     "birthday": "1990-05-15",
 *     "responsavelId": "vendor-id",
 *     "responsavelName": "Vendedor Nome",
 *     "nextBirthday": "2025-05-15T00:00:00.000Z"
 *   },
 *   {
 *     "id": "client-id-2",
 *     "name": "Maria Santos",
 *     "phone": "+5511988888888",
 *     "email": "maria@example.com",
 *     "birthday": "1985-06-20",
 *     "responsavelId": "vendor-id",
 *     "responsavelName": "Vendedor Nome",
 *     "nextBirthday": "2025-06-20T00:00:00.000Z"
 *   }
 * ]
 *
 * @notes
 * - Filtro por responsável:
 *   - Se `responsibleId` fornecido na query: filtra por esse responsável
 *   - Se não fornecido E usuário não é admin: filtra pelos clientes do próprio usuário
 *   - Se não fornecido E usuário é admin/administrador: retorna todos os clientes
 *
 * - Cálculo de aniversário:
 *   - Aceita formatos: YYYY-MM-DD e DD/MM/YYYY
 *   - Se aniversário já passou este ano, considera o do próximo ano
 *   - Datas inválidas são ignoradas com log no console
 *
 * - Ordenação:
 *   - Clientes ordenados por proximidade do aniversário (mais próximos primeiro)
 *
 * - Performance:
 *   - Busca otimizada com LEFT JOIN para incluir nome do responsável
 *   - Filtragem aplicada no banco quando possível
 */
birthdaysRouter.get("/upcoming", getUpcomingBirthdaysController);

export default birthdaysRouter;
