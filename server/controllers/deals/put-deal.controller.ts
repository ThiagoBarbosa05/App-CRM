import { Request, Response } from "express";
import { dealsService } from "../../services/deals.service";

/**
 * Controller responsável por atualizar um deal (negócio) existente
 *
 * @description
 * Este controller processa requisições para atualização de deals.
 * Permite atualização parcial de campos como título, valor, estágio, usuário responsável,
 * status e observações. Inclui validação específica para valores monetários.
 *
 * @route PUT /api/deals/:dealId
 * @access Private (requer autenticação)
 * @pathParams {string} dealId - ID do deal a ser atualizado (obrigatório)
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
 *
 * @returns {Object} - Deal atualizado:
 *   - id: string - ID único do deal
 *   - title: string - Título do deal
 *   - value: string - Valor monetário
 *   - stageId: string - ID do estágio atual
 *   - funnelId: string - ID do funil
 *   - clientId: string | null - ID do cliente
 *   - companyId: string | null - ID da empresa
 *   - assignedTo: string - ID do usuário responsável
 *   - status: string - Status atual
 *   - notes: string | null - Observações
 *   - createdAt: Date - Data de criação
 *   - updatedAt: Date - Data da última atualização
 *
 * @example
 * PUT /api/deals/deal-123
 * Content-Type: application/json
 *
 * Request Body:
 * {
 *   "title": "Venda Atualizada - Empresa XYZ",
 *   "value": "75000.50",
 *   "stageId": "stage-3",
 *   "status": "active",
 *   "notes": "Cliente confirmou interesse em pacote premium"
 * }
 *
 * Response:
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
 *
 * @throws {400} - Dados inválidos:
 *   - ID do deal ausente ou inválido
 *   - Valor monetário em formato inválido
 *   - Violação de constraints do schema
 * @throws {401} - Token de acesso inválido ou ausente
 * @throws {404} - Deal não encontrado
 * @throws {500} - Erro interno do servidor
 *
 * @notes
 *   - Atualização parcial (partial update) - apenas campos fornecidos são atualizados
 *   - Validação completa via Zod schema (updateDealSchema)
 *   - Valor monetário é convertido e validado como número
 *   - updatedAt é automaticamente atualizado
 *   - Não permite alterar createdAt, id ou outros campos protegidos
 *   - Retorna 200 (OK) em caso de sucesso
 *   - Campos não fornecidos mantêm seus valores anteriores
 *   - Validação de relacionamentos (stageId, funnelId, etc.) depende das constraints do DB
 */
export async function putDealController(req: Request, res: Response) {
  try {
    // Processa os parâmetros da requisição
    const params = dealsService.processUpdateDealParams(req);

    // Atualiza o deal
    const deal = await dealsService.updateDeal(params);

    // Retorna o deal atualizado
    res.status(200).json(deal);
  } catch (error) {
    console.error("Erro ao atualizar deal:", error);

    if (error instanceof Error) {
      // Erros de validação de negócio retornam 400
      if (
        error.message.includes("obrigatório") ||
        error.message.includes("inválido") ||
        error.message.includes("Valor inválido")
      ) {
        return res.status(400).json({
          message: error.message,
        });
      }

      // Deal não encontrado retorna 404
      if (error.message.includes("não encontrado")) {
        return res.status(404).json({
          message: error.message,
        });
      }

      // Outros erros conhecidos retornam 500 com mensagem
      return res.status(500).json({
        message: error.message,
      });
    }

    // Erro genérico
    res.status(500).json({
      message: "Erro ao atualizar deal",
    });
  }
}
