import { Request, Response } from "express";
import { birthdaysService } from "../../services/birthdays.service";

/**
 * Controller para buscar aniversários próximos de clientes
 *
 * @route GET /api/birthdays/upcoming
 * @queryParams {number} [days=7] - Número de dias para buscar aniversários
 * @queryParams {string} [responsibleId] - UUID do responsável para filtrar
 * @headers {string} x-user-id - ID do usuário autenticado
 * @headers {string} x-user-role - Role do usuário (admin, gerente, vendedor)
 * @returns Lista de clientes com aniversários próximos
 *
 * @example Request
 * GET /api/birthdays/upcoming?days=30&responsibleId=123e4567-e89b-12d3-a456-426614174000
 * Headers: {
 *   "x-user-id": "user-id",
 *   "x-user-role": "vendedor"
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
 *     "responsavelId": "user-id",
 *     "responsavelName": "Vendedor Nome",
 *     "nextBirthday": "2025-05-15T00:00:00.000Z"
 *   },
 *   {
 *     "id": "client-id-2",
 *     "name": "Maria Santos",
 *     "phone": "+5511988888888",
 *     "email": "maria@example.com",
 *     "birthday": "1985-06-20",
 *     "responsavelId": "user-id",
 *     "responsavelName": "Vendedor Nome",
 *     "nextBirthday": "2025-06-20T00:00:00.000Z"
 *   }
 * ]
 *
 * @notes
 * - Se responsibleId fornecido na query, filtra por esse responsável
 * - Se não fornecido e usuário não é admin, filtra pelos clientes do próprio usuário
 * - Admin/Administrador vê todos os aniversários se não especificar responsibleId
 * - Retorna lista ordenada por proximidade do aniversário (mais próximos primeiro)
 * - days padrão: 7 (próximos 7 dias)
 * - Aceita formatos de data: YYYY-MM-DD e DD/MM/YYYY
 */
export async function getUpcomingBirthdaysController(
  req: Request<{}, {}, {}, { days?: string; responsibleId?: string }>,
  res: Response
) {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const responsibleId = req.query.responsibleId as string;

    // Se um responsibleId específico for passado, usar esse
    // Se não, e o usuário não for admin, filtrar pelos clientes do usuário atual
    let filterByResponsible = responsibleId;
    if (
      !filterByResponsible &&
      userRole !== "admin" &&
      userRole !== "administrador"
    ) {
      filterByResponsible = userId;
    }

    const upcomingBirthdays = await birthdaysService.getUpcomingBirthdays(
      days,
      filterByResponsible
    );

    return res.json(upcomingBirthdays);
  } catch (error) {
    console.error("[getUpcomingBirthdaysController] Erro:", error);
    return res.status(500).json({
      message: "Erro ao buscar aniversários próximos",
    });
  }
}
