import { Request, Response } from "express";
import { referralsService } from "../../services/referrals.service";

export const getReferralsController = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const result = await referralsService.getByReferrer(clientId);
    return res.json(result);
  } catch (error) {
    console.error("Erro ao buscar indicações:", error);
    return res.status(500).json({ message: "Erro ao buscar indicações" });
  }
};
