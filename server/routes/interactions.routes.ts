import { Router } from "express";
import { createInteractionController } from "../controllers/interactions/post-interaction.controller";

/**
 * Router específico para endpoints relacionados a interações com clientes
 * Segue padrão RESTful e organiza todas as rotas de interactions
 */
export const interactionsRouter = Router();

/**
 * @route POST /api/interactions
 * @description Cria uma nova interação com cliente ou empresa
 * @access Private (requer autenticação via header x-user-id)
 * @headers {string} x-user-id - ID do usuário autenticado (obrigatório)
 * @bodyParams {Object} interaction - Dados da interação
 * @bodyParams {string} [interaction.clientId] - UUID do cliente (obrigatório se companyId não fornecido)
 * @bodyParams {string} [interaction.companyId] - UUID da empresa (obrigatório se clientId não fornecido)
 * @bodyParams {string} interaction.type - Tipo de interação (call, email, meeting, visit, etc.)
 * @bodyParams {string} interaction.description - Descrição detalhada da interação
 * @bodyParams {string|Date} [interaction.date] - Data/hora da interação (ISO string ou Date)
 * @bodyParams {string|number} [interaction.latitude] - Latitude do local (opcional)
 * @bodyParams {string|number} [interaction.longitude] - Longitude do local (opcional)
 * @returns {Object} Interação criada com todos os campos
 *
 * @example Request - Interação com cliente
 * POST /api/interactions
 * Headers: {
 *   "x-user-id": "user-id-123"
 * }
 * Body: {
 *   "clientId": "client-id-456",
 *   "type": "call",
 *   "description": "Ligação de follow-up sobre proposta comercial. Cliente interessado.",
 *   "date": "2023-01-15T10:30:00.000Z",
 *   "latitude": "-23.5505",
 *   "longitude": "-46.6333"
 * }
 *
 * @example Request - Interação com empresa
 * POST /api/interactions
 * Headers: {
 *   "x-user-id": "user-id-123"
 * }
 * Body: {
 *   "companyId": "company-id-789",
 *   "type": "meeting",
 *   "description": "Reunião presencial com decisores da empresa",
 *   "date": "2023-01-16T14:00:00.000Z"
 * }
 *
 * @example Success Response (201)
 * {
 *   "id": "interaction-id",
 *   "userId": "user-id-123",
 *   "clientId": "client-id-456",
 *   "companyId": null,
 *   "type": "call",
 *   "description": "Ligação de follow-up sobre proposta comercial. Cliente interessado.",
 *   "date": "2023-01-15T10:30:00.000Z",
 *   "latitude": "-23.5505",
 *   "longitude": "-46.6333",
 *   "createdAt": "2023-01-15T10:35:00.000Z",
 *   "updatedAt": "2023-01-15T10:35:00.000Z"
 * }
 *
 * @example Error Response (401)
 * {
 *   "message": "Usuário não autenticado."
 * }
 *
 * @example Error Response (400)
 * {
 *   "message": "Validation error: A interação deve estar associada a um cliente ou a uma empresa."
 * }
 *
 * @notes
 * - Autenticação:
 *   - Header x-user-id é obrigatório
 *   - userId é automaticamente adicionado à interação
 *
 * - Validação:
 *   - Pelo menos clientId OU companyId deve ser fornecido
 *   - Schema Zod valida todos os campos
 *   - date aceita string ISO ou objeto Date
 *   - latitude/longitude aceitam string ou number
 *
 * - Conversões automáticas:
 *   - date: string → Date object
 *   - latitude/longitude: number → string (se fornecidos)
 *
 * - Geolocalização:
 *   - latitude e longitude são opcionais
 *   - Útil para rastrear visitas presenciais
 *   - Valores vazios são convertidos para null
 *
 * - Tipos de interação comuns:
 *   - call: Ligação telefônica
 *   - email: Email enviado
 *   - meeting: Reunião presencial ou virtual
 *   - visit: Visita ao cliente/empresa
 *   - whatsapp: Conversa via WhatsApp
 */
interactionsRouter.post("/", createInteractionController);

export default interactionsRouter;
