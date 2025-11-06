import { Router } from "express";
import { getDealsController } from "../controllers/deals/get-deals.controller";
import { createDealController } from "../controllers/deals/post-deal.controller";
import { createBulkDealsController } from "../controllers/deals/post-bulk-deals.controller";
import { createBulkDealsClientsController } from "../controllers/deals/post-bulk-deals-clients.controller";
import { putDealController } from "../controllers/deals/put-deal.controller";
import { deleteDealController } from "../controllers/deals/delete-deal.controller";

/**
 * Router específico para endpoints relacionados a deals (negócios)
 * Segue padrão RESTful e organiza todas as rotas de deals
 */
export const dealsRouter = Router();

/**
 * @route GET /api/deals
 * @description Busca todos os deals com dados relacionados (clientes, empresas, usuários, estágios, funis)
 * @access Private (requer autenticação)
 * @queryParams {string} [funnelId] - ID do funil para filtrar deals específicos
 * @queryParams {string} [userId] - ID do usuário (usado para controle de acesso)
 * @queryParams {string} [userRole] - Role do usuário (admin/vendedor para controle de acesso)
 * @returns {Array} Lista completa de deals com estrutura hierárquica
 * @example Response:
 * [
 *   {
 *     "id": "deal-1",
 *     "title": "Venda para Empresa XYZ",
 *     "value": "50000.00",
 *     "stageId": "stage-2",
 *     "funnelId": "funnel-123",
 *     "clientId": "client-789",
 *     "companyId": "company-456",
 *     "assignedTo": "user-456",
 *     "status": "active",
 *     "notes": "Cliente interessado em pacote premium",
 *     "createdAt": "2023-01-01T00:00:00.000Z",
 *     "updatedAt": "2023-01-02T00:00:00.000Z",
 *     "client": {
 *       "id": "client-789",
 *       "name": "João Silva",
 *       "email": "joao@empresa.com",
 *       "phone": "(11) 99999-9999"
 *     },
 *     "company": {
 *       "id": "company-456",
 *       "nomeFantasia": "Empresa XYZ Ltda",
 *       "razaoSocial": "XYZ Tecnologia Ltda",
 *       "cnpj": "12.345.678/0001-90"
 *     },
 *     "assignedUser": {
 *       "id": "user-456",
 *       "name": "Maria Santos",
 *       "email": "maria@empresa.com",
 *       "role": "vendedor"
 *     },
 *     "stage": {
 *       "id": "stage-2",
 *       "name": "Qualificação",
 *       "order": 2,
 *       "color": "#10B981"
 *     },
 *     "funnel": {
 *       "id": "funnel-123",
 *       "name": "Funil Principal",
 *       "description": "Funil de vendas B2B"
 *     }
 *   }
 * ]
 * @notes
 *   - Deals são retornados ordenados por data de criação (mais recentes primeiro)
 *   - Controle de acesso: vendedores veem apenas seus próprios deals
 *   - Administradores veem todos os deals do sistema
 *   - Query otimizada com LEFT JOINs para evitar N+1 queries
 *   - Campos relacionados podem ser null se não houver associação
 *   - Filtro por funnelId limita resultados ao funil específico
 */
dealsRouter.get("/", getDealsController);

/**
 * @route POST /api/deals
 * @description Cria um novo deal no sistema
 * @access Private (requer autenticação)
 * @bodyParams {Object} deal - Dados do deal a ser criado
 * @bodyParams {string} [deal.title] - Título do deal (gerado automaticamente se não fornecido)
 * @bodyParams {string} deal.value - Valor monetário do deal (será validado como número)
 * @bodyParams {string} deal.stageId - ID do estágio inicial do funil (obrigatório)
 * @bodyParams {string} deal.funnelId - ID do funil (obrigatório)
 * @bodyParams {string} [deal.clientId] - ID do cliente associado (um de clientId ou companyId é obrigatório)
 * @bodyParams {string} [deal.companyId] - ID da empresa associada (um de clientId ou companyId é obrigatório)
 * @bodyParams {string} deal.assignedTo - ID do usuário responsável (obrigatório)
 * @bodyParams {string} deal.createdBy - ID do usuário criador (obrigatório)
 * @bodyParams {string} [deal.notes] - Observações sobre o deal
 * @returns {Object} Deal criado com ID gerado
 * @example Request Body:
 * {
 *   "title": "Venda - Empresa XYZ",
 *   "value": "50000.00",
 *   "stageId": "stage-1",
 *   "funnelId": "funnel-456",
 *   "clientId": "client-789",
 *   "assignedTo": "user-123",
 *   "createdBy": "user-123",
 *   "notes": "Cliente interessado em pacote premium"
 * }
 * @example Response:
 * {
 *   "id": "deal-abc123",
 *   "title": "Venda - Empresa XYZ",
 *   "value": "50000.00",
 *   "stageId": "stage-1",
 *   "funnelId": "funnel-456",
 *   "clientId": "client-789",
 *   "companyId": null,
 *   "assignedTo": "user-123",
 *   "createdBy": "user-123",
 *   "notes": "Cliente interessado em pacote premium",
 *   "createdAt": "2023-01-01T00:00:00.000Z",
 *   "updatedAt": "2023-01-01T00:00:00.000Z"
 * }
 * @notes
 *   - Validação completa via Zod schema (insertDealSchema)
 *   - Pelo menos um de clientId ou companyId deve ser fornecido
 *   - Valor monetário é convertido e validado como número
 *   - Título é gerado automaticamente baseado no cliente/empresa se não fornecido:
 *     - Com cliente: "Negócio - [Nome do Cliente]"
 *     - Com empresa: "Negócio - [Nome Fantasia ou Razão Social]"
 *     - Sem ambos: "Novo Negócio"
 *   - ID é gerado automaticamente via UUID
 *   - createdAt e updatedAt são definidos automaticamente
 *   - Retorna 201 (Created) em caso de sucesso
 *   - Retorna 400 para dados inválidos ou validação falha
 */
dealsRouter.post("/", createDealController);

/**
 * @route POST /api/deals/bulk
 * @description Cria múltiplos deals simultaneamente para uma lista de empresas
 * @access Private (requer autenticação)
 * @bodyParams {Object} bulkData - Dados para criação em lote
 * @bodyParams {string[]} bulkData.companies - Array de IDs das empresas (obrigatório)
 * @bodyParams {string} bulkData.funnelId - ID do funil (obrigatório)
 * @bodyParams {string} bulkData.stageId - ID do estágio inicial (obrigatório)
 * @bodyParams {string} bulkData.value - Valor monetário dos deals (obrigatório)
 * @bodyParams {string} bulkData.assignedTo - ID do usuário responsável (obrigatório)
 * @bodyParams {string} [bulkData.title] - Título base (gerado automaticamente se não fornecido)
 * @bodyParams {string} [bulkData.notes] - Observações padrão para todos os deals
 * @returns {Object} Resultado da operação em lote com estatísticas
 * @example Request Body:
 * {
 *   "companies": ["company-1", "company-2", "company-3"],
 *   "funnelId": "funnel-456",
 *   "stageId": "stage-1",
 *   "value": "10000.00",
 *   "assignedTo": "user-123",
 *   "title": "Campanha Q1 2024",
 *   "notes": "Criado via importação em lote"
 * }
 * @example Response:
 * {
 *   "success": true,
 *   "created": 2,
 *   "total": 3,
 *   "deals": [
 *     {
 *       "id": "deal-abc123",
 *       "title": "Negócio - Empresa XYZ Ltda",
 *       "value": "10000.00",
 *       "companyId": "company-1",
 *       "funnelId": "funnel-456",
 *       "stageId": "stage-1",
 *       "assignedTo": "user-123",
 *       "createdBy": "user-123",
 *       "notes": "Criado via importação em lote",
 *       "createdAt": "2023-01-01T00:00:00.000Z"
 *     },
 *     {
 *       "id": "deal-def456",
 *       "title": "Negócio - ABC Comércio S.A.",
 *       "value": "10000.00",
 *       "companyId": "company-2",
 *       "funnelId": "funnel-456",
 *       "stageId": "stage-1",
 *       "assignedTo": "user-123",
 *       "createdBy": "user-123",
 *       "notes": "Criado via importação em lote",
 *       "createdAt": "2023-01-01T00:00:00.000Z"
 *     }
 *   ],
 *   "errors": [
 *     "Empresa com ID company-3 não encontrada"
 *   ]
 * }
 * @notes
 *   - Operação resiliente: falhas individuais não impedem processamento das demais empresas
 *   - Título gerado automaticamente: "Negócio - [Nome Fantasia ou Razão Social]"
 *   - Todas as empresas devem existir no sistema para serem processadas
 *   - createdBy é definido automaticamente como o mesmo valor de assignedTo
 *   - Transação em lote otimizada para performance com múltiplas inserções
 *   - Retorna 201 se pelo menos um deal foi criado com sucesso
 *   - Campo errors contém detalhes de falhas individuais (se houver)
 *   - Útil para importações, campanhas de marketing e criação massiva de oportunidades
 */
dealsRouter.post("/bulk", createBulkDealsController);

/**
 * @route POST /api/deals/bulk-clients
 * @description Cria múltiplos deals simultaneamente para uma lista de clientes
 * @access Private (requer autenticação)
 * @bodyParams {Object} bulkData - Dados para criação em lote
 * @bodyParams {string[]} bulkData.clients - Array de IDs dos clientes (obrigatório)
 * @bodyParams {string} bulkData.funnelId - ID do funil (obrigatório)
 * @bodyParams {string} bulkData.stageId - ID do estágio inicial (obrigatório)
 * @bodyParams {string} bulkData.value - Valor monetário dos deals (obrigatório)
 * @bodyParams {string} bulkData.assignedTo - ID do usuário responsável (obrigatório)
 * @bodyParams {string} [bulkData.title] - Título base (gerado automaticamente se não fornecido)
 * @bodyParams {string} [bulkData.notes] - Observações padrão para todos os deals
 * @returns {Object} Resultado da operação em lote com estatísticas
 * @example Request Body:
 * {
 *   "clients": ["client-1", "client-2", "client-3"],
 *   "funnelId": "funnel-456",
 *   "stageId": "stage-1",
 *   "value": "5000.00",
 *   "assignedTo": "user-123",
 *   "title": "Campanha B2C Q1 2024",
 *   "notes": "Criado via importação em lote de clientes"
 * }
 * @example Response:
 * {
 *   "success": true,
 *   "created": 2,
 *   "total": 3,
 *   "errors": 1,
 *   "errorDetails": [
 *     "Cliente com ID client-3 não encontrado"
 *   ],
 *   "deals": [
 *     {
 *       "id": "deal-abc123",
 *       "title": "Negócio - João Silva",
 *       "value": "5000.00",
 *       "clientId": "client-1",
 *       "funnelId": "funnel-456",
 *       "stageId": "stage-1",
 *       "assignedTo": "user-123",
 *       "createdBy": "user-123",
 *       "notes": "Criado via importação em lote de clientes",
 *       "createdAt": "2023-01-01T00:00:00.000Z"
 *     },
 *     {
 *       "id": "deal-def456",
 *       "title": "Negócio - Maria Santos",
 *       "value": "5000.00",
 *       "clientId": "client-2",
 *       "funnelId": "funnel-456",
 *       "stageId": "stage-1",
 *       "assignedTo": "user-123",
 *       "createdBy": "user-123",
 *       "notes": "Criado via importação em lote de clientes",
 *       "createdAt": "2023-01-01T00:00:00.000Z"
 *     }
 *   ]
 * }
 * @notes
 *   - Operação resiliente: falhas individuais não impedem processamento dos demais clientes
 *   - Título gerado automaticamente: "Negócio - [Nome do Cliente]"
 *   - Todos os clientes devem existir no sistema para serem processados
 *   - createdBy é definido automaticamente como o mesmo valor de assignedTo
 *   - Transação em lote otimizada para performance com múltiplas inserções
 *   - Retorna 201 se pelo menos um deal foi criado com sucesso
 *   - Campo errorDetails contém detalhes de falhas individuais (se houver)
 *   - Útil para campanhas B2C, prospecção ativa e criação massiva de oportunidades
 *   - Diferença da rota /bulk: trabalha com clientes individuais em vez de empresas
 */
dealsRouter.post("/bulk-clients", createBulkDealsClientsController);

/**
 * @route PUT /api/deals/:dealId
 * @description Atualiza um deal existente
 * @access Private (requer autenticação)
 * @pathParams {string} dealId - ID do deal a ser atualizado
 * @bodyParams {Object} [deal] - Dados parciais do deal para atualização
 * @bodyParams {string} [deal.title] - Título do deal
 * @bodyParams {string} [deal.value] - Valor monetário do deal (será validado como número)
 * @bodyParams {string} [deal.stageId] - ID do estágio do funil
 * @bodyParams {string} [deal.funnelId] - ID do funil
 * @bodyParams {string} [deal.clientId] - ID do cliente associado
 * @bodyParams {string} [deal.companyId] - ID da empresa associada
 * @bodyParams {string} [deal.assignedTo] - ID do usuário responsável
 * @bodyParams {string} [deal.status] - Status do deal (active, won, lost, etc.)
 * @bodyParams {string} [deal.notes] - Observações sobre o deal
 * @returns {Object} Deal atualizado com dados completos
 * @example Request Body:
 * {
 *   "title": "Venda Atualizada - Empresa XYZ",
 *   "value": "75000.50",
 *   "stageId": "stage-3",
 *   "status": "active",
 *   "notes": "Cliente confirmou interesse em pacote premium"
 * }
 * @example Response:
 * {
 *   "id": "deal-123",
 *   "title": "Venda Atualizada - Empresa XYZ",
 *   "value": "75000.50",
 *   "stageId": "stage-3",
 *   "funnelId": "funnel-456",
 *   "clientId": "client-789",
 *   "companyId": "company-456",
 *   "assignedTo": "user-123",
 *   "status": "active",
 *   "notes": "Cliente confirmou interesse em pacote premium",
 *   "createdAt": "2023-01-01T00:00:00.000Z",
 *   "updatedAt": "2023-01-02T15:30:00.000Z"
 * }
 * @notes
 *   - Atualização parcial (partial update) - apenas campos fornecidos são atualizados
 *   - Validação completa via Zod schema (updateDealSchema)
 *   - Valor monetário é convertido e validado como número
 *   - updatedAt é automaticamente atualizado
 *   - Retorna 404 se deal não existir
 *   - Retorna 200 (OK) em caso de sucesso
 */
dealsRouter.put("/:dealId", putDealController);

/**
 * @route DELETE /api/deals/:id
 * @description Exclui um deal existente permanentemente
 * @access Private (requer autenticação)
 * @pathParams {string} id - ID do deal a ser excluído
 * @returns {void} Resposta vazia com status 204 (No Content)
 * @example Response:
 * Status: 204 No Content
 * (Corpo da resposta vazio)
 * @notes
 *   - Operação irreversível - deal será permanentemente removido
 *   - Não requer dados no corpo da requisição
 *   - Retorna 404 se deal não existir
 *   - Retorna 204 (No Content) em caso de sucesso
 *   - Não exclui dados relacionados automaticamente (clientes, empresas permanecem)
 *   - ATENÇÃO: Pode afetar relatórios e históricos se usado incorretamente
 *   - Considerar soft delete para preservar histórico se necessário
 *   - Recomenda-se confirmar a operação no frontend antes de chamar
 */
dealsRouter.delete("/:id", deleteDealController);

// TODO: Migrar outras rotas de deals para este arquivo:
// - ✅ GET /deals (MIGRADO - busca de deals)
// - ✅ POST /deals (MIGRADO - criação de deal)
// - ✅ POST /deals/bulk (MIGRADO - criação em lote para empresas)
// - ✅ POST /deals/bulk-clients (MIGRADO - criação em lote para clientes)
// - ✅ PUT /deals/:dealId (MIGRADO - atualização de deal)
// - ✅ DELETE /deals/:id (MIGRADO - exclusão de deal)
// - GET /deals/:dealId/complete (completar deal)
