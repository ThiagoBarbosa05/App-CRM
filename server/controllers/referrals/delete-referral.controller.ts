import { Request, Response } from "express";
import { referralsService } from "../../services/referrals.service";

export const deleteReferralController = async (req: Request, res: Response) => {
  try {
    const { referralId } = req.params;
    await referralsService.deleteReferral(referralId);
    return res.json({ message: "Indicação removida com sucesso" });
  } catch (error) {
    console.error("Erro ao remover indicação:", error);
    return res.status(500).json({ message: "Erro ao remover indicação" });
  }
};
