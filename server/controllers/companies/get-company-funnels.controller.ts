import { Request, Response } from "express";
import { storage } from "../../storage";

export const getCompanyFunnelsController = async (
  req: Request,
  res: Response
) => {
  try {
    const { companyId } = req.params;
    const funnels = await storage.getCompanyFunnels(companyId);
    res.json(funnels);
  } catch (error) {
    console.error("Erro ao buscar funis da empresa:", error);
    res.status(500).json({ message: "Erro ao buscar funis da empresa" });
  }
};
