import { Router } from "express";
import {
  startTagImport,
  getImportStatus,
} from "../services/umbler-tag-import.service";

export const umblerTagImportRouter = Router();

umblerTagImportRouter.post("/umbler-tag-import/start", async (_req, res) => {
  try {
    await startTagImport();
    return res.json({ message: "Importação iniciada" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("em andamento")) {
      return res.status(409).json({ message });
    }
    console.error("[umbler-tag-import] Erro ao iniciar importação:", err);
    return res.status(500).json({ message: "Erro ao iniciar importação" });
  }
});

umblerTagImportRouter.get("/umbler-tag-import/status", (_req, res) => {
  return res.json(getImportStatus());
});
