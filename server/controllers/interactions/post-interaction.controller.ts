import { Request, Response } from "express";
import { interactionsService } from "../../services/interactions.service";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

/**
 * Controller para criar uma nova interação com cliente ou empresa
 *
 * @route POST /api/interactions
 * @headers {string} x-user-id - ID do usuário autenticado (obrigatório)
 * @bodyParams {Object} interaction - Dados da interação
 * @bodyParams {string} [interaction.clientId] - UUID do cliente (obrigatório se companyId não fornecido)
 * @bodyParams {string} [interaction.companyId] - UUID da empresa (obrigatório se clientId não fornecido)
 * @bodyParams {string} interaction.type - Tipo de interação (call, email, meeting, etc.)
 * @bodyParams {string} interaction.description - Descrição da interação
 * @bodyParams {string|Date} [interaction.date] - Data da interação (ISO string ou Date)
 * @bodyParams {string|number} [interaction.latitude] - Latitude (opcional)
 * @bodyParams {string|number} [interaction.longitude] - Longitude (opcional)
 * @returns {Object} Interação criada
 *
 * @example Request
 * POST /api/interactions
 * Headers: { "x-user-id": "user-id" }
 * Body: {
 *   "clientId": "client-id",
 *   "type": "call",
 *   "description": "Ligação de follow-up sobre proposta",
 *   "date": "2023-01-15T10:30:00.000Z",
 *   "latitude": "-23.5505",
 *   "longitude": "-46.6333"
 * }
 *
 * @example Success Response (201)
 * {
 *   "id": "interaction-id",
 *   "userId": "user-id",
 *   "clientId": "client-id",
 *   "companyId": null,
 *   "type": "call",
 *   "description": "Ligação de follow-up sobre proposta",
 *   "date": "2023-01-15T10:30:00.000Z",
 *   "latitude": "-23.5505",
 *   "longitude": "-46.6333",
 *   "createdAt": "2023-01-15T10:35:00.000Z",
 *   "updatedAt": "2023-01-15T10:35:00.000Z"
 * }
 *
 * @example Error Response (401)
 * { "message": "Usuário não autenticado." }
 *
 * @example Error Response (400)
 * { "message": "A interação deve estar associada a um cliente ou a uma empresa." }
 *
 * @notes
 * - Requer header x-user-id para autenticação
 * - Pelo menos clientId OU companyId deve ser fornecido
 * - date é automaticamente convertido de string para Date
 * - latitude e longitude aceitam string ou number
 * - Validação completa via Zod schema
 */
export async function createInteractionController(req: Request, res: Response) {
  try {
    const userId = req.user!.userId;

    const newInteraction = await interactionsService.createInteraction(
      req.body,
      userId
    );

    return res.status(201).json(newInteraction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      console.error(
        "[createInteractionController] Erro de validação:",
        validationError.toString()
      );
      return res.status(400).json({ message: validationError.toString() });
    }

    console.error("[createInteractionController] Erro:", error);
    return res.status(500).json({
      message: "Erro interno ao criar a interação.",
    });
  }
}
