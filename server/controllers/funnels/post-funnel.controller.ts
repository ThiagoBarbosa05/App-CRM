import { Request, Response } from "express";
import { funnelsService } from "../../services/funnels.service";
import { insertSalesFunnelSchema } from "../../../shared/schema";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";

/**
 * Controller responsável por criar um novo funil de vendas
 *
 * @description
 * Este controller processa requisições para criação de funis de vendas.
 * Realiza validação completa dos dados usando Zod schema e delega
 * a lógica de negócio para o service correspondente.
 *
 * @route POST /api/funnels
 * @access Private (requer autenticação)
 * @bodyParams {Object} funnel - Dados do funil
 * @bodyParams {string} funnel.name - Nome do funil (obrigatório)
 * @bodyParams {string} [funnel.description] - Descrição do funil
 * @bodyParams {string} [funnel.isActive="true"] - Status ativo/inativo
 * @bodyParams {string} funnel.createdBy - ID do usuário criador (obrigatório)
 *
 * @returns {Object} - Funil criado:
 *   - id: string - ID único do funil
 *   - name: string - Nome do funil
 *   - description: string - Descrição do funil
 *   - isActive: string - Status ativo/inativo
 *   - createdBy: string - ID do criador
 *   - createdAt: Date - Data de criação
 *   - updatedAt: Date - Data da última atualização
 *
 * @example
 * POST /api/funnels
 * Content-Type: application/json
 *
 * Body:
 * {
 *   "name": "Funil de Vendas B2B",
 *   "description": "Funil principal para vendas corporativas",
 *   "isActive": "true",
 *   "createdBy": "user-123"
 * }
 *
 * Response:
 * {
 *   "id": "funnel-456",
 *   "name": "Funil de Vendas B2B",
 *   "description": "Funil principal para vendas corporativas",
 *   "isActive": "true",
 *   "createdBy": "user-123",
 *   "createdAt": "2023-01-01T00:00:00.000Z",
 *   "updatedAt": "2023-01-01T00:00:00.000Z"
 * }
 *
 * @throws {400} - Dados inválidos ou ausentes (validação Zod)
 * @throws {401} - Token de acesso inválido ou ausente
 * @throws {500} - Erro interno do servidor
 */
export async function postFunnelController(req: Request, res: Response) {
  try {
    // Validação dos dados usando Zod schema
    const validatedData = insertSalesFunnelSchema.parse(req.body);

    // Processa os parâmetros da requisição
    const params = funnelsService.processCreateFunnelParams({
      ...req,
      body: validatedData,
    });

    // Cria o funil de vendas
    const funnel = await funnelsService.createFunnel(params);

    // Retorna o funil criado com status 201
    res.status(201).json(funnel);
  } catch (error) {
    console.error("Erro ao criar funil de vendas:", error);

    // Erro de validação Zod
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({
        message: validationError.toString(),
      });
    }

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
      message: "Erro ao criar funil de vendas",
    });
  }
}
