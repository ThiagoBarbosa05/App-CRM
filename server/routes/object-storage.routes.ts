import express, { Router } from "express";
import multer, { MulterError } from "multer";
import { randomUUID } from "crypto";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { ObjectNotFoundError, ObjectStorageService } from "../objectStorage";

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

export function createObjectStorageApiRouter() {
  const app = express();
  app.use(express.json());

  app.post("/api/objects/upload", async (_req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      return res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Arquivo não fornecido" });
      }

      const uniqueFileName = `${randomUUID()}-${req.file.originalname}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: "crm-test",
          Key: uniqueFileName,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
          ACL: "public-read",
        }),
      );

      return res.json({
        url: uniqueFileName,
        fileType: req.file.mimetype,
      });
    } catch (error) {
      if (error instanceof MulterError) {
        return res
          .status(400)
          .json({ message: "O arquivo enviado é maior que o tamanho permitido" });
      }
      console.error("Erro ao fazer upload:", error);
      return res.status(500).json({ message: "Erro ao fazer upload" });
    }
  });

  app.delete("/api/delete-file", async (req, res) => {
    try {
      const { fileUrl } = req.body;

      if (!fileUrl) {
        return res.status(400).json({ message: "URL do arquivo é obrigatória" });
      }

      await s3.send(
        new DeleteObjectCommand({
          Bucket: "crm-test",
          Key: fileUrl,
        }),
      );

      return res.json({ message: "Arquivo removido com sucesso" });
    } catch (error) {
      console.error("Erro ao deletar arquivo:", error);
      return res.status(500).json({ message: "Erro ao deletar arquivo" });
    }
  });

  return app;
}

export const publicObjectsRouter = express();

publicObjectsRouter.get("/public-objects/:filePath(*)", async (req, res) => {
  const filePath = req.params.filePath;
  const objectStorageService = new ObjectStorageService();
  try {
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }
    await objectStorageService.downloadObject(file, res);
  } catch (error) {
    console.error("Error searching for public object:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export const objectEntitiesRouter = express();

objectEntitiesRouter.get("/objects/:objectPath(*)", async (req, res) => {
  const objectStorageService = new ObjectStorageService();
  try {
    const objectFile = await objectStorageService.getObjectEntityFile(req.path);
    await objectStorageService.downloadObject(objectFile, res);
  } catch (error) {
    console.error("Error checking object access:", error);
    if (error instanceof ObjectNotFoundError) {
      return res.sendStatus(404);
    }
    return res.sendStatus(500);
  }
});

export const objectStorageApiRouter = Router();

export default createObjectStorageApiRouter;
