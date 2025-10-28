import { Request, Response } from "express";
import { companiesService } from "../../services/companies.service";

/**
 * Controller para busca de empresas
 * GET /api/companies
 */
export const getCompaniesController = async (req: Request, res: Response) => {
  try {
    // Processar parâmetros da requisição
    const params = companiesService.processGetCompaniesParams(req);

    // Executar busca de empresas
    const result = await companiesService.getCompanies(params);

    // Calcular dados de paginação
    const { page, pageSize } = params;
    const totalPages = Math.ceil(result.total / pageSize);

    res.status(200).json({
      data: result.data,
      currentPage: page,
      totalPages,
      totalItems: result.total,
      pageSize,
    });
  } catch (error) {
    console.error("Erro na busca de empresas:", error);

    if (error instanceof Error) {
      // Tratamento de erros específicos
      switch (error.message) {
        case "ID do usuário e role são obrigatórios":
          return res.status(400).json({
            success: false,
            message: error.message,
          });

        case "Página e tamanho da página devem ser positivos":
        case "Tamanho máximo da página é 100":
          return res.status(400).json({
            success: false,
            message: error.message,
          });

        default:
          return res.status(500).json({
            success: false,
            message: "Erro ao buscar empresas",
          });
      }
    }

    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    });
  }
};
