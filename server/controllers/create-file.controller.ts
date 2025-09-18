import { Request, Response } from "express";
import { z } from "zod";
import { createFile } from "../integrations/umbler";
import multer from "multer";

// Schema de validação para criação de arquivo
const createFileSchema = z.object({
  filename: z
    .string()
    .min(1, "Nome do arquivo é obrigatório")
    .max(255, "Nome do arquivo deve ter no máximo 255 caracteres")
    .regex(
      /^[a-zA-Z0-9_\-\.]+$/,
      "Nome do arquivo deve conter apenas letras, números, underscores, hífens e pontos"
    ),
  contentType: z
    .string()
    .regex(
      /^(image|video|audio|application)\/.+$/,
      "Tipo de conteúdo deve ser válido (image/*, video/*, audio/*, application/*)"
    ),
  thumbnail: z.string().optional(),
});

// Configuração do multer para upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB máximo
  },
  fileFilter: (req, file, cb) => {
    // Tipos de arquivo permitidos
    const allowedMimeTypes = [
      // Imagens
      "image/jpeg",
      "image/jpg", 
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
      // Vídeos
      "video/mp4",
      "video/avi",
      "video/mov",
      "video/wmv",
      // Áudios
      "audio/mp3",
      "audio/wav",
      "audio/ogg",
      "audio/m4a",
      // Documentos
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}`));
    }
  },
});

export const uploadMiddleware = upload.single("file");

export async function createFileController(req: Request, res: Response) {
  try {
    // Verificar se o arquivo foi enviado
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Nenhum arquivo foi enviado",
        error: "FILE_REQUIRED",
      });
    }

    // Validar os dados do corpo da requisição
    const validationResult = createFileSchema.safeParse({
      filename: req.body.filename || req.file.originalname,
      contentType: req.file.mimetype,
      thumbnail: req.body.thumbnail,
    });

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: "Dados de entrada inválidos",
        errors: validationResult.error.flatten().fieldErrors,
      });
    }

    const { filename, contentType, thumbnail } = validationResult.data;

    // Obter organizationId das variáveis de ambiente
    const organizationId = process.env.UMBLER_ORGANIZATION_ID;
    if (!organizationId) {
      console.error("UMBLER_ORGANIZATION_ID não configurado");
      return res.status(500).json({
        success: false,
        message: "Configuração do servidor incompleta",
        error: "MISSING_ORGANIZATION_ID",
      });
    }

    // Preparar dados para envio
    const fileData = {
      file: req.file.buffer,
      filename,
      contentType,
      thumbnail,
      organizationId,
    };

    // Tentar criar o arquivo no Umbler
    const result = await createFile(fileData);

    if (!result) {
      return res.status(500).json({
        success: false,
        message: "Falha ao criar arquivo no Umbler",
        error: "UMBLER_CREATE_FAILED",
      });
    }

    // Resposta de sucesso
    return res.status(201).json({
      success: true,
      message: "Arquivo criado com sucesso",
      data: {
        id: result.id,
        url: result.url,
        originalName: result.originalName,
        contentType: result.contentType,
        originalSizeBytes: result.originalSizeBytes,
        fileType: result.fileType,
        createdAt: result.createdAtUTC,
        thumbnail: result.thumbnail,
      },
    });
  } catch (error) {
    console.error("Erro no createFileController:", error);

    // Tratamento específico para erros de multer
    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: "Arquivo muito grande. Tamanho máximo: 50MB",
          error: "FILE_TOO_LARGE",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Erro no upload do arquivo",
        error: error.code,
      });
    }

    // Tratamento para erro de tipo de arquivo
    if (error instanceof Error && error.message.includes("Tipo de arquivo não permitido")) {
      return res.status(400).json({
        success: false,
        message: error.message,
        error: "INVALID_FILE_TYPE",
      });
    }

    // Erro genérico
    return res.status(500).json({
      success: false,
      message: "Erro interno do servidor",
      error: "INTERNAL_SERVER_ERROR",
    });
  }
}
