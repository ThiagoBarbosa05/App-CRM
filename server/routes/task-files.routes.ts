import { Router } from "express";
import { eq } from "drizzle-orm";
import multer from "multer";
import { db } from "../db";
import { taskFiles, taskFileFolders, users } from "@shared/schema";
import { createFile } from "../integrations/umbler";

export const taskFilesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_\-\.]/g, "")
    .slice(0, 200) || "arquivo";
}

taskFilesRouter.get("/", async (req, res) => {
  try {
    const { folderId } = req.query;
    const rows = await db
      .select({
        file: taskFiles,
        uploadedBy: { id: users.id, name: users.name },
      })
      .from(taskFiles)
      .leftJoin(users, eq(taskFiles.uploadedById, users.id))
      .where(folderId ? eq(taskFiles.folderId, folderId as string) : undefined)
      .orderBy(taskFiles.createdAt);

    return res.json(rows.map((r) => ({ ...r.file, uploadedBy: r.uploadedBy })));
  } catch (error) {
    console.error("Erro ao buscar arquivos:", error);
    return res.status(500).json({ message: "Erro ao buscar arquivos" });
  }
});

taskFilesRouter.post(
  "/upload",
  upload.single("file"),
  async (req, res) => {
    try {
      const { userId } = req.user!;

      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }

      const { folderId } = req.body;
      if (!folderId) {
        return res.status(400).json({ message: "Pasta não informada" });
      }

      const [folder] = await db
        .select()
        .from(taskFileFolders)
        .where(eq(taskFileFolders.id, folderId));
      if (!folder) {
        return res.status(404).json({ message: "Pasta não encontrada" });
      }

      const organizationId = process.env.UMBLER_ORGANIZATION_ID;
      if (!organizationId) {
        return res.status(500).json({ message: "Configuração de upload ausente" });
      }

      const safeFilename = sanitizeFilename(req.file.originalname);
      const result = await createFile({
        file: req.file.buffer,
        filename: safeFilename,
        contentType: req.file.mimetype,
        organizationId,
      });

      if (!result) {
        return res.status(500).json({ message: "Falha no upload do arquivo" });
      }

      const [saved] = await db
        .insert(taskFiles)
        .values({
          name: req.file.originalname,
          url: result.url,
          size: result.originalSizeBytes ?? req.file.size,
          mimeType: req.file.mimetype,
          folderId,
          uploadedById: userId,
        })
        .returning();

      return res.status(201).json(saved);
    } catch (error) {
      console.error("Erro no upload:", error);
      return res.status(500).json({ message: "Erro ao fazer upload do arquivo" });
    }
  },
);

taskFilesRouter.delete("/:id", async (req, res) => {
  try {
    await db.delete(taskFiles).where(eq(taskFiles.id, req.params.id));
    return res.json({ message: "Arquivo excluído" });
  } catch (error) {
    console.error("Erro ao excluir arquivo:", error);
    return res.status(500).json({ message: "Erro ao excluir arquivo" });
  }
});
