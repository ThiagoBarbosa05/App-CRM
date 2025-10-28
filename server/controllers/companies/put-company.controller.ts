import { Request, Response } from "express";
import { z } from "zod";
import { insertCompanySchema } from "@shared/schema";
import { companiesService } from "../../services/companies.service";

/**
 * Controller para atualização de empresas
 * PUT /api/companies/:id
 */
export const putCompanyController = async (req: Request, res: Response) => {
  try {
    // Validação do schema (partial para permitir atualizações parciais)
    const validatedData = insertCompanySchema.partial().parse(req.body);

    // Processar parâmetros
    const params = companiesService.processUpdateCompanyParams({
      ...req,
      body: validatedData,
    });

    // Executar atualização da empresa
    const company = await companiesService.updateCompany(params);

    res.status(200).json({
      success: true,
      message: "Empresa atualizada com sucesso",
      data: company,
    });
  } catch (error) {
    console.error("Erro na atualização de empresa:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Dados de entrada inválidos",
        errors: error.errors,
      });
    }

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

        case "CNPJ já cadastrado":
          return res.status(409).json({
            success: false,
            message: error.message,
          });

        default:
          return res.status(500).json({
            success: false,
            message: "Erro ao atualizar empresa",
          });
      }
    }

    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    });
  }
};
