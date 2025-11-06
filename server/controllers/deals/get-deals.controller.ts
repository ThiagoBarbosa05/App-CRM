import { Request, Response } from "express";
import { dealsService } from "../../services/deals.service";

/**
 * Controller responsável por buscar todos os deals (negócios) do sistema
 *
 * @description
 * Este controller processa requisições para listagem de deals com dados relacionados.
 * Retorna deals com informações completas de clientes, empresas, usuários responsáveis,
 * estágios e funis associados. Suporta filtros por funil e controle de acesso por role.
 *
 * @route GET /api/deals
 * @access Private (requer autenticação)
 * @queryParams {string} [funnelId] - ID do funil para filtrar deals específicos
 * @queryParams {string} [userId] - ID do usuário (usado para controle de acesso)
 * @queryParams {string} [userRole] - Role do usuário (admin/vendedor para controle de acesso)
 *
 * @returns {Array} - Lista de deals com dados relacionados:
 *   - Deal properties: id, title, value, stageId, funnelId, clientId, companyId, assignedTo, status, notes, createdAt, updatedAt
 *   - client: object | null - Dados completos do cliente associado
 *   - company: object | null - Dados completos da empresa associada
 *   - assignedUser: object | null - Dados do usuário responsável pelo deal
 *   - stage: object | null - Dados do estágio atual do deal
 *   - funnel: object | null - Dados do funil ao qual o deal pertence
 *
 * @example
 * GET /api/deals
 * GET /api/deals?funnelId=funnel-123&userId=user-456&userRole=vendedor
 *
 * Response:
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
 *
 * @throws {400} - Parâmetros inválidos
 * @throws {401} - Token de acesso inválido ou ausente
 * @throws {500} - Erro interno do servidor
 *
 * @notes
 *   - Deals são retornados ordenados por data de criação (mais recentes primeiro)
 *   - Controle de acesso: vendedores veem apenas seus próprios deals
 *   - Administradores veem todos os deals do sistema
 *   - Filtro por funnelId limita resultados ao funil específico
 *   - Campos relacionados podem ser null se não houver associação
 *   - Query otimizada com LEFT JOINs para evitar N+1 queries
 *   - Suporta paginação implícita via ordenação por data
 *   - Útil para construção de dashboards e relatórios
 *   - Dados sensíveis são filtrados conforme permissões do usuário
 */
export async function getDealsController(req: Request, res: Response) {
  try {
    // Processa os parâmetros da requisição
    const params = dealsService.processGetDealsParams(req);

    // Busca os deals
    const deals = await dealsService.getDeals(params);

    // Retorna os deals encontrados
    res.status(200).json(deals);
  } catch (error) {
    console.error("Erro ao buscar deals:", error);

    if (error instanceof Error) {
      // Outros erros conhecidos retornam 500 com mensagem
      return res.status(500).json({
        message: error.message,
      });
    }

    // Erro genérico
    res.status(500).json({
      message: "Erro ao buscar deals",
    });
  }
}
