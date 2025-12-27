import type { Request, Response } from "express";
import { storage } from "../../storage";

export async function putInteractionController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const interaction = await storage.updateClientInteraction(id, req.body);
    res.json(interaction);
  } catch (error) {
    console.error("Erro ao atualizar interação:", error);
    res.status(500).json({ message: "Erro ao atualizar interação" });
  }
}
