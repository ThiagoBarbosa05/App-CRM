import { Request, Response } from "express";
import { referralsService } from "../../services/referrals.service";
import { z } from "zod";

const createReferralSchema = z.object({
  referredName: z.string().min(1, "Nome é obrigatório"),
  referredPhone: z.string().min(8, "Telefone é obrigatório"),
});

export const postReferralController = async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const parsed = createReferralSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const referral = await referralsService.addReferral({
      referrerId: clientId,
      referredName: parsed.data.referredName,
      referredPhone: parsed.data.referredPhone,
    });

    return res.status(201).json(referral);
  } catch (error: any) {
    if (error?.code === "ALREADY_EXISTS") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Erro ao criar indicação:", error);
    return res.status(500).json({ message: "Erro ao criar indicação" });
  }
};
