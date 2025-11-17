import { Request, Response } from "express";
import { usersService } from "../../services/users.service";

/**
 * Controller: DELETE /api/users/:id
 *
 * Exclui um usuário do sistema
 *
 * Esta rota permite a exclusão permanente de um usuário do banco de dados.
 * A operação não pode ser desfeita.
 *
 * @param {Request} req - Objeto de requisição Express com ID nos params
 * @param {Response} res - Objeto de resposta Express
 *
 * @returns {Promise<Response>} JSON com mensagem de confirmação
 *
 * Response Codes:
 * - 200: Usuário excluído com sucesso
 * - 404: Usuário não encontrado
 * - 500: Erro interno do servidor
 *
 * @example Request:
 * DELETE /api/users/123e4567-e89b-12d3-a456-426614174000
 *
 * @example Response 200:
 * {
 *   "message": "Usuário excluído com sucesso"
 * }
 *
 * @example Response 404:
 * {
 *   "message": "Usuário não encontrado"
 * }
 *
 * @example Response 500:
 * {
 *   "message": "Erro ao excluir usuário"
 * }
 *
 * @notes
 * - Validação de ID via middleware validateParams(userParamsSchema)
 * - ID deve ser um UUID válido
 * - Exclusão é permanente e não pode ser desfeita
 * - Retorna 404 se usuário não existir
 * - Pode falhar se houver dependências (foreign keys) no banco
 * - Operação atômica: ou exclui completamente ou falha
 */
export async function deleteUserController(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    const { id } = req.params;

    const deleted = await usersService.deleteUser(id);

    if (!deleted) {
      return res.status(404).json({
        message: "Usuário não encontrado",
      });
    }

    return res.status(200).json({
      message: "Usuário excluído com sucesso",
    });
  } catch (error) {
    console.error("Erro ao excluir usuário:", error);

    // Verificar se é erro de constraint (foreign key)
    if (error && error.toString().includes("foreign key")) {
      return res.status(400).json({
        message:
          "Não é possível excluir este usuário pois existem registros relacionados",
      });
    }

    // Retornar mensagem de erro genérica em produção
    return res.status(500).json({
      message: "Erro ao excluir usuário",
    });
  }
}
