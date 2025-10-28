import { Request, Response } from "express";
import { funnelsService } from "../../services/funnels.service";
import { insertSalesFunnelSchema } from "../../../shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

/**
 * Controller responsável por atualizar um funil de vendas existente
 *
 * @description
 * Este controller processa requisições para atualização de funis de vendas.
 * Realiza validação parcial dos dados usando Zod schema e delega
 * a lógica de negócio para o service correspondente.
 *
 * @route PUT /api/funnels/:id
 * @access Private (requer autenticação)
 * @pathParams {string} id - ID do funil a ser atualizado
 * @bodyParams {Object} [funnel] - Dados parciais do funil para atualização
 * @bodyParams {string} [funnel.name] - Nome do funil
 * @bodyParams {string} [funnel.description] - Descrição do funil
 * @bodyParams {string} [funnel.isActive] - Status ativo/inativo
 *
 * @returns {Object} - Funil atualizado:
 *   - id: string - ID único do funil
 *   - name: string - Nome do funil
 *   - description: string - Descrição do funil
 *   - isActive: string - Status ativo/inativo
 *   - createdBy: string - ID do criador
 *   - createdAt: Date - Data de criação
 *   - updatedAt: Date - Data da última atualização (automaticamente atualizada)
 *
 * @example
 * PUT /api/funnels/funnel-456
 * Content-Type: application/json
 *
 * Body:
 * {
 *   "name": "Funil de Vendas B2B Atualizado",
 *   "description": "Descrição atualizada do funil",
 *   "isActive": "false"
 * }
 *
 * Response:
 * {
 *   "id": "funnel-456",
 *   "name": "Funil de Vendas B2B Atualizado",
 *   "description": "Descrição atualizada do funil",
 *   "isActive": "false",
 *   "createdBy": "user-123",
 *   "createdAt": "2023-01-01T00:00:00.000Z",
 *   "updatedAt": "2023-01-02T10:30:00.000Z"
 * }
 *
 * @throws {400} - Dados inválidos, ID ausente ou funil não encontrado
 * @throws {401} - Token de acesso inválido ou ausente
 * @throws {404} - Funil não encontrado
 * @throws {500} - Erro interno do servidor
 */
export async function putFunnelController(req: Request, res: Response) {
  try {
    // Validação dos dados usando Zod schema parcial
    const validatedData = insertSalesFunnelSchema.partial().parse(req.body);

    // Processa os parâmetros da requisição
    const params = funnelsService.processUpdateFunnelParams({
      ...req,
      body: validatedData,
    });

    // Atualiza o funil de vendas
    const funnel = await funnelsService.updateFunnel(params);

    // Retorna o funil atualizado
    res.status(200).json(funnel);
  } catch (error) {
    console.error("Erro ao atualizar funil de vendas:", error);

    // Erro de validação Zod
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({
        message: validationError.toString(),
      });
    }

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
        error.message.includes("inválido") ||
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
      message: "Erro ao atualizar funil de vendas",
    });
  }
}
