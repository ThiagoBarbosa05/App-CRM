import { Request, Response } from "express";
import { checkDuplicates } from "../../services/duplicate-detection.service";

export async function checkDuplicateController(req: Request, res: Response) {
  try {
    const { name, phone, cpf, email, excludeId } = req.body as {
      name?: string;
      phone?: string;
      cpf?: string;
      email?: string;
      excludeId?: string;
    };

    const matches = await checkDuplicates({ name, phone, cpf, email, excludeId });
    res.json(matches);
  } catch (error) {
    console.error("[checkDuplicate]", error);
    res.status(500).json({ message: "Erro ao verificar duplicatas." });
  }
}
