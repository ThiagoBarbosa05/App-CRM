import type { Request, Response } from "express";
import { storage } from "../../storage";

export async function deleteInteractionController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await storage.deleteClientInteraction(id);
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir interação:", error);
    res.status(500).json({ message: "Erro ao excluir interação" });
  }
}
