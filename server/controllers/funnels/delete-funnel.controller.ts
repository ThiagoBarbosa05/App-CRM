import { Request, Response } from "express";
import { funnelsService } from "../../services/funnels.service";

/**
 * Controller responsável por excluir um funil de vendas existente
 *
 * @description
 * Este controller processa requisições para exclusão de funis de vendas.
 * Realiza a exclusão completa do funil e todos os dados relacionados,
 * incluindo deals e estágios vinculados ao funil.
 *
 * @route DELETE /api/funnels/:id
 * @access Private (requer autenticação)
 * @pathParams {string} id - ID do funil a ser excluído
 *
 * @returns {Object} - Mensagem de confirmação da exclusão:
 *   - message: string - "Funil de vendas excluído com sucesso"
 *
 * @example
 * DELETE /api/funnels/funnel-456
 *
 * Response:
 * {
 *   "message": "Funil de vendas excluído com sucesso"
 * }
 *
 * @throws {400} - ID ausente ou inválido
 * @throws {401} - Token de acesso inválido ou ausente
 * @throws {404} - Funil não encontrado
 * @throws {500} - Erro interno do servidor
 *
 * @notes
 *   - Operação irreversível - funil será permanentemente removido
 *   - Exclui automaticamente todos os deals relacionados ao funil
 *   - Exclui automaticamente todos os estágios do funil
 *   - Dados relacionados são removidos em cascata para manter integridade
 *   - ATENÇÃO: Esta operação pode afetar significativamente os dados do sistema
 *   - Considerar backup ou confirmação adicional para operações críticas
 */
export async function deleteFunnelController(req: Request, res: Response) {
  try {
    // Processa os parâmetros da requisição
    const params = funnelsService.processDeleteFunnelParams(req);

    // Exclui o funil de vendas
    await funnelsService.deleteFunnel(params);

    // Retorna mensagem de sucesso
    res.status(200).json({
      message: "Funil de vendas excluído com sucesso",
    });
  } catch (error) {
    console.error("Erro ao excluir funil de vendas:", error);

    if (error instanceof Error) {
      // Funil não encontrado retorna 404
      if (error.message.includes("não encontrado")) {
        return res.status(404).json({
          message: error.message,
        });
      }

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
      message: "Erro ao excluir funil de vendas",
    });
  }
}
