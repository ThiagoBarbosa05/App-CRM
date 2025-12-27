import { Request, Response } from "express";
import { storage } from "../../storage";

export const getClientInteractionsController = async (
  req: Request,
  res: Response
) => {
  try {
    const { clientId } = req.params;
    const interactions = await storage.getClientInteractions(clientId);
    res.json(interactions);
  } catch (error) {
    console.error("Erro ao buscar interações:", error);
    res.status(500).json({ message: "Erro ao buscar interações" });
  }
};
