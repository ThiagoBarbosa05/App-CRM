import { Router } from "express";
import multer from "multer";
import {
  listMediaLibrary,
  createMediaLibraryItem,
  deleteMediaLibraryItem,
  type MediaType,
} from "../services/media-library.service";

export const mediaLibraryRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 16 * 1024 * 1024 },
});

const ALLOWED_TYPES: MediaType[] = ["image", "video", "document"];

mediaLibraryRouter.get("/", async (req, res) => {
  try {
    const typeParam = typeof req.query.type === "string" ? req.query.type : undefined;
    const type = ALLOWED_TYPES.includes(typeParam as MediaType)
      ? (typeParam as MediaType)
      : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;

    const items = await listMediaLibrary({ type, search });
    res.json(items);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao buscar mídias";
    res.status(500).json({ message });
  }
});

mediaLibraryRouter.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Nenhum arquivo enviado" });

    const name =
      typeof req.body?.name === "string" && req.body.name.trim()
        ? req.body.name.trim()
        : req.file.originalname;

    const item = await createMediaLibraryItem({
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      name,
      userId: (req as any).user?.userId,
    });

    res.status(201).json(item);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao enviar mídia";
    res.status(500).json({ message });
  }
});

mediaLibraryRouter.delete("/:id", async (req, res) => {
  try {
    const ok = await deleteMediaLibraryItem(req.params.id);
    if (!ok) return res.status(404).json({ message: "Mídia não encontrada" });
    res.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao excluir mídia";
    res.status(500).json({ message });
  }
});

export default mediaLibraryRouter;
