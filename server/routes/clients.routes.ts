import { Router } from "express";
import { getClientsController } from "../controllers/clients/get-clients.controller";
import { getClientByPhoneController } from "../controllers/clients/get-client-by-phone.controller";
import { getClientsWithoutContactController } from "../controllers/clients/get-clients-without-contact.controller";
import { getClientsExportAllController } from "../controllers/clients/get-clients-export-all.controller";
import { getClientsExportFilteredController } from "../controllers/clients/get-clients-export-filtered.controller";
import { postClientController } from "../controllers/clients/post-client.controller";
import { putClientController } from "../controllers/clients/put-client.controller";
import { deleteClientController } from "../controllers/clients/delete-client.controller";
import { deleteClientsBulkController } from "../controllers/clients/delete-clients-bulk.controller";
import { confirmClientController } from "../controllers/clients/confirm-client.controller";
import { getClientInteractionsController } from "../controllers/clients/get-client-interactions.controller";
import { getClientFunnelsController } from "../controllers/clients/get-client-funnels.controller";
import { getClientByIdController } from "../controllers/clients/get-client-by-id.controller";
import { getClientPurchaseInsightsController } from "../controllers/clients/get-client-purchase-insights.controller";
import { checkDuplicateController } from "../controllers/clients/check-duplicate.controller";
import { getDuplicatesController } from "../controllers/clients/get-duplicates.controller";
import { mergeClientsController } from "../controllers/clients/merge-clients.controller";
import { generateWineProfileController } from "../controllers/clients/generate-wine-profile.controller";
import { getReferralsController } from "../controllers/referrals/get-referrals.controller";
import { postReferralController } from "../controllers/referrals/post-referral.controller";
import { getReferrerController } from "../controllers/referrals/get-referrer.controller";
import { deliverBenefitController } from "../controllers/referrals/deliver-benefit.controller";
import multer from "multer";
import { syncClientToBling, BlingSyncError } from "../services/bling-clients-export.service";
import { requireAuth } from "../middleware/validation";
import { consultarCPF, testarCPF } from "../services/assertiva.service";
import { getClientsNeedingRegistrationUpdate } from "../services/registration-quality-panel.service";
import { storage } from "../storage";

/**
 * Router específico para endpoints relacionados a clientes
 * Segue padrão RESTful e organiza todas as rotas de clientes
 */
export const clientsRouter = Router();

const clientsImportUpload = multer({
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

/**
 * @route GET /api/clients
 * @description Busca clientes com filtros, paginação e controle de acesso
 * @access Private (baseado em role do usuário)
 * @queryParams {string} [search] - Busca geral por nome, email, telefone ou CPF
 * @queryParams {string} [name] - Filtro por nome
 * @queryParams {string} [phone] - Filtro por telefone
 * @queryParams {string} [cpf] - Filtro por CPF
 * @queryParams {string} [responsavelId] - Filtro por responsável
 * @queryParams {string} [categoria] - Filtro por categoria
 * @queryParams {string} [origem] - Filtro por origem
 * @queryParams {string} [markers] - Filtro por marcadores
 * @queryParams {number} [page=1] - Número da página
 * @queryParams {number} [pageSize=100] - Tamanho da página (máx: 1000)
 * @headerParams {string} [x-user-id] - ID do usuário logado
 * @headerParams {string} [x-user-role] - Role do usuário (vendedor/gerente/admin)
 * @returns {object} Lista paginada de clientes
 */
clientsRouter.get("/", getClientsController);
clientsRouter.get("/duplicates", getDuplicatesController);
clientsRouter.post("/check-duplicate", checkDuplicateController);
clientsRouter.post("/:keepId/merge/:mergeId", mergeClientsController);
clientsRouter.post("/import", clientsImportUpload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Arquivo não fornecido" });
    }

    return res.json({
      success: 0,
      errors: [],
    });
  } catch (error) {
    console.error("Erro na importação:", error);
    return res.status(500).json({ message: "Erro ao importar clientes" });
  }
});

/**
 * @route GET /api/clients/by-phone/:phone
 * @description Busca cliente específico por número de telefone
 * @access Private
 * @urlParams {string} phone - Número de telefone do cliente
 * @returns {object} Cliente encontrado ou erro 404
 */
clientsRouter.get("/by-phone/:phone", getClientByPhoneController);

/**
 * @route GET /api/clients/without-contact
 * @description Busca clientes sem contato recente baseado em dias
 * @access Private (baseado em role do usuário)
 * @queryParams {string} [userId] - ID do usuário (ou via header x-user-id)
 * @queryParams {string} [userRole] - Role do usuário (ou via header x-user-role)
 * @queryParams {number} [days=1] - Número de dias sem contato (entre 1 e 365)
 * @headerParams {string} [x-user-id] - ID do usuário logado
 * @headerParams {string} [x-user-role] - Role do usuário (vendedor/gerente/admin)
 * @returns {array} Lista de clientes sem contato recente
 */
clientsRouter.get("/without-contact", getClientsWithoutContactController);

/**
 * @route GET /api/clients/export-all
 * @description Exporta todos os clientes do sistema (apenas para administradores)
 * @access Admin only
 * @headerParams {string} x-user-role - Role do usuário (deve ser "admin" ou "administrador")
 * @returns {array} Lista completa de clientes para exportação
 * @returns {object} 403 - Acesso negado se não for administrador
 * @returns {object} 500 - Erro interno do servidor
 */
clientsRouter.get("/export-all", getClientsExportAllController);
clientsRouter.get("/export-filtered", getClientsExportFilteredController);

clientsRouter.get("/assertiva-test", async (req, res) => {
  const cpf = String(req.query.cpf ?? "").replace(/\D/g, "");
  if (cpf.length !== 11) return res.status(400).json({ message: "CPF inválido" });
  try {
    const result = await testarCPF(cpf);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
});

/**
 * @route GET /api/clients/registration-quality-panel
 * @description Clientes com compras significativas/frequentes (RFM) e cadastro incompleto
 * @access Private (vendedor vê apenas sua carteira; admin/gerente pode filtrar por responsavelId)
 * @queryParams {string} [responsavelId] - Filtra por vendedor responsável (apenas admin/gerente)
 * @returns {array} Lista de clientes ordenada por valor gasto (maior primeiro)
 */
clientsRouter.get("/registration-quality-panel", requireAuth, async (req, res) => {
  try {
    const user = req.user!;
    const isAdminOrManager = user.role === "admin" || user.role === "gerente";
    const requestedResponsavelId =
      typeof req.query.responsavelId === "string" && req.query.responsavelId
        ? req.query.responsavelId
        : undefined;
    const responsavelId = isAdminOrManager ? requestedResponsavelId : user.userId;

    const candidates = await getClientsNeedingRegistrationUpdate({ responsavelId });
    return res.json(candidates);
  } catch (err) {
    console.error("[registration-quality-panel]", err);
    return res.status(500).json({ message: "Erro ao buscar clientes com cadastro incompleto" });
  }
});

/**
 * @route GET /api/clients/:id
 * @description Busca um cliente específico por ID
 * @access Private
 * @urlParams {string} id - ID do cliente
 * @returns {object} Cliente encontrado ou erro 404
 */
clientsRouter.get("/:id", getClientByIdController);

clientsRouter.get(
  "/:clientId/purchase-insights",
  getClientPurchaseInsightsController,
);

clientsRouter.get("/:clientId/verify-cpf", requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const client = await storage.getClient(clientId);
    if (!client) {
      return res.status(404).json({ message: "Cliente não encontrado" });
    }
    if (!client.cpf) {
      return res.status(422).json({ message: "Cliente sem CPF cadastrado" });
    }
    const data = await consultarCPF(client.cpf);
    return res.json(data);
  } catch (err: any) {
    if (err.message === "ASSERTIVA_NOT_CONFIGURED") {
      return res.status(503).json({ message: "Integração Assertiva não configurada. Adicione ASSERTIVA_CLIENT_ID e ASSERTIVA_CLIENT_SECRET nos secrets." });
    }
    if (err.message === "CPF_NOT_FOUND") {
      return res.status(404).json({ message: "CPF não encontrado na base Assertiva" });
    }
    return res.status(500).json({ message: err.message ?? "Erro ao consultar Assertiva" });
  }
});

/**
 * @route GET /api/clients/:clientId/interactions
 * @description Busca as interações de um cliente
 * @access Private
 * @urlParams {string} clientId - ID do cliente
 * @returns {array} Lista de interações do cliente
 */
clientsRouter.get("/:clientId/interactions", getClientInteractionsController);

/**
 * @route GET /api/clients/:clientId/funnels
 * @description Busca os funis associados a um cliente
 * @access Private
 * @urlParams {string} clientId - ID do cliente
 * @returns {array} Lista de funis do cliente
 */
clientsRouter.get("/:clientId/funnels", getClientFunnelsController);
clientsRouter.get("/:clientId/referrals", getReferralsController);
clientsRouter.post("/:clientId/referrals", postReferralController);
clientsRouter.post("/:clientId/referrals/benefits/:level/deliver", deliverBenefitController);
clientsRouter.get("/:clientId/referrer", getReferrerController);
clientsRouter.get("/:clientId/incentive-status", async (req, res) => {
  try {
    const { clientId } = req.params;
    const { referralsService } = await import("../services/referrals.service");
    const status = await referralsService.getClientIncentiveStatus(clientId);
    return res.json(status);
  } catch (error) {
    console.error("Erro ao buscar status de incentivo:", error);
    return res.status(500).json({ message: "Erro ao buscar status de incentivo" });
  }
});

/**
 * @route POST /api/clients
 * @description Cria um novo cliente no sistema
 * @access Private (baseado em role do usuário)
 * @bodyParams {string} name - Nome completo do cliente (obrigatório)
 * @bodyParams {string} phone - Telefone do cliente (obrigatório, único)
 * @bodyParams {string} [email] - Email do cliente (opcional)
 * @bodyParams {string} [cpf] - CPF do cliente (opcional)
 * @bodyParams {string} [birthday] - Data de nascimento (opcional)
 * @bodyParams {string} [categoria="Geral"] - Categoria do cliente (default: "Geral")
 * @bodyParams {string} [origem="Website"] - Origem do lead (default: "Website")
 * @bodyParams {string} [responsavelId] - ID do responsável (se não admin, usa usuário atual)
 * @bodyParams {string[]} [markers=[]] - Array de marcadores/tags
 * @queryParams {string} [userId] - ID do usuário (ou via header x-user-id)
 * @queryParams {string} [userRole] - Role do usuário (ou via header x-user-role)
 * @headerParams {string} [x-user-id] - ID do usuário logado
 * @headerParams {string} [x-user-role] - Role do usuário (vendedor/admin)
 * @returns {object} 201 - Cliente criado com sucesso
 * @returns {object} 400 - Erro de validação ou telefone duplicado
 * @returns {object} 500 - Erro interno do servidor
 */
clientsRouter.post("/", postClientController);

/**
 * @route PUT /api/clients/:id
 * @description Atualiza um cliente existente no sistema
 * @access Private (baseado em role do usuário)
 * @urlParams {string} id - ID do cliente a ser atualizado (obrigatório)
 * @bodyParams {string} [name] - Nome completo do cliente
 * @bodyParams {string} [phone] - Telefone do cliente (único)
 * @bodyParams {string} [email] - Email do cliente
 * @bodyParams {string} [cpf] - CPF do cliente
 * @bodyParams {string} [birthday] - Data de nascimento
 * @bodyParams {string} [categoria] - Categoria do cliente
 * @bodyParams {string} [origem] - Origem do lead
 * @bodyParams {string} [responsavelId] - ID do responsável (se não admin, usa usuário atual)
 * @bodyParams {string[]} [markers] - Array de marcadores/tags
 * @queryParams {string} [userId] - ID do usuário (ou via header x-user-id)
 * @queryParams {string} [userRole] - Role do usuário (ou via header x-user-role)
 * @headerParams {string} [x-user-id] - ID do usuário logado
 * @headerParams {string} [x-user-role] - Role do usuário (vendedor/admin)
 * @returns {object} 200 - Cliente atualizado com sucesso
 * @returns {object} 400 - Erro de validação ou telefone duplicado
 * @returns {object} 404 - Cliente não encontrado
 * @returns {object} 500 - Erro interno do servidor
 */
clientsRouter.put("/:id", putClientController);

/**
 * @route POST /api/clients/:id/confirm
 * @description Confirma o cadastro de um cliente validando o código de confirmação
 * @access Private
 * @urlParams {string} id - ID do cliente a ser confirmado (obrigatório)
 * @bodyParams {string} confirmationCode - Código de confirmação de 6 dígitos (obrigatório)
 * @returns {object} 200 - Cliente confirmado com sucesso
 * @returns {object} 400 - Erro de validação ou código inválido
 * @returns {object} 404 - Cliente não encontrado
 * @returns {object} 500 - Erro interno do servidor
 */
clientsRouter.post("/:id/confirm", confirmClientController);
clientsRouter.post("/:clientId/generate-wine-profile", generateWineProfileController);

/**
 * @route DELETE /api/clients/:id
 * @description Exclui um cliente existente do sistema e todos os dados relacionados
 * @access Private
 * @urlParams {string} id - ID do cliente a ser excluído (obrigatório)
 * @returns {object} 200 - Cliente e dados relacionados excluídos com sucesso
 * @returns {object} 404 - Cliente não encontrado
 * @returns {object} 500 - Erro interno do servidor
 * @warning Esta operação é irreversível e exclui:
 *   - Usos de cashback
 *   - Saldo de cashback
 *   - Transações de cashback
 *   - Deals associados
 *   - Interações do cliente
 *   - O cliente em si
 */
clientsRouter.delete("/:id", deleteClientController);

/**
 * @route DELETE /api/clients
 * @description Exclusão em lote de clientes (APENAS ADMIN)
 * @access Private (admin only)
 * @bodyParams {string[]} clientIds - Array de IDs dos clientes para exclusão
 * @example Body: { "clientIds": ["client1", "client2", "client3"] }
 * @returns {Object} Status da operação com contagem de exclusões
 * @security Requer role 'admin' para acesso
 * @notes
 *   - Máximo de 100 clientes por operação
 *   - Realiza exclusão em cascata de todos os dados relacionados
 *   - Operação irreversível
 */
clientsRouter.delete("/", deleteClientsBulkController);

/**
 * @route POST /api/clients/:id/sync-bling
 * @description Sincroniza manualmente um cliente do CRM com o Bling
 */
clientsRouter.post("/:id/sync-bling", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const connectionId =
      typeof req.body?.connectionId === "string" && req.body.connectionId
        ? req.body.connectionId
        : undefined;
    await syncClientToBling(id, connectionId);
    return res.json({ ok: true, message: "Cliente sincronizado com o Bling com sucesso." });
  } catch (err) {
    console.error("[sync-bling]", err);
    if (err instanceof BlingSyncError) {
      return res.status(err.httpStatus).json({ message: err.userMessage });
    }
    return res
      .status(500)
      .json({ message: "Não foi possível sincronizar com o Bling. Tente novamente." });
  }
});

// TODO: Migrar outras rotas de clientes para este arquivo:
// - ✅ GET /clients/by-phone/:phone (MIGRADO)
// - ✅ GET /clients/without-contact (MIGRADO)
// - ✅ GET /clients/export-all (MIGRADO)
// - ✅ GET /clients/:id (MIGRADO)
// - ✅ POST /clients (MIGRADO)
// - ✅ PUT /clients/:id (MIGRADO)
// - ✅ DELETE /clients/:id (MIGRADO)
// - ✅ DELETE /clients (MIGRADO)
// - GET /clients/:clientId/interactions
// - GET /clients/:clientId/funnels
// - POST /clients/import
