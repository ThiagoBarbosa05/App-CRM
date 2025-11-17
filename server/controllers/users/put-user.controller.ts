import { Request, Response } from "express";
import { usersService } from "../../services/users.service";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";

/**
 * Controller: PUT /api/users/:id
 *
 * Atualiza um usuário existente no sistema
 *
 * Esta rota permite atualização parcial de um usuário. Se a senha for fornecida,
 * ela é automaticamente hashada com bcrypt antes de ser salva. Por segurança,
 * o campo de senha nunca é retornado na resposta.
 *
 * @param {Request} req - Objeto de requisição Express com ID nos params e dados no body
 * @param {Response} res - Objeto de resposta Express
 *
 * @returns {Promise<Response>} JSON com usuário atualizado (sem senha)
 *
 * Response Codes:
 * - 200: Usuário atualizado com sucesso
 * - 400: Dados inválidos (validação Zod falhou)
 * - 404: Usuário não encontrado
 * - 500: Erro interno do servidor
 *
 * @example Request:
 * PUT /api/users/123e4567-e89b-12d3-a456-426614174000
 * {
 *   "name": "João Silva Atualizado",
 *   "role": "gerente"
 * }
 *
 * @example Response 200:
 * {
 *   "id": "123e4567-e89b-12d3-a456-426614174000",
 *   "name": "João Silva Atualizado",
 *   "email": "joao@example.com",
 *   "role": "gerente",
 *   "isActive": "true",
 *   "createdAt": "2023-01-01T00:00:00.000Z",
 *   "updatedAt": "2023-01-02T10:30:00.000Z"
 * }
 *
 * @example Response 404:
 * {
 *   "message": "Usuário não encontrado"
 * }
 *
 * @example Response 400 (validação):
 * {
 *   "message": "Validation error: Invalid email at \"email\""
 * }
 *
 * @example Response 500:
 * {
 *   "message": "Erro ao atualizar usuário"
 * }
 *
 * @notes
 * - Validação de ID via middleware validateParams(userParamsSchema)
 * - Validação de body via middleware validateBody(insertUserSchema.partial())
 * - Atualização parcial: apenas campos fornecidos são atualizados
 * - Senha é hashada com bcrypt (salt rounds: 10) se fornecida
 * - Email deve ser único no sistema (constraint do banco)
 * - updatedAt é automaticamente atualizado para data/hora atual
 * - Campo password NUNCA retornado na resposta
 * - Campos não fornecidos permanecem inalterados
 */
export async function updateUserController(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    const { id } = req.params;
    // Body já foi validado pelo middleware validateBody
    const updateData = req.body;

    const updatedUser = await usersService.updateUser(id, updateData);

    if (!updatedUser) {
      return res.status(404).json({
        message: "Usuário não encontrado",
      });
    }

    return res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);

    // Se for erro de validação Zod (não deveria chegar aqui devido ao middleware)
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({
        message: validationError.toString(),
      });
    }

    // Verificar se é erro de email duplicado
    if (error && error.toString().includes("unique")) {
      return res.status(400).json({
        message: "Este email já está cadastrado no sistema",
      });
    }

    // Retornar mensagem de erro genérica em produção
    return res.status(500).json({
      message: "Erro ao atualizar usuário",
    });
  }
}
