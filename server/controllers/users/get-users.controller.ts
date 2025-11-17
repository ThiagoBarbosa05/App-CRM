import { Request, Response } from "express";
import { usersService } from "../../services/users.service";

/**
 * Controller: GET /api/users
 *
 * Retorna lista de todos os usuários do sistema
 *
 * Esta rota busca todos os usuários cadastrados, incluindo suas informações
 * de canal de atendimento (service channel). Por segurança, o campo de senha
 * é removido da resposta.
 *
 * @param {Request} req - Objeto de requisição Express (sem parâmetros)
 * @param {Response} res - Objeto de resposta Express
 *
 * @returns {Promise<Response>} JSON com lista de usuários
 *
 * Response Codes:
 * - 200: Lista de usuários retornada com sucesso
 * - 500: Erro interno do servidor
 *
 * @example Response 200:
 * [
 *   {
 *     "id": "123e4567-e89b-12d3-a456-426614174000",
 *     "name": "João Silva",
 *     "email": "joao@example.com",
 *     "role": "vendedor",
 *     "isActive": "true",
 *     "createdAt": "2023-01-01T00:00:00.000Z",
 *     "updatedAt": "2023-01-01T00:00:00.000Z",
 *     "serviceChannel": {
 *       "id": "channel-id",
 *       "name": "Canal WhatsApp",
 *       "phoneNumber": "+5511999999999"
 *     }
 *   },
 *   {
 *     "id": "223e4567-e89b-12d3-a456-426614174001",
 *     "name": "Maria Santos",
 *     "email": "maria@example.com",
 *     "role": "gerente",
 *     "isActive": "true",
 *     "createdAt": "2023-01-02T00:00:00.000Z",
 *     "updatedAt": "2023-01-02T00:00:00.000Z",
 *     "serviceChannel": null
 *   }
 * ]
 *
 * @example Response 500:
 * {
 *   "message": "Erro ao buscar usuários"
 * }
 *
 * @notes
 * - O campo password é SEMPRE removido da resposta por segurança
 * - Usuários são retornados em ordem reversa de criação (mais recentes primeiro)
 * - Incluí informações do canal de atendimento via LEFT JOIN
 * - serviceChannel pode ser null se o usuário não tiver canal associado
 * - Roles possíveis: admin, gerente, vendedor
 * - isActive é string: "true" ou "false"
 */
export async function getUsersController(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    const users = await usersService.getUsers();

    return res.status(200).json(users);
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);

    // Retornar mensagem de erro genérica em produção
    return res.status(500).json({
      message: "Erro ao buscar usuários",
    });
  }
}
