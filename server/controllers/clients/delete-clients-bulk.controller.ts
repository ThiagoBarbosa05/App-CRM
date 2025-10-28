import { Request, Response } from "express";
import { z } from "zod";
import { clientsService } from "../../services/clients.service";

// Schema de validação para exclusão em lote
const deleteClientsBulkSchema = z.object({
  clientIds: z
    .array(z.string().min(1, "ID do cliente não pode estar vazio"))
    .min(1, "Pelo menos um ID de cliente deve ser fornecido")
    .max(100, "Máximo de 100 clientes podem ser excluídos por vez"),
});

/**
 * Controller para exclusão em lote de clientes
 * DELETE /api/clients
 */
export const deleteClientsBulkController = async (
  req: Request,
  res: Response
) => {
  try {
    // Validação do schema
    const validatedData = deleteClientsBulkSchema.parse(req.body);

    // Processa parâmetros
    const params = clientsService.processDeleteClientsBulkParams({
      ...req,
      body: validatedData,
    });

    // Executa a exclusão em lote
    const result = await clientsService.deleteClientsBulk(params);

    res.status(200).json({
      success: true,
      message: `${result.deletedCount} cliente(s) excluído(s) com sucesso`,
      data: result,
    });
  } catch (error) {
    console.error("Erro na exclusão em lote de clientes:", error);

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
        case "Acesso negado: apenas administradores podem realizar exclusões em lote":
          return res.status(403).json({
            success: false,
            message: error.message,
          });

        case "Lista de IDs de clientes é obrigatória":
        case "IDs de clientes inválidos encontrados":
          return res.status(400).json({
            success: false,
            message: error.message,
          });

        default:
          return res.status(500).json({
            success: false,
            message: error.message,
          });
      }
    }

    res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
    });
  }
};
