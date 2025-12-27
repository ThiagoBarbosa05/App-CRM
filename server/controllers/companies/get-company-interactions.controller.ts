import { Request, Response } from "express";
import { storage } from "../../storage";

export const getCompanyInteractionsController = async (
  req: Request,
  res: Response
) => {
  try {
    const { companyId } = req.params;
    const interactions = await storage.getCompanyInteractions(companyId);
    res.json(interactions);
  } catch (error) {
    console.error("Erro ao buscar interações da empresa:", error);
    res.status(500).json({ message: "Erro ao buscar interações da empresa" });
  }
};
