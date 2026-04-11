import { Router } from "express";
import multer, { MulterError } from "multer";
import { randomUUID } from "crypto";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";

import {
  createDocumentTrainingSchema,
  createScriptSchema,
  createTrainingSchema,
  trainingAttachments,
  trainings,
  updateDocumentTrainingSchema,
} from "@shared/schema";
import { db } from "../db";
import { ObjectStorageService } from "../objectStorage";
import { storage } from "../storage";

const upload = multer({
  limits: { fileSize: 15 * 1024 * 1024 },
});

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_URL,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export const trainingsRouter = Router();

trainingsRouter.put("/training-images", async (req, res) => {
  if (!req.body.imageURL) {
    return res.status(400).json({ error: "imageURL is required" });
  }

  try {
    const objectStorageService = new ObjectStorageService();
    const objectPath = objectStorageService.normalizeObjectEntityPath(
      req.body.imageURL,
    );

    return res.status(200).json({ objectPath });
  } catch (error) {
    console.error("Error setting training image:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

trainingsRouter.post("/trainings/video", async (req, res) => {
  try {
    const validatedData = createTrainingSchema.parse(req.body);
    const training = await storage.createTraining(validatedData);

    await storage.createTrainingAttachments({
      trainingId: training.id,
      fileType: "video",
      name: training.title,
      url: validatedData.videoUrl,
    });
    return res.status(201).json(training);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Erro ao criar treinamento:", error);
    return res.status(500).json({ message: "Erro ao criar treinamento" });
  }
});

trainingsRouter.put("/trainings/video/:trainingId", async (req, res) => {
  try {
    const trainingId = req.params.trainingId;
    const validatedData = createTrainingSchema.parse(req.body);

    const training = await storage.getTraining(trainingId);
    const trainingUpdated = await storage.updateTraining(validatedData, trainingId);

    await storage.updateTrainingAttachments(
      {
        trainingId: trainingUpdated.id,
        fileType: "video",
        name: trainingUpdated.title,
        url: validatedData.videoUrl,
      },
      training.training_attachments?.url!,
    );

    return res.status(201).json(training);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Erro ao criar treinamento:", error);
    return res.status(500).json({ message: "Erro ao criar treinamento" });
  }
});

trainingsRouter.get("/trainings", async (req, res) => {
  try {
    const type = req.query.type as string;
    const trainingsList = await storage.getTrainings(type);

    return res.json(trainingsList);
  } catch (error) {
    console.error("Erro ao Treinamentos: ", error);
    return res.status(500).json({ message: "Erro ao buscar treinamentos" });
  }
});

trainingsRouter.delete("/trainings/:id", async (req, res) => {
  try {
    const trainingId = req.params.id;

    await storage.deleteTrainingAttachments(trainingId);
    await storage.deleteTraining(trainingId);
    return res.json({ message: "Treinamento deletado com sucesso" });
  } catch (error) {
    console.error("Erro ao deletar Treinamento: ", error);
    return res.status(500).json({ message: "Erro ao deletar treinamento" });
  }
});

trainingsRouter.post("/trainings/documents", async (req, res) => {
  try {
    const data = createDocumentTrainingSchema.parse(req.body);
    const [training] = await db
      .insert(trainings)
      .values({
        category: data.category,
        title: data.title,
        description: data.description,
        type: "document",
      })
      .returning();

    await db.insert(trainingAttachments).values({
      name: data.documentUrl,
      url: data.documentUrl,
      fileType: data.documentType,
      trainingId: training.id,
    });

    return res.status(201).json(training);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Erro ao criar treinamento:", error);
    return res.status(500).json({ message: "Erro ao criar treinamento" });
  }
});

trainingsRouter.put("/trainings/documents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = updateDocumentTrainingSchema.parse(req.body);

    const [training] = await db
      .update(trainings)
      .set({ ...data })
      .where(eq(trainings.id, id))
      .returning();

    return res.json(training);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Erro ao atualizar treinamento (documento):", error);
    return res
      .status(500)
      .json({ message: "Erro ao atualizar treinamento (documento)" });
  }
});

trainingsRouter.put(
  "/trainings/documents/:id/file",
  upload.single("file"),
  async (req, res) => {
    try {
      const id = req.params.id;
      const training = await storage.getTraining(id);

      if (!req.file) {
        return res.status(400).json({ message: "Arquivo não fornecido" });
      }

      await s3.send(
        new DeleteObjectCommand({
          Bucket: "crm-test",
          Key: training.training_attachments?.url!,
        }),
      );

      const url = randomUUID() + "-" + req.file.originalname;

      await s3.send(
        new PutObjectCommand({
          Bucket: "crm-test",
          Body: req.file.buffer,
          Key: url,
          ContentType: req.file.mimetype,
        }),
      );

      await db
        .update(trainingAttachments)
        .set({ url })
        .where(eq(trainingAttachments.trainingId, id))
        .returning();

      return res.json({ url, fileType: req.file.mimetype });
    } catch (error) {
      if (error instanceof MulterError) {
        return res.status(400).json({
          message: "O arquivo enviado é maior que o tamanho permitido",
        });
      }
      console.error("Erro ao atualizar arquivo:", error);
      return res.status(500).json({ message: "Erro ao atualizar arquivo" });
    }
  },
);

trainingsRouter.delete("/trainings/documents/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const training = await storage.getTraining(id);

    await s3.send(
      new DeleteObjectCommand({
        Bucket: "crm-test",
        Key: training.training_attachments?.url!,
      }),
    );

    await storage.deleteTrainingAttachments(id);
    await storage.deleteTraining(id);

    return res.json({ message: "Treinamento deletado com sucesso" });
  } catch (error) {
    console.error("Erro ao excluir treinamento:", error);
    return res.status(500).json({ message: "Erro ao excluir treinamento" });
  }
});

trainingsRouter.post("/trainings/scripts", async (req, res) => {
  try {
    const data = createScriptSchema.parse(req.body);
    const [training] = await db
      .insert(trainings)
      .values({
        title: data.title,
        description: data.description,
        content: data.content,
        category: data.category,
        type: "script",
      })
      .returning();

    return res.status(201).json(training);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Erro ao criar treinamento:", error);
    return res.status(500).json({ message: "Erro ao criar treinamento" });
  }
});

trainingsRouter.put("/trainings/scripts/:id", async (req, res) => {
  try {
    const data = createScriptSchema.parse(req.body);
    const [training] = await db
      .update(trainings)
      .set({ ...data })
      .where(eq(trainings.id, req.params.id))
      .returning();

    return res.status(201).json(training);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Erro ao atualizar treinamento:", error);
    return res.status(500).json({ message: "Erro ao atualizar treinamento" });
  }
});

trainingsRouter.put("/trainings/:id/order", async (req, res) => {
  try {
    const { id } = req.params;
    const { direction, type } = req.body;

    if (!direction || !type) {
      return res.status(400).json({
        message: "direction ('up' ou 'down') e type são obrigatórios",
      });
    }

    if (direction !== "up" && direction !== "down") {
      return res.status(400).json({
        message: "direction deve ser 'up' ou 'down'",
      });
    }

    const training = await storage.reorderTrainings(id, direction, type);
    if (!training) {
      return res.status(404).json({ message: "Treinamento não encontrado" });
    }

    return res.json(training);
  } catch (error) {
    console.error("Erro ao atualizar ordem do treinamento:", error);
    return res
      .status(500)
      .json({ message: "Erro ao atualizar ordem do treinamento" });
  }
});

export default trainingsRouter;
