import { Request, Response } from "express";
import { findAllDuplicates } from "../../services/duplicate-detection.service";

export async function getDuplicatesController(_req: Request, res: Response) {
  try {
    const groups = await findAllDuplicates();
    res.json(groups);
  } catch (error) {
    console.error("[getDuplicates]", error);
    res.status(500).json({ message: "Erro ao buscar duplicatas." });
  }
}
