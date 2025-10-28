import { Request, Response } from "express";
import { funnelsService } from "../../services/funnels.service";

/**
 * Controller responsável por criar um novo estágio em um funil específico
 *
 * @description
 * Este controller processa requisições para criação de estágios em funis de vendas.
 * Permite adicionar novos estágios com nome, ordem e cor personalizados.
 *
 * @route POST /api/funnel-stages/:funnelId
 * @access Private (requer autenticação)
 * @pathParams {string} funnelId - ID do funil onde o estágio será criado
 * @bodyParams {Object} stage - Dados do estágio
 * @bodyParams {string} stage.name - Nome do estágio (obrigatório)
 * @bodyParams {number} stage.order - Posição/ordem do estágio no funil (obrigatório, >= 1)
 * @bodyParams {string} [stage.color="#6B7280"] - Cor hexadecimal para visualização (default: cinza)
 *
 * @returns {Object} - Estágio criado:
 *   - id: string - ID único do estágio
 *   - funnelId: string - ID do funil ao qual pertence
 *   - name: string - Nome do estágio
 *   - order: number - Posição/ordem do estágio no funil
 *   - color: string - Cor hexadecimal para visualização
 *   - createdAt: Date - Data de criação do estágio
 *
 * @example
 * POST /api/funnel-stages/funnel-456
 * Content-Type: application/json
 *
 * Request Body:
 * {
 *   "name": "Qualificação Avançada",
 *   "order": 3,
 *   "color": "#10B981"
 * }
 *
 * Response:
 * {
 *   "id": "stage-789",
 *   "funnelId": "funnel-456",
 *   "name": "Qualificação Avançada",
 *   "order": 3,
 *   "color": "#10B981",
 *   "createdAt": "2023-01-01T10:30:00.000Z"
 * }
 *
 * @throws {400} - Dados inválidos ou ausentes:
 *   - ID do funil ausente ou inválido
 *   - Nome do estágio ausente ou vazio
 *   - Ordem do estágio ausente, inválida ou menor que 1
 *   - Cor em formato inválido
 * @throws {401} - Token de acesso inválido ou ausente
 * @throws {500} - Erro interno do servidor
 *
 * @notes
 *   - Ordem deve ser única dentro do funil para evitar conflitos
 *   - Cor deve estar em formato hexadecimal (#RRGGBB)
 *   - Estágio é automaticamente associado ao funil especificado na URL
 *   - Sistema não valida automaticamente duplicação de ordens - responsabilidade do cliente
 *   - Cor padrão é aplicada se não especificada
 *   - Útil para construção dinâmica de pipelines de vendas
 *   - Considerar reordenação automática de estágios existentes se necessário
 */
export async function postFunnelStageController(req: Request, res: Response) {
  try {
    // Processa os parâmetros da requisição
    const params = funnelsService.processCreateFunnelStageParams(req);

    // Cria o estágio do funil
    const stage = await funnelsService.createFunnelStage(params);

    // Retorna o estágio criado com status 201
    res.status(201).json(stage);
  } catch (error) {
    console.error("Erro ao criar estágio do funil:", error);

    if (error instanceof Error) {
      // Erros de validação de negócio retornam 400
      if (
        error.message.includes("obrigatório") ||
        error.message.includes("inválido") ||
        error.message.includes("maior que zero") ||
        error.message.includes("vazio")
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
      message: "Erro ao criar estágio do funil",
    });
  }
}
