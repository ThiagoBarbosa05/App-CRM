import { Request, Response } from "express";
import { referralsService } from "../../services/referrals.service";

export const deliverBenefitController = async (req: Request, res: Response) => {
  try {
    const { clientId, level } = req.params;
    const parsedLevel = parseInt(level, 10);

    if (parsedLevel !== 1 && parsedLevel !== 2) {
      return res.status(400).json({ message: "Nível de benefício inválido (1 ou 2)" });
    }

    await referralsService.markBenefitDelivered(clientId, parsedLevel as 1 | 2);
    return res.json({ message: "Benefício marcado como entregue" });
  } catch (error) {
    console.error("Erro ao marcar benefício como entregue:", error);
    return res.status(500).json({ message: "Erro ao marcar benefício" });
  }
};
