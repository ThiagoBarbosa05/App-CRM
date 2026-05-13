import { Request, Response } from "express";
import { referralsService } from "../../services/referrals.service";

export const getReferrerController = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const referrer = await referralsService.getReferrerByClientId(clientId);
    return res.json(referrer ?? null);
  } catch (error) {
    console.error("Erro ao buscar quem indicou:", error);
    return res.status(500).json({ message: "Erro ao buscar indicador" });
  }
};
