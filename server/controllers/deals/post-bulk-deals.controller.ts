import type { Request, Response } from "express";
import { dealsService } from "../../services/deals.service";

/**
 * Controller para criação de deals em lote (negócios)
 *
 * **Endpoint:** `POST /api/deals/bulk`
 *
 * **Funcionalidades:**
 * - Cria múltiplos deals simultaneamente para uma lista de empresas
 * - Aplica as mesmas configurações (funil, estágio, valor, responsável) para todos os deals
 * - Gera títulos automáticos baseados no nome das empresas
 * - Processa criação de forma resiliente (continua mesmo se algumas empresas falharem)
 * - Retorna resultado detalhado com sucessos e erros
 *
 * **Validações:**
 * - Lista de empresas deve ser fornecida e não estar vazia
 * - Responsável (assignedTo) é obrigatório
 * - Funil (funnelId) e estágio (stageId) são obrigatórios
 * - Cada empresa deve existir no sistema
 *
 * **Comportamentos Especiais:**
 * - Operação resiliente: falhas individuais não impedem o processamento das demais
 * - Títulos gerados automaticamente: "Negócio - [Nome da Empresa]"
 * - Fallback para admin user se assignedTo não fornecido
 * - createdBy é definido como o mesmo valor de assignedTo
 * - Transação em lote para otimizar performance
 *
 * **Códigos de Resposta:**
 * - 201: Pelo menos um deal foi criado com sucesso
 * - 400: Dados inválidos, lista vazia ou nenhum deal foi criado
 * - 500: Erro interno do servidor
 *
 * @param req - Objeto de requisição Express contendo os dados para criação em lote
 * @param res - Objeto de resposta Express
 */
export async function createBulkDealsController(req: Request, res: Response) {
  try {
    console.log(
      "=== BULK DEALS - BODY COMPLETO ===",
      JSON.stringify(req.body, null, 2)
    );

    // Processa parâmetros da requisição
    const params = dealsService.processCreateBulkDealsParams(req);

    console.log("=== BULK DEALS - DADOS EXTRAIDOS ===", {
      companies: params.companies?.length,
      funnelId: params.funnelId,
      stageId: params.stageId,
      value: params.value,
      assignedTo: params.assignedTo,
      notes: params.notes,
      title: params.title,
    });

    // Cria os deals em lote através do service
    const result = await dealsService.createBulkDeals(params);

    // Se nenhum deal foi criado, retorna erro
    if (!result.success || result.created === 0) {
      return res.status(400).json({
        message: "Nenhum negócio foi criado",
        errors: result.errors,
      });
    }

    // Retorna resultado da criação em lote
    res.status(201).json(result);
  } catch (error) {
    // Tratamento para erros conhecidos do service
    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    }

    // Erro genérico do servidor
    console.error("Erro na criação de negócios em lote:", error);
    res.status(500).json({ message: "Erro ao criar negócios em lote" });
  }
}
