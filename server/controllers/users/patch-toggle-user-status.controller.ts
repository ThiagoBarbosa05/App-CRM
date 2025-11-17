import { Request, Response } from "express";
import { usersService } from "../../services/users.service";

/**
 * Controller para alternar o status ativo/inativo de um usuário
 *
 * @route PATCH /api/users/:id/toggle-status
 * @param req.params.id - UUID do usuário
 * @param req.body.isActive - Status a ser aplicado ("true" ou "false")
 * @returns Usuário com status atualizado (sem password)
 *
 * @example Request
 * PATCH /api/users/123e4567-e89b-12d3-a456-426614174000/toggle-status
 * Body: { "isActive": "false" }
 *
 * @example Success Response (200)
 * {
 *   "id": "123e4567-e89b-12d3-a456-426614174000",
 *   "name": "João Silva",
 *   "email": "joao@example.com",
 *   "role": "vendedor",
 *   "isActive": "false",
 *   "createdAt": "2023-01-01T00:00:00.000Z",
 *   "updatedAt": "2023-01-02T15:30:00.000Z"
 * }
 *
 * @example Error Response (404)
 * { "message": "Usuário não encontrado" }
 *
 * @notes
 * - Validação de params e body feita por middleware
 * - isActive é string: "true" ou "false"
 * - Campo password SEMPRE removido da resposta
 * - Útil para desativar usuários sem excluí-los
 */
export async function toggleUserStatusController(
  req: Request<{ id: string }, {}, { isActive: "true" | "false" }>,
  res: Response
) {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const updatedUser = await usersService.toggleUserStatus(id, isActive);

    if (!updatedUser) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    return res.json(updatedUser);
  } catch (error) {
    console.error("[toggleUserStatusController] Erro:", error);
    return res
      .status(500)
      .json({ message: "Erro ao atualizar status do usuário" });
  }
}
