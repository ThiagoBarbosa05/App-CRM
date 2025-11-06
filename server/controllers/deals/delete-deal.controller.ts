import { Request, Response } from "express";
import { dealsService } from "../../services/deals.service";

/**
 * Controller responsável por excluir um deal (negócio) existente
 *
 * @description
 * Este controller processa requisições para exclusão de deals.
 * Remove permanentemente o deal do sistema. Esta operação é irreversível
 * e deve ser usada com cuidado.
 *
 * @route DELETE /api/deals/:id
 * @access Private (requer autenticação)
 * @pathParams {string} id - ID do deal a ser excluído (obrigatório)
 *
 * @returns {void} - Resposta vazia com status 204 (No Content) em caso de sucesso
 *
 * @example
 * DELETE /api/deals/deal-123
 *
 * Response:
 * Status: 204 No Content
 * (Corpo da resposta vazio)
 *
 * @throws {400} - Dados inválidos:
 *   - ID do deal ausente ou inválido
 * @throws {401} - Token de acesso inválido ou ausente
 * @throws {404} - Deal não encontrado
 * @throws {500} - Erro interno do servidor
 *
 * @notes
 *   - Operação irreversível - deal será permanentemente removido
 *   - Não requer dados no corpo da requisição
 *   - Retorna 404 se deal não existir
 *   - Retorna 204 (No Content) em caso de sucesso
 *   - Não exclui dados relacionados automaticamente (clientes, empresas permanecem)
 *   - ATENÇÃO: Pode afetar relatórios e históricos se usado incorretamente
 *   - Considerar soft delete para preservar histórico se necessário
 *   - Útil para limpeza de dados de teste ou deals criados por engano
 *   - Recomenda-se confirmar a operação no frontend antes de chamar
 */
export async function deleteDealController(req: Request, res: Response) {
  try {
    // Processa os parâmetros da requisição
    const params = dealsService.processDeleteDealParams(req);

    // Exclui o deal
    await dealsService.deleteDeal(params);

    // Retorna status 204 (No Content) sem corpo da resposta
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir deal:", error);

    if (error instanceof Error) {
      // Erros de validação de negócio retornam 400
      if (error.message.includes("obrigatório")) {
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
      message: "Erro ao excluir deal",
    });
  }
}
