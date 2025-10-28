import { Request, Response } from "express";
import { z } from "zod";
import { insertCompanySchema } from "@shared/schema";
import { companiesService } from "../../services/companies.service";

/**
 * Controller para criação de empresas
 * POST /api/companies
 */
export const postCompanyController = async (req: Request, res: Response) => {
  try {
    // Validação do schema
    const validatedData = insertCompanySchema.parse(req.body);

    // Processar parâmetros
    const params = companiesService.processCreateCompanyParams({
      ...req,
      body: validatedData,
    });

    // Executar criação da empresa
    const company = await companiesService.createCompany(params);

    res.status(201).json({
      success: true,
      message: "Empresa criada com sucesso",
      data: company,
    });
  } catch (error) {
    console.error("Erro na criação de empresa:", error);

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
        case "Nome fantasia e razão social são obrigatórios":
          return res.status(400).json({
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
            message: "Erro ao criar empresa",
          });
      }
    }

    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    });
  }
};
