import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const createTrainingSchema = z
  .object({
    title: z.string().min(1, "O título é obrigatório"),
    description: z.string().min(1, "A descrição é obrigatória"),
    category: z.string().min(1, "A categoria é obrigatória"),
    level: z.string().optional(),
    trainingType: z.enum(["video", "images", "documents"]),
    videoUrl: z.string().optional(),
    files: z.any().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.trainingType === "video" && !data.videoUrl) {
      ctx.addIssue({
        path: ["videoUrl"],
        message: "A URL do vídeo é obrigatória",
        code: z.ZodIssueCode.custom,
      });
    }

    const files = Array.from(data.files || []);
    const allowedMimeTypes =
      data.trainingType === "images"
        ? ["image/jpeg", "image/png", "image/webp"]
        : [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          ];

    if (
      (data.trainingType === "images" || data.trainingType === "documents") &&
      files.length === 0
    ) {
      ctx.addIssue({
        path: ["files"],
        message: "Você deve enviar pelo menos um arquivo",
        code: z.ZodIssueCode.custom,
      });
    }

    files.forEach((file) => {
      if (!allowedMimeTypes.includes(file.type)) {
        ctx.addIssue({
          path: ["files"],
          message: `Arquivo inválido: ${file.name}`,
          code: z.ZodIssueCode.custom,
        });
      }

      if (file.size > MAX_FILE_SIZE) {
        ctx.addIssue({
          path: ["files"],
          message: `Arquivo muito grande: ${file.name} (máx. 5MB)`,
          code: z.ZodIssueCode.custom,
        });
      }
    });
  });

export type CreateTrainingData = z.infer<typeof createTrainingSchema>;

export function useCreateTrainingForm() {
  return useForm<CreateTrainingData>({
    resolver: zodResolver(createTrainingSchema),
  });
}
