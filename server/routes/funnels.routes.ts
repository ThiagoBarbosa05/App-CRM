import { Router } from "express";
import { getFunnelsController } from "../controllers/funnels/get-funnels.controller";
import { postFunnelController } from "../controllers/funnels/post-funnel.controller";
import { putFunnelController } from "../controllers/funnels/put-funnel.controller";
import { deleteFunnelController } from "../controllers/funnels/delete-funnel.controller";
import { getFunnelStagesController } from "../controllers/funnels/get-funnel-stages.controller";
import { postFunnelStageController } from "../controllers/funnels/post-funnel-stage.controller";
import { putFunnelStagesReorderController } from "../controllers/funnels/put-funnel-stages-reorder.controller";

/**
 * Router específico para endpoints relacionados a funis de vendas
 * Segue padrão RESTful e organiza todas as rotas de funis
 */
export const funnelsRouter = Router();

/**
 * @route GET /api/funnels
 * @description Busca todos os funis de vendas com estágios e dados do criador
 * @access Private (requer autenticação)
 * @returns {Array} Lista completa de funis de vendas com estrutura hierárquica
 * @example Response:
 * [
 *   {
 *     "id": "123",
 *     "name": "Funil Principal",
 *     "description": "Funil de vendas B2B",
 *     "isActive": "true",
 *     "createdBy": "user-456",
 *     "createdAt": "2023-01-01T00:00:00.000Z",
 *     "updatedAt": "2023-01-02T00:00:00.000Z",
 *     "stages": [
 *       {
 *         "id": "stage-1",
 *         "funnelId": "123",
 *         "name": "Prospecção",
 *         "order": 1,
 *         "color": "#3B82F6",
 *         "createdAt": "2023-01-01T00:00:00.000Z"
 *       },
 *       {
 *         "id": "stage-2",
 *         "funnelId": "123",
 *         "name": "Qualificação",
 *         "order": 2,
 *         "color": "#10B981",
 *         "createdAt": "2023-01-01T00:00:00.000Z"
 *       }
 *     ],
 *     "creator": {
 *       "id": "user-456",
 *       "name": "João Silva",
 *       "email": "joao@empresa.com",
 *       "role": "admin"
 *     }
 *   }
 * ]
 * @notes
 *   - Retorna funis ordenados por data de criação
 *   - Inclui todos os estágios ordenados por campo 'order'
 *   - Inclui dados completos do usuário criador
 *   - Funis inativos também são retornados (filtro no frontend)
 *   - Operação otimizada com joins para evitar N+1 queries
 */
funnelsRouter.get("/", getFunnelsController);

/**
 * @route POST /api/funnels
 * @description Cria um novo funil de vendas
 * @access Private (requer autenticação)
 * @bodyParams {Object} funnel - Dados do funil
 * @bodyParams {string} funnel.name - Nome do funil (obrigatório)
 * @bodyParams {string} [funnel.description] - Descrição do funil
 * @bodyParams {string} [funnel.isActive="true"] - Status ativo/inativo (default: "true")
 * @bodyParams {string} funnel.createdBy - ID do usuário criador (obrigatório)
 * @returns {Object} Funil criado com dados completos
 * @example Request Body:
 * {
 *   "name": "Funil de Vendas B2B",
 *   "description": "Funil principal para vendas corporativas",
 *   "isActive": "true",
 *   "createdBy": "user-123"
 * }
 * @example Response:
 * {
 *   "id": "funnel-456",
 *   "name": "Funil de Vendas B2B",
 *   "description": "Funil principal para vendas corporativas",
 *   "isActive": "true",
 *   "createdBy": "user-123",
 *   "createdAt": "2023-01-01T00:00:00.000Z",
 *   "updatedAt": "2023-01-01T00:00:00.000Z"
 * }
 * @notes
 *   - Validação completa via Zod schema (insertSalesFunnelSchema)
 *   - Nome é obrigatório e não pode estar vazio
 *   - createdBy deve referenciar um usuário válido
 *   - isActive tem valor padrão "true" se não fornecido
 *   - Campos createdAt e updatedAt são automaticamente preenchidos
 *   - Retorna status 201 (Created) em caso de sucesso
 */
funnelsRouter.post("/", postFunnelController);

/**
 * @route PUT /api/funnels/:id
 * @description Atualiza um funil de vendas existente
 * @access Private (requer autenticação)
 * @pathParams {string} id - ID do funil a ser atualizado
 * @bodyParams {Object} [funnel] - Dados parciais do funil para atualização
 * @bodyParams {string} [funnel.name] - Nome do funil
 * @bodyParams {string} [funnel.description] - Descrição do funil
 * @bodyParams {string} [funnel.isActive] - Status ativo/inativo
 * @returns {Object} Funil atualizado com dados completos
 * @example Request Body:
 * {
 *   "name": "Funil de Vendas B2B Atualizado",
 *   "description": "Descrição atualizada do funil",
 *   "isActive": "false"
 * }
 * @example Response:
 * {
 *   "id": "funnel-456",
 *   "name": "Funil de Vendas B2B Atualizado",
 *   "description": "Descrição atualizada do funil",
 *   "isActive": "false",
 *   "createdBy": "user-123",
 *   "createdAt": "2023-01-01T00:00:00.000Z",
 *   "updatedAt": "2023-01-02T10:30:00.000Z"
 * }
 * @notes
 *   - Atualização parcial (partial update) - apenas campos fornecidos são atualizados
 *   - Validação via Zod schema partial (insertSalesFunnelSchema.partial())
 *   - Nome não pode estar vazio se fornecido
 *   - updatedAt é automaticamente atualizado
 *   - Retorna 404 se funil não existir
 *   - Retorna 200 (OK) em caso de sucesso
 *   - createdBy não pode ser alterado via atualização
 */
funnelsRouter.put("/:id", putFunnelController);

/**
 * @route DELETE /api/funnels/:id
 * @description Exclui um funil de vendas existente e todos os dados relacionados
 * @access Private (requer autenticação)
 * @pathParams {string} id - ID do funil a ser excluído
 * @returns {Object} Mensagem de confirmação da exclusão
 * @example Response:
 * {
 *   "message": "Funil de vendas excluído com sucesso"
 * }
 * @notes
 *   - Operação irreversível - funil será permanentemente removido
 *   - Exclui automaticamente todos os deals relacionados ao funil
 *   - Exclui automaticamente todos os estágios do funil
 *   - Retorna 404 se funil não existir
 *   - Não requer dados no corpo da requisição
 *   - ATENÇÃO: Pode afetar significativamente os dados do sistema
 *   - Dados relacionados são removidos em cascata para manter integridade
 *   - Considerar backup antes de operações de exclusão críticas
 */
funnelsRouter.delete("/:id", deleteFunnelController);

/**
 * @route GET /api/funnels/:funnelId/stages
 * @description Busca todos os estágios de um funil específico
 * @access Private (requer autenticação)
 * @pathParams {string} funnelId - ID do funil cujos estágios serão buscados
 * @returns {Array} Lista de estágios do funil ordenados por posição
 * @example Response:
 * [
 *   {
 *     "id": "stage-1",
 *     "funnelId": "funnel-456",
 *     "name": "Prospecção",
 *     "order": 1,
 *     "color": "#3B82F6",
 *     "createdAt": "2023-01-01T00:00:00.000Z"
 *   },
 *   {
 *     "id": "stage-2",
 *     "funnelId": "funnel-456",
 *     "name": "Qualificação",
 *     "order": 2,
 *     "color": "#10B981",
 *     "createdAt": "2023-01-01T00:00:00.000Z"
 *   },
 *   {
 *     "id": "stage-3",
 *     "funnelId": "funnel-456",
 *     "name": "Proposta",
 *     "order": 3,
 *     "color": "#F59E0B",
 *     "createdAt": "2023-01-01T00:00:00.000Z"
 *   },
 *   {
 *     "id": "stage-4",
 *     "funnelId": "funnel-456",
 *     "name": "Fechamento",
 *     "order": 4,
 *     "color": "#EF4444",
 *     "createdAt": "2023-01-01T00:00:00.000Z"
 *   }
 * ]
 * @notes
 *   - Estágios são retornados ordenados por campo 'order' (crescente)
 *   - Retorna array vazio se o funil não possuir estágios
 *   - Não valida se o funil existe - apenas retorna estágios relacionados ao ID
 *   - Útil para construção de interfaces de kanban/pipeline
 *   - Cada estágio pode conter múltiplos deals/negócios
 */
funnelsRouter.get("/stages/:funnelId", getFunnelStagesController);

/**
 * @route POST /api/funnel-stages/:funnelId
 * @description Cria um novo estágio em um funil específico
 * @access Private (requer autenticação)
 * @pathParams {string} funnelId - ID do funil onde o estágio será criado
 * @bodyParams {Object} stage - Dados do estágio
 * @bodyParams {string} stage.name - Nome do estágio (obrigatório)
 * @bodyParams {number} stage.order - Posição/ordem do estágio no funil (obrigatório, >= 1)
 * @bodyParams {string} [stage.color="#6B7280"] - Cor hexadecimal para visualização (default: cinza)
 * @returns {Object} Estágio criado com dados completos
 * @example Request Body:
 * {
 *   "name": "Qualificação Avançada",
 *   "order": 3,
 *   "color": "#10B981"
 * }
 * @example Response:
 * {
 *   "id": "stage-789",
 *   "funnelId": "funnel-456",
 *   "name": "Qualificação Avançada",
 *   "order": 3,
 *   "color": "#10B981",
 *   "createdAt": "2023-01-01T10:30:00.000Z"
 * }
 * @notes
 *   - Ordem deve ser única dentro do funil para evitar conflitos
 *   - Cor deve estar em formato hexadecimal (#RRGGBB)
 *   - Estágio é automaticamente associado ao funil especificado na URL
 *   - Sistema não valida automaticamente duplicação de ordens - responsabilidade do cliente
 *   - Cor padrão é aplicada se não especificada
 *   - Útil para construção dinâmica de pipelines de vendas
 *   - Retorna status 201 (Created) em caso de sucesso
 */
funnelsRouter.post("/stages/:funnelId", postFunnelStageController);

/**
 * @route PUT /api/funnel-stages/reorder
 * @description Reordena múltiplos estágios de funis em uma operação atômica
 * @access Private (requer autenticação)
 * @bodyParams {Object} body - Dados da reordenação
 * @bodyParams {Array} body.stageUpdates - Array de atualizações de estágios (obrigatório)
 * @bodyParams {string} body.stageUpdates[].id - ID do estágio a ser reordenado
 * @bodyParams {number} body.stageUpdates[].order - Nova ordem do estágio (>= 1)
 * @returns {Object} Mensagem de confirmação da operação
 * @example Request Body:
 * {
 *   "stageUpdates": [
 *     { "id": "stage-1", "order": 3 },
 *     { "id": "stage-2", "order": 1 },
 *     { "id": "stage-3", "order": 2 },
 *     { "id": "stage-4", "order": 4 }
 *   ]
 * }
 * @example Response:
 * {
 *   "message": "Estágios reordenados com sucesso"
 * }
 * @notes
 *   - Operação é executada em transação atômica - todas as atualizações são aplicadas ou nenhuma
 *   - Não verifica duplicação de ordens - responsabilidade do cliente
 *   - Todos os estágios são atualizados independentemente do funil ao qual pertencem
 *   - Útil para drag-and-drop de estágios em interfaces de kanban
 *   - Em caso de erro, nenhuma alteração é persistida no banco
 *   - Operação pode afetar múltiplos funis simultaneamente
 *   - Retorna status 200 (OK) em caso de sucesso
 */
funnelsRouter.put("/stages/reorder", putFunnelStagesReorderController);

// TODO: Migrar outras rotas de funis para este arquivo:
// - ✅ POST /funnels (MIGRADO - criação de funil)
// - ✅ PUT /funnels/:id (MIGRADO - atualização de funil)
// - ✅ DELETE /funnels/:id (MIGRADO - exclusão de funil)
// - ✅ GET /funnels/:funnelId/stages (MIGRADO - estágios do funil)
// - ✅ POST /funnel-stages/:funnelId (MIGRADO - criação de estágio)
// - ✅ PUT /funnel-stages/reorder (MIGRADO - reordenação de estágios)
// - PUT /funnel-stages/:id (atualização de estágio)
// - DELETE /funnel-stages/:id (exclusão de estágio)
