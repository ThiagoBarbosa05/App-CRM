import { Request, Response } from "express";
import { funnelsService } from "../../services/funnels.service";

/**
 * Controller responsável por buscar todos os funis de vendas
 *
 * @description
 * Este controller processa requisições para listar funis de vendas.
 * Retorna todos os funis com seus estágios e dados do criador.
 *
 * @route GET /api/funnels
 * @access Private (requer autenticação)
 *
 * @returns {Array} - Lista de funis de vendas:
 *   - id: string - ID único do funil
 *   - name: string - Nome do funil
 *   - description: string - Descrição do funil
 *   - isActive: string - Status ativo/inativo
 *   - createdBy: string - ID do criador
 *   - createdAt: Date - Data de criação
 *   - updatedAt: Date - Data da última atualização
 *   - stages: Array - Estágios do funil ordenados
 *   - creator: Object - Dados do usuário criador
 *
 * @example
 * GET /api/funnels
 *
 * Response:
 * [
 *   {
 *     "id": "123",
 *     "name": "Funil de Vendas Principal",
 *     "description": "Funil principal para vendas B2B",
 *     "isActive": "true",
 *     "createdBy": "user-456",
 *     "createdAt": "2023-01-01T00:00:00.000Z",
 *     "updatedAt": "2023-01-02T00:00:00.000Z",
 *     "stages": [
 *       {
 *         "id": "stage-1",
 *         "name": "Prospecção",
 *         "order": 1,
 *         "color": "#3B82F6"
 *       }
 *     ],
 *     "creator": {
 *       "id": "user-456",
 *       "name": "João Silva",
 *       "email": "joao@empresa.com"
 *     }
 *   }
 * ]
 *
 * @throws {401} - Token de acesso inválido ou ausente
 * @throws {500} - Erro interno do servidor
 */
export async function getFunnelsController(req: Request, res: Response) {
  try {
    // Processa os parâmetros da requisição
    const params = funnelsService.processGetFunnelsParams(req);

    // Busca os funis de vendas
    const funnels = await funnelsService.getFunnels(params);

    // Retorna os funis encontrados
    res.status(200).json(funnels);
  } catch (error) {
    console.error("Erro ao buscar funis de vendas:", error);

    if (error instanceof Error) {
      // Retorna erro específico se disponível
      return res.status(500).json({
        message: error.message,
      });
    }

    // Erro genérico
    res.status(500).json({
      message: "Erro ao buscar funis de vendas",
    });
  }
}
