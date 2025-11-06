import type { Request, Response } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { dealsService } from "../../services/deals.service";
import { insertDealSchema } from "../../../shared/schema";

/**
 * Controller para criação de deals (negócios)
 *
 * **Endpoint:** `POST /api/deals`
 *
 * **Funcionalidades:**
 * - Cria um novo deal no sistema
 * - Valida dados de entrada usando Zod schema
 * - Valida valores monetários (parsing e formatação)
 * - Gera título automático baseado no cliente/empresa se não fornecido
 * - Aplica regras de negócio definidas no insertDealSchema
 *
 * **Validações:**
 * - Pelo menos um de clientId ou companyId deve ser fornecido
 * - Valor deve ser numérico válido (se fornecido)
 * - Campos obrigatórios: funnelId, stageId, assignedTo, createdBy
 *
 * **Comportamentos Especiais:**
 * - Se title não for fornecido, gera automaticamente baseado no nome do cliente/empresa
 * - Converte valores monetários para string formatada
 * - Retorna o deal criado com ID gerado
 *
 * **Códigos de Resposta:**
 * - 201: Deal criado com sucesso
 * - 400: Dados inválidos ou erro de validação
 * - 500: Erro interno do servidor
 *
 * @param req - Objeto de requisição Express contendo os dados do deal no body
 * @param res - Objeto de resposta Express
 */
export async function createDealController(req: Request, res: Response) {
  try {
    // Validação dos dados de entrada com Zod
    const validatedData = insertDealSchema.parse(req.body);

    // Processa parâmetros da requisição
    const params = dealsService.processCreateDealParams({
      ...req,
      body: validatedData,
    });

    // Cria o deal através do service
    const deal = await dealsService.createDeal(params);

    // Retorna o deal criado
    res.status(201).json(deal);
  } catch (error) {
    // Tratamento específico para erros de validação Zod
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }

    // Tratamento para erros conhecidos do service
    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }

    // Erro genérico do servidor
    console.error("Erro ao criar deal:", error);
    res.status(500).json({ message: "Erro interno do servidor" });
  }
}
