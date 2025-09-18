import { Request, Response } from "express";
import { z } from "zod";
import { deleteFile } from "../integrations/umbler";

// Schema de validação para deleção de arquivo
const deleteFileSchema = z.object({
  fileId: z
    .string()
    .min(1, "ID do arquivo é obrigatório")
    .max(50, "ID do arquivo deve ter no máximo 50 caracteres")
    .regex(
      /^[a-zA-Z0-9_\-]+$/,
      "ID do arquivo deve conter apenas letras, números, underscores e hífens"
    ),
});

export async function deleteFileController(req: Request, res: Response) {
  try {
    // Validar o parâmetro fileId
    const validationResult = deleteFileSchema.safeParse({
      fileId: req.params.fileId,
    });

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "ID do arquivo inválido",
        errors: validationResult.error.flatten().fieldErrors,
      });
    }

    const { fileId } = validationResult.data;

    // Tentar deletar o arquivo no Umbler
    const success = await deleteFile(fileId);

    if (!success) {
      return res.status(500).json({
        success: false,
        message: "Falha ao deletar arquivo no Umbler",
        error: "UMBLER_DELETE_FAILED",
      });
    }

    // Resposta de sucesso
    return res.status(200).json({
      success: true,
      message: "Arquivo deletado com sucesso",
      data: {
        fileId,
        deletedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Erro no deleteFileController:", error);

    // Erro genérico
    return res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      error: "INTERNAL_SERVER_ERROR",
    });
  }
}