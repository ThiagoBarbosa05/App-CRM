import { Request, Response } from "express";
import { funnelsService } from "../../services/funnels.service";

/**
 * Controller responsável por reordenar múltiplos estágios de funis
 *
 * @description
 * Este controller processa requisições para reordenação em lote de estágios de funis.
 * Permite alterar a ordem de múltiplos estágios em uma única operação atômica,
 * garantindo consistência dos dados durante a reorganização.
 *
 * @route PUT /api/funnel-stages/reorder
 * @access Private (requer autenticação)
 * @bodyParams {Object} body - Dados da reordenação
 * @bodyParams {Array} body.stageUpdates - Array de atualizações de estágios (obrigatório)
 * @bodyParams {string} body.stageUpdates[].id - ID do estágio a ser reordenado
 * @bodyParams {number} body.stageUpdates[].order - Nova ordem do estágio (>= 1)
 *
 * @returns {Object} - Mensagem de confirmação:
 *   - message: string - Confirmação da operação bem-sucedida
 *
 * @example
 * PUT /api/funnel-stages/reorder
 * Content-Type: application/json
 *
 * Request Body:
 * {
 *   "stageUpdates": [
 *     { "id": "stage-1", "order": 3 },
 *     { "id": "stage-2", "order": 1 },
 *     { "id": "stage-3", "order": 2 },
 *     { "id": "stage-4", "order": 4 }
 *   ]
 * }
 *
 * Response:
 * {
 *   "message": "Estágios reordenados com sucesso"
 * }
 *
 * @throws {400} - Dados inválidos ou ausentes:
 *   - stageUpdates ausente ou não é um array
 *   - Array vazio de atualizações
 *   - ID do estágio ausente ou inválido
 *   - Ordem ausente, inválida ou menor que 1
 * @throws {401} - Token de acesso inválido ou ausente
 * @throws {500} - Erro interno do servidor ou falha na transação
 *
 * @notes
 *   - Operação é executada em transação atômica - todas as atualizações são aplicadas ou nenhuma
 *   - Não verifica duplicação de ordens - responsabilidade do cliente
 *   - Todos os estágios são atualizados independentemente do funil ao qual pertencem
 *   - Útil para drag-and-drop de estágios em interfaces de kanban
 *   - Considera apenas os IDs e ordens fornecidos, ignorando outros campos
 *   - Em caso de erro, nenhuma alteração é persistida no banco
 *   - Operação pode afetar múltiplos funis simultaneamente
 *   - Retorna status 200 (OK) em caso de sucesso
 */
export async function putFunnelStagesReorderController(
  req: Request,
  res: Response
) {
  try {
    // Processa os parâmetros da requisição
    const params = funnelsService.processReorderFunnelStagesParams(req);

    // Reordena os estágios
    await funnelsService.reorderFunnelStages(params);

    // Retorna mensagem de sucesso
    res.status(200).json({
      message: "Estágios reordenados com sucesso",
    });
  } catch (error) {
    console.error("Erro ao reordenar estágios:", error);

    if (error instanceof Error) {
      // Erros de validação de negócio retornam 400
      if (
        error.message.includes("array") ||
        error.message.includes("obrigatório") ||
        error.message.includes("vazia") ||
        error.message.includes("maior que zero")
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
      message: "Erro ao reordenar estágios",
    });
  }
}
