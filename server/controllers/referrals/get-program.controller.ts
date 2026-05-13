import { Request, Response } from "express";
import { referralsService } from "../../services/referrals.service";

export const getProgramController = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId ?? "";
    const userRole = req.user?.role ?? "vendedor";
    const data = await referralsService.getProgramData(userId, userRole);
    return res.json(data);
  } catch (error) {
    console.error("Erro ao buscar dados do programa de indicação:", error);
    return res.status(500).json({ message: "Erro ao buscar dados do programa" });
  }
};
