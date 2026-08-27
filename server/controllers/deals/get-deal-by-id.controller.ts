import { Request, Response } from "express";
import { dealsService } from "../../services/deals.service";

/**
 * Controller responsável por buscar um único deal (negócio) pelo ID
 *
 * @description
 * Retorna um deal específico com dados relacionados (cliente, empresa,
 * responsável, estágio e funil), sem aplicar o filtro de visibilidade por
 * role usado na listagem geral. Usado para abrir diretamente os detalhes
 * de um negócio já conhecido, por exemplo a partir do perfil do cliente.
 *
 * @route GET /api/deals/:id
 * @access Private (requer autenticação)
 * @pathParams {string} id - ID do deal
 * @returns {object} Deal com dados relacionados, ou 404 se não encontrado
 */
export const getDealByIdController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deal = await dealsService.getDealById(id);

    if (!deal) {
      return res.status(404).json({ message: "Negócio não encontrado" });
    }

    return res.json(deal);
  } catch (error) {
    console.error("Erro ao buscar deal por ID:", error);
    return res.status(500).json({ message: "Erro ao buscar negócio" });
  }
};
