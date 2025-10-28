import { Request, Response } from "express";
import { funnelsService } from "../../services/funnels.service";

/**
 * Controller responsável por buscar todos os estágios de um funil específico
 *
 * @description
 * Este controller processa requisições para listar estágios de um funil de vendas.
 * Retorna todos os estágios ordenados pela sua posição/ordem no funil.
 *
 * @route GET /api/funnels/:funnelId/stages
 * @access Private (requer autenticação)
 * @pathParams {string} funnelId - ID do funil cujos estágios serão buscados
 *
 * @returns {Array} - Lista de estágios do funil:
 *   - id: string - ID único do estágio
 *   - funnelId: string - ID do funil ao qual pertence
 *   - name: string - Nome do estágio
 *   - order: number - Posição/ordem do estágio no funil
 *   - color: string - Cor hexadecimal para visualização
 *   - createdAt: Date - Data de criação do estágio
 *
 * @example
 * GET /api/funnels/funnel-456/stages
 *
 * Response:
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
 *
 * @throws {400} - ID do funil ausente ou inválido
 * @throws {401} - Token de acesso inválido ou ausente
 * @throws {500} - Erro interno do servidor
 *
 * @notes
 *   - Estágios são retornados ordenados por campo 'order' (crescente)
 *   - Retorna array vazio se o funil não possuir estágios
 *   - Não valida se o funil existe - apenas retorna estágios relacionados ao ID
 *   - Útil para construção de interfaces de kanban/pipeline
 *   - Cada estágio pode conter múltiplos deals/negócios
 */
export async function getFunnelStagesController(req: Request, res: Response) {
  try {
    // Processa os parâmetros da requisição
    const params = funnelsService.processGetFunnelStagesParams(req);

    // Busca os estágios do funil
    const stages = await funnelsService.getFunnelStages(params);

    // Retorna os estágios encontrados
    res.status(200).json(stages);
  } catch (error) {
    console.error("Erro ao buscar estágios do funil:", error);

    if (error instanceof Error) {
      // Erros de validação de negócio retornam 400
      if (
        error.message.includes("obrigatório") ||
        error.message.includes("inválido")
      ) {
        return res.status(400).json({
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
      message: "Erro ao buscar estágios do funil",
    });
  }
}
