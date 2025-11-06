import { Router } from "express";
import { getCompaniesController } from "../controllers/companies/get-companies.controller";
import { postCompanyController } from "../controllers/companies/post-company.controller";
import { putCompanyController } from "../controllers/companies/put-company.controller";
import { deleteCompanyController } from "../controllers/companies/delete-company.controller";
import { deleteCompaniesBulkController } from "../controllers/companies/delete-companies-bulk.controller";

/**
 * Router específico para endpoints relacionados a empresas
 * Segue padrão RESTful e organiza todas as rotas de empresas
 */
export const companiesRouter = Router();

/**
 * @route GET /api/companies
 * @description Busca empresas com filtros, paginação e controle de acesso
 * @access Private (baseado em role do usuário)
 * @queryParams {string} [search] - Busca geral por nome fantasia, razão social, CNPJ, email ou telefone
 * @queryParams {string} [nomeFantasia] - Filtro por nome fantasia
 * @queryParams {string} [razaoSocial] - Filtro por razão social
 * @queryParams {string} [cnpj] - Filtro por CNPJ
 * @queryParams {string} [responsavelId] - Filtro por responsável
 * @queryParams {number} [page=1] - Página atual (default: 1)
 * @queryParams {number} [pageSize=20] - Itens por página (default: 20, máximo: 100)
 * @queryParams {string} [userId] - ID do usuário (extraído do token/sessão)
 * @queryParams {string} [userRole] - Role do usuário (admin/gerente/vendedor)
 * @returns {Object} Lista paginada de empresas com metadados de paginação
 * @example Response:
 * {
 *   "data": [{"id": "123", "nomeFantasia": "Empresa ABC", ...}],
 *   "currentPage": 1,
 *   "totalPages": 5,
 *   "totalItems": 98,
 *   "pageSize": 20
 * }
 * @notes
 *   - Vendedores veem apenas empresas onde são responsáveis
 *   - Gerentes e admins veem todas as empresas
 *   - Inclui dados do setor e responsável via join
 *   - Ordenação por data de criação (mais recent first)
 */
companiesRouter.get("/", getCompaniesController);

/**
 * @route POST /api/companies
 * @description Cria uma nova empresa
 * @access Private
 * @bodyParams {Object} company - Dados da empresa
 * @bodyParams {string} company.nomeFantasia - Nome fantasia (obrigatório)
 * @bodyParams {string} company.razaoSocial - Razão social (obrigatório)
 * @bodyParams {string} [company.cnpj] - CNPJ (deve ser único se fornecido)
 * @bodyParams {string} [company.inscricaoEstadual] - Inscrição estadual
 * @bodyParams {string} [company.nomeComprador] - Nome do comprador
 * @bodyParams {string} [company.phone] - Telefone
 * @bodyParams {string} [company.fixedPhone] - Telefone fixo
 * @bodyParams {string} [company.email] - Email
 * @bodyParams {string} [company.website] - Website
 * @bodyParams {string} [company.cep] - CEP
 * @bodyParams {string} [company.address] - Endereço
 * @bodyParams {string} [company.neighborhood] - Bairro
 * @bodyParams {string} [company.city] - Cidade
 * @bodyParams {string} [company.state] - Estado
 * @bodyParams {string} [company.sectorId] - ID do setor
 * @bodyParams {string} [company.responsavelId] - ID do responsável
 * @bodyParams {string} [company.notes] - Observações
 * @bodyParams {boolean} [company.active=true] - Status ativo/inativo
 * @returns {Object} Empresa criada com dados completos
 * @example Response:
 * {
 *   "success": true,
 *   "message": "Empresa criada com sucesso",
 *   "data": {"id": "123", "nomeFantasia": "Empresa ABC", ...}
 * }
 * @notes
 *   - Validação completa via Zod schema
 *   - CNPJ deve ser único quando fornecido
 *   - sectorId e responsavelId são limpos se vazios
 *   - Campos opcionais podem ser null
 */
companiesRouter.post("/", postCompanyController);

/**
 * @route PUT /api/companies/:id
 * @description Atualiza uma empresa existente
 * @access Private
 * @pathParams {string} id - ID da empresa a ser atualizada
 * @bodyParams {Object} [company] - Dados da empresa para atualização (campos opcionais)
 * @bodyParams {string} [company.nomeFantasia] - Nome fantasia
 * @bodyParams {string} [company.razaoSocial] - Razão social
 * @bodyParams {string} [company.cnpj] - CNPJ (deve ser único se alterado)
 * @bodyParams {string} [company.inscricaoEstadual] - Inscrição estadual
 * @bodyParams {string} [company.nomeComprador] - Nome do comprador
 * @bodyParams {string} [company.phone] - Telefone
 * @bodyParams {string} [company.fixedPhone] - Telefone fixo
 * @bodyParams {string} [company.email] - Email
 * @bodyParams {string} [company.website] - Website
 * @bodyParams {string} [company.cep] - CEP
 * @bodyParams {string} [company.address] - Endereço
 * @bodyParams {string} [company.neighborhood] - Bairro
 * @bodyParams {string} [company.city] - Cidade
 * @bodyParams {string} [company.state] - Estado
 * @bodyParams {string} [company.sectorId] - ID do setor
 * @bodyParams {string} [company.responsavelId] - ID do responsável
 * @bodyParams {string} [company.notes] - Observações
 * @bodyParams {boolean} [company.active] - Status ativo/inativo
 * @returns {Object} Empresa atualizada com dados completos
 * @example Response:
 * {
 *   "success": true,
 *   "message": "Empresa atualizada com sucesso",
 *   "data": {"id": "123", "nomeFantasia": "Empresa ABC Atualizada", ...}
 * }
 * @notes
 *   - Atualização parcial (partial update) - apenas campos fornecidos são atualizados
 *   - Validação via Zod schema partial
 *   - CNPJ deve continuar único se alterado
 *   - sectorId e responsavelId são limpos se strings vazias
 *   - updatedAt é automaticamente atualizado
 *   - Retorna 404 se empresa não existir
 */
companiesRouter.put("/:id", putCompanyController);

/**
 * @route DELETE /api/companies/:id
 * @description Exclui uma empresa existente
 * @access Private
 * @pathParams {string} id - ID da empresa a ser excluída
 * @returns {Object} Mensagem de confirmação da exclusão
 * @example Response:
 * {
 *   "success": true,
 *   "message": "Empresa excluída com sucesso"
 * }
 * @notes
 *   - Operação irreversível - empresa será permanentemente removida
 *   - Retorna 404 se empresa não existir
 *   - Não requer dados no corpo da requisição
 *   - ATENÇÃO: Pode afetar dados relacionados (deals, produtos, etc.)
 *   - Considerar soft delete para casos onde há dados relacionados
 */
companiesRouter.delete("/:id", deleteCompanyController);

/**
 * @route DELETE /api/companies
 * @description Exclui múltiplas empresas em lote
 * @access Private
 * @bodyParams {string[]} ids - Array com IDs das empresas a serem excluídas
 * @returns {Object} Resultado da operação com contador de exclusões
 * @example Request Body:
 * {
 *   "ids": ["123", "456", "789"]
 * }
 * @example Response:
 * {
 *   "deletedCount": 3
 * }
 * @notes
 *   - Operação irreversível - empresas serão permanentemente removidas
 *   - Máximo de 100 empresas por operação (limite de segurança)
 *   - Todos os IDs devem ser válidos (strings não vazias)
 *   - Retorna o número de empresas efetivamente excluídas
 *   - ATENÇÃO: Pode afetar dados relacionados (deals, produtos, etc.)
 *   - Validação rigorosa do array de IDs
 */
companiesRouter.delete("/", deleteCompaniesBulkController);

// TODO: Migrar outras rotas de empresas para este arquivo:
// - ✅ POST /companies (MIGRADO)
// - ✅ PUT /companies/:id (MIGRADO)
// - ✅ DELETE /companies/:id (MIGRADO)
// - ✅ DELETE /companies (MIGRADO - exclusão em lote)
// - GET /companies/:companyId/products (produtos da empresa)
// - POST /companies/:companyId/products (adicionar produto à empresa)
// - DELETE /companies/:companyId/products/:productId (remover produto)
// - GET /companies/export-all (exportação)
// - POST /companies/import (importação)
