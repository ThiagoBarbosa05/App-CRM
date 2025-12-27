import { Request, Response } from "express";
import { storage } from "../../storage";

export const getClientFunnelsController = async (
  req: Request,
  res: Response
) => {
  try {
    const { clientId } = req.params;
    const funnels = await storage.getClientFunnels(clientId);
    res.json(funnels);
  } catch (error) {
    console.error("Erro ao buscar funis do cliente:", error);
    res.status(500).json({ message: "Erro ao buscar funis do cliente" });
  }
};
