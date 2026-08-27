import { Request, Response } from "express";
import { dealsService } from "../../services/deals.service";

/**
 * Controller responsável pelo resumo (contagem e valor total) de deals por estágio
 *
 * @description
 * Alimenta os totais do cabeçalho de cada coluna do kanban. Aceita os mesmos
 * filtros da listagem, mas ignora o limite por estágio — assim os números
 * continuam corretos mesmo quando a lista de cards vem truncada.
 *
 * @route GET /api/deals/summary
 * @access Private (requer autenticação)
 * @queryParams {string} [funnelId] - ID do funil
 * @queryParams {string} [search] - Busca em título e observações
 * @queryParams {string} [assignedTo] - ID do responsável
 * @queryParams {number} [valueMin] - Valor mínimo do negócio
 * @queryParams {number} [valueMax] - Valor máximo do negócio
 * @queryParams {string} [dateFrom] - Data inicial (YYYY-MM-DD)
 * @queryParams {string} [dateTo] - Data final (YYYY-MM-DD, inclusiva)
 * @notes Controle de acesso (userId/role) vem do token, não da query string
 *
 * @returns {Array} - [{ stageId, count, totalValue }]
 *
 * @throws {500} - Erro interno do servidor
 */
export async function getDealsSummaryController(req: Request, res: Response) {
  try {
    const params = dealsService.processGetDealsParams(req);
    const summary = await dealsService.getDealsSummary(params);

    res.status(200).json(summary);
  } catch (error) {
    console.error("Erro ao buscar resumo dos deals:", error);

    if (error instanceof Error) {
      return res.status(500).json({ message: error.message });
    }

    res.status(500).json({ message: "Erro ao buscar resumo dos deals" });
  }
}
