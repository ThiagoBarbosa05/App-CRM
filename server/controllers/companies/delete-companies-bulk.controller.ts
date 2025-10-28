import { Request, Response } from "express";
import { companiesService } from "../../services/companies.service";

/**
 * Controller responsável por excluir múltiplas empresas em lote
 *
 * @description
 * Este controller processa requisições para exclusão em lote de empresas.
 * Realiza validações básicas dos parâmetros e delegará a lógica de negócio
 * para o service correspondente.
 *
 * @route DELETE /api/companies
 * @access Private (requer autenticação)
 * @body {string[]} ids - Array com IDs das empresas a serem excluídas
 *
 * @returns {Object} - Resultado da operação:
 *   - deletedCount: número de empresas excluídas
 *
 * @example
 * DELETE /api/companies
 * Body: { "ids": ["123", "456", "789"] }
 *
 * Response:
 * {
 *   "deletedCount": 3
 * }
 *
 * @throws {400} - Parâmetros inválidos ou ausentes
 * @throws {401} - Token de acesso inválido ou ausente
 * @throws {500} - Erro interno do servidor
 */
export async function deleteCompaniesBulkController(
  req: Request,
  res: Response
) {
  try {
    // Processa os parâmetros da requisição
    const params = companiesService.processDeleteCompaniesBulkParams(req);

    // Executa a exclusão em lote
    const result = await companiesService.deleteCompaniesBulk(params);

    // Retorna o resultado
    res.status(200).json(result);
  } catch (error) {
    console.error("Erro ao excluir empresas em lote:", error);

    if (error instanceof Error) {
      // Erros de validação retornam 400
      if (
        error.message.includes("obrigatória") ||
        error.message.includes("inválidos") ||
        error.message.includes("Máximo")
      ) {
        return res.status(400).json({
          error: error.message,
        });
      }

      // Outros erros conhecidos retornam 500 com mensagem
      return res.status(500).json({
        error: error.message,
      });
    }

    // Erro genérico
    res.status(500).json({
      error: "Erro interno do servidor",
    });
  }
}
