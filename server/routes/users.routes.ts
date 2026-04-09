import { Router } from "express";
import { getUsersController } from "../controllers/users/get-users.controller";
import { createUserController } from "../controllers/users/post-user.controller";

import { validateBody, validateParams } from "../middleware/validation";
import { insertUserSchema } from "../../shared/schema";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { serviceChannels, userServiceChannel, users } from "../../shared/schema";
import { updateUserController } from "server/controllers/users/put-user.controller";
import { deleteUserController } from "server/controllers/users/delete-user.controller";
import { toggleUserStatusController } from "server/controllers/users/patch-toggle-user-status.controller";
import { syncBlingVendorsController } from "server/controllers/users/post-sync-bling-vendors.controller";
import { getSellerSalesController } from "server/controllers/users/get-seller-sales.controller";

import { getChannels } from "../integrations/umbler";
import { getSellerDashboardController } from "server/controllers/users/get-seller-dashboard.controller";
import { getAggregateSellerDashboardController } from "server/controllers/users/get-aggregate-seller-dashboard.controller";


/**
 * Router específico para endpoints relacionados a usuários
 * Segue padrão RESTful e organiza todas as rotas de users
 */
export const usersRouter = Router();

/**
 * @route GET /api/users
 * @description Busca todos os usuários do sistema
 * @access Private
 * @returns {Array} Lista de usuários (sem campo password)
 * @example Response:
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
 *   }
 * ]
 * @notes
 *   - Usuários retornados em ordem reversa de criação (mais recentes primeiro)
 *   - Campo password SEMPRE removido por segurança
 *   - Incluí informações do canal de atendimento (service channel)
 *   - serviceChannel pode ser null se usuário não tiver canal associado
 */
usersRouter.get("/", getUsersController);

/**
 * @route POST /api/users
 * @description Cria um novo usuário no sistema
 * @access Private (requer autenticação)
 * @bodyParams {Object} user - Dados do usuário a ser criado
 * @bodyParams {string} user.name - Nome completo do usuário (obrigatório)
 * @bodyParams {string} user.email - Email único do usuário (obrigatório)
 * @bodyParams {string} user.password - Senha do usuário (obrigatório, será hashada)
 * @bodyParams {string} [user.role="vendedor"] - Role do usuário: admin, gerente ou vendedor
 * @bodyParams {string} [user.isActive="true"] - Status ativo do usuário
 * @returns {Object} Usuário criado (sem campo password)
 * @example Request Body:
 * {
 *   "name": "João Silva",
 *   "email": "joao@example.com",
 *   "password": "senha123",
 *   "role": "vendedor"
 * }
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
 * @notes
 *   - Senha é automaticamente hashada com bcrypt antes de salvar
 *   - Email deve ser único no sistema
 *   - Campo password NUNCA retornado na resposta
 *   - Roles válidas: admin, gerente, vendedor (padrão: vendedor)
 *   - ID, createdAt e updatedAt são gerados automaticamente
 */
usersRouter.post("/", validateBody(insertUserSchema), createUserController);

usersRouter.post("/channel", async (req, res) => {
  try {
    const { userId, serviceChannelId } = req.body;

    if (!userId || !serviceChannelId) {
      return res
        .status(400)
        .json({ message: "ID do usuário e ID do canal são obrigatórios" });
    }

    const userExists = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId));
    if (userExists.length === 0) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    let channelExists = await db
      .select({ id: serviceChannels.id })
      .from(serviceChannels)
      .where(eq(serviceChannels.id, serviceChannelId));

    if (channelExists.length === 0) {
      try {
        const umblerChannels = await getChannels();
        const umblerChannel = umblerChannels.find(
          (channel: { id: string }) => channel.id === serviceChannelId,
        );

        if (umblerChannel) {
          await db
            .insert(serviceChannels)
            .values({
              id: umblerChannel.id,
              name: umblerChannel.name,
              phoneNumber: umblerChannel.phoneNumber || null,
            })
            .onConflictDoUpdate({
              target: serviceChannels.id,
              set: {
                name: umblerChannel.name,
                phoneNumber: umblerChannel.phoneNumber || null,
              },
            });

          channelExists = await db
            .select({ id: serviceChannels.id })
            .from(serviceChannels)
            .where(eq(serviceChannels.id, serviceChannelId));
        }
      } catch (syncError) {
        console.error("Erro ao sincronizar canal do Umbler:", syncError);
      }
    }

    if (channelExists.length === 0) {
      return res
        .status(404)
        .json({ message: "Canal de serviço não encontrado" });
    }

    const [existingLink] = await db
      .select()
      .from(userServiceChannel)
      .where(eq(userServiceChannel.userId, userId));

    if (existingLink) {
      await db
        .update(userServiceChannel)
        .set({ serviceChannelId })
        .where(eq(userServiceChannel.userId, userId));

      return res.status(200).json({
        message: "Canal do usuário atualizado com sucesso",
        channelId: serviceChannelId,
      });
    }

    await db.insert(userServiceChannel).values({
      userId,
      serviceChannelId,
    });

    return res.status(200).json({
      message: "Canal vinculado ao usuário com sucesso",
      channelId: serviceChannelId,
    });
  } catch (error) {
    console.error("Erro ao vincular/atualizar canal do usuário:", error);
    return res
      .status(500)
      .json({ message: "Erro interno ao processar a solicitação" });
  }
});

usersRouter.get("/by-email/:email", async (req, res) => {
  try {
    const user = await storage.getUserByEmail(req.params.email);

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }

    return res.json(user);
  } catch (error) {
    console.error("Erro ao buscar usuário por email:", error);
    return res.status(500).json({ message: "Erro ao buscar usuário por email" });
  }
});

/**
 * Validação de parâmetros para rotas com ID de usuário
 */
const userParamsSchema = z.object({
  id: z.string().uuid("ID do usuário deve ser um UUID válido"),
});

/**
 * Validação para toggle de status do usuário
 */
const toggleStatusBodySchema = z.object({
  isActive: z.enum(["true", "false"], {
    errorMap: () => ({ message: "isActive deve ser 'true' ou 'false'" }),
  }),
});

/**
 * @route PUT /api/users/:id
 * @description Atualiza um usuário existente
 * @access Private (requer autenticação)
 * @pathParams {string} id - UUID do usuário a ser atualizado (obrigatório)
 * @bodyParams {Object} user - Dados parciais do usuário para atualização
 * @bodyParams {string} [user.name] - Nome completo do usuário
 * @bodyParams {string} [user.email] - Email único do usuário
 * @bodyParams {string} [user.password] - Senha do usuário (será hashada)
 * @bodyParams {string} [user.role] - Role do usuário: admin, gerente ou vendedor
 * @bodyParams {string} [user.isActive] - Status ativo do usuário
 * @returns {Object} Usuário atualizado (sem campo password)
 * @example Request:
 * PUT /api/users/123e4567-e89b-12d3-a456-426614174000
 * {
 *   "name": "João Silva Atualizado",
 *   "role": "gerente"
 * }
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
 * @notes
 *   - Atualização parcial: apenas campos fornecidos são atualizados
 *   - Senha é automaticamente hashada com bcrypt se fornecida
 *   - updatedAt é automaticamente atualizado
 *   - Campo password NUNCA retornado na resposta
 *   - Retorna 404 se usuário não encontrado
 */
usersRouter.put(
  "/:id",
  validateParams(userParamsSchema),
  validateBody(insertUserSchema.partial()),
  updateUserController
);

/**
 * @route DELETE /api/users/:id
 * @description Exclui um usuário do sistema
 * @access Private (requer autenticação)
 * @pathParams {string} id - UUID do usuário a ser excluído (obrigatório)
 * @returns {Object} Mensagem de confirmação
 * @example Request:
 * DELETE /api/users/123e4567-e89b-12d3-a456-426614174000
 * @example Response 200:
 * {
 *   "message": "Usuário excluído com sucesso"
 * }
 * @example Response 404:
 * {
 *   "message": "Usuário não encontrado"
 * }
 * @notes
 *   - Exclusão permanente do banco de dados
 *   - Retorna 404 se usuário não encontrado
 *   - Validação de UUID via middleware
 *   - Operação não pode ser desfeita
 */
usersRouter.delete(
  "/:id",
  validateParams(userParamsSchema),
  deleteUserController
);

/**
 * @route PATCH /api/users/:id/toggle-status
 * @description Ativa ou desativa um usuário (toggle de status)
 * @access Private (requer autenticação)
 * @pathParams {string} id - UUID do usuário (obrigatório)
 * @bodyParams {Object} status - Status a ser aplicado
 * @bodyParams {string} status.isActive - "true" para ativar, "false" para desativar
 * @returns {Object} Usuário com status atualizado (sem campo password)
 * @example Request:
 * PATCH /api/users/123e4567-e89b-12d3-a456-426614174000/toggle-status
 * {
 *   "isActive": "false"
 * }
 * @example Response 200:
 * {
 *   "id": "123e4567-e89b-12d3-a456-426614174000",
 *   "name": "João Silva",
 *   "email": "joao@example.com",
 *   "role": "vendedor",
 *   "isActive": "false",
 *   "createdAt": "2023-01-01T00:00:00.000Z",
 *   "updatedAt": "2023-01-02T15:30:00.000Z"
 * }
 * @notes
 *   - Atualiza apenas o campo isActive do usuário
 *   - Validação: isActive deve ser exatamente "true" ou "false" (strings)
 *   - Útil para desativar usuários temporariamente sem excluí-los
 *   - Campo password NUNCA retornado na resposta
 *   - Retorna 404 se usuário não encontrado
 */
usersRouter.patch(
  "/:id/toggle-status",
  validateParams(userParamsSchema),
  validateBody(toggleStatusBodySchema),
  toggleUserStatusController
);

const syncBlingVendorsSchema = z.object({
  mappings: z
    .array(
      z.object({
        userId: z.string().uuid(),
        blingVendedorId: z.string().nullable(),
        blingVendedorName: z.string().nullable().optional(),
      }),
    )
    .min(1, "É necessário ao menos um mapeamento"),
});

/**
 * @route POST /api/users/sync-bling-vendors
 * @description Salva o mapeamento entre usuários do app e vendedores do Bling
 * @access Admin only
 */
usersRouter.post(
  "/sync-bling-vendors",
  validateBody(syncBlingVendorsSchema),
  syncBlingVendorsController,
);

/**
 * @route GET /api/users/:id/seller-sales
 * @description Retorna histórico de vendas unificado (Bling + Connect) do vendedor
 * @query startDate?, endDate?, source? (bling|connect|all), limit?, offset?
 */
usersRouter.get(
  "/:id/seller-sales",
  validateParams(userParamsSchema),
  getSellerSalesController,
);

/**
 * @route GET /api/users/seller-dashboard/aggregate
 * @description Retorna métricas agregadas de todos os vendedores (admin/gerente)
 */
usersRouter.get(
  "/seller-dashboard/aggregate",
  getAggregateSellerDashboardController,
);

/**
 * @route GET /api/users/:id/seller-dashboard
 * @description Retorna métricas do Dashboard Vendedor
 */
usersRouter.get(
  "/:id/seller-dashboard",
  validateParams(userParamsSchema),
  getSellerDashboardController,
);

// TODO: Migrar outras rotas de users para este arquivo:
// - ✅ GET /users (MIGRADO - busca de usuários)
// - ✅ POST /users (MIGRADO - criação de usuário)
// - ✅ PUT /users/:id (MIGRADO - atualização de usuário)
// - ✅ DELETE /users/:id (MIGRADO - exclusão de usuário)
// - ✅ PATCH /users/:id/toggle-status (MIGRADO - ativar/desativar usuário)
// - GET /users/by-email/:email (buscar por email)

export default usersRouter;
