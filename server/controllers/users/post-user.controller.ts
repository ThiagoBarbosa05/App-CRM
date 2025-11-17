import { Request, Response } from "express";
import { usersService } from "../../services/users.service";
import { fromZodError } from "zod-validation-error";
import { z } from "zod";

/**
 * Controller: POST /api/users
 *
 * Cria um novo usuário no sistema
 *
 * Esta rota cria um novo usuário com as informações fornecidas. A senha é
 * automaticamente hashada com bcrypt antes de ser salva no banco de dados.
 * Por segurança, o campo de senha nunca é retornado na resposta.
 *
 * @param {Request} req - Objeto de requisição Express com dados do usuário no body
 * @param {Response} res - Objeto de resposta Express
 *
 * @returns {Promise<Response>} JSON com usuário criado (sem senha)
 *
 * Response Codes:
 * - 201: Usuário criado com sucesso
 * - 400: Dados inválidos (validação Zod falhou)
 * - 500: Erro interno do servidor
 *
 * @example Request Body:
 * {
 *   "name": "João Silva",
 *   "email": "joao@example.com",
 *   "password": "senha123",
 *   "role": "vendedor"
 * }
 *
 * @example Response 201:
 * {
 *   "id": "123e4567-e89b-12d3-a456-426614174000",
 *   "name": "João Silva",
 *   "email": "joao@example.com",
 *   "role": "vendedor",
 *   "isActive": "true",
 *   "createdAt": "2023-01-01T00:00:00.000Z",
 *   "updatedAt": "2023-01-01T00:00:00.000Z"
 * }
 *
 * @example Response 400 (validação):
 * {
 *   "message": "Validation error: Invalid email at \"email\""
 * }
 *
 * @example Response 500:
 * {
 *   "message": "Erro ao criar usuário"
 * }
 *
 * @notes
 * - Validação de dados feita via middleware validateBody(insertUserSchema)
 * - Senha é hashada com bcrypt (salt rounds: 10) antes de salvar
 * - Email deve ser único no sistema (constraint do banco)
 * - Campos obrigatórios: name, email, password
 * - Campos opcionais: role (default: "vendedor"), isActive (default: "true")
 * - Roles válidas: admin, gerente, vendedor
 * - ID é gerado automaticamente via UUID
 * - Campo password NUNCA retornado na resposta
 * - Timestamps (createdAt, updatedAt) gerados automaticamente
 */
export async function createUserController(
  req: Request,
  res: Response
): Promise<Response> {
  try {
    // Body já foi validado pelo middleware validateBody
    const userData = req.body;

    const newUser = await usersService.createUser(userData);

    return res.status(201).json(newUser);
  } catch (error) {
    console.error("Erro ao criar usuário:", error);

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
      message: "Erro ao criar usuário",
    });
  }
}
