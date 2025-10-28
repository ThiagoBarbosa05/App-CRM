import { Request, Response } from "express";
import { companiesService } from "../../services/companies.service";

/**
 * Controller para exclusão de empresas
 * DELETE /api/companies/:id
 */
export const deleteCompanyController = async (req: Request, res: Response) => {
  try {
    // Processar parâmetros
    const params = companiesService.processDeleteCompanyParams(req);

    // Executar exclusão da empresa
    await companiesService.deleteCompany(params);

    res.status(200).json({
      success: true,
      message: "Empresa excluída com sucesso",
    });
  } catch (error) {
    console.error("Erro na exclusão de empresa:", error);

    if (error instanceof Error) {
      // Tratamento de erros específicos
      switch (error.message) {
        case "ID da empresa é obrigatório":
          return res.status(400).json({
            success: false,
            message: error.message,
          });

        case "Empresa não encontrada":
          return res.status(404).json({
            success: false,
            message: error.message,
          });

        default:
          return res.status(500).json({
            success: false,
            message: "Erro ao excluir empresa",
          });
      }
    }

    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    });
  }
};
