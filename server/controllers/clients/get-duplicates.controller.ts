import { Request, Response } from "express";
import { findAllDuplicates, DuplicateField } from "../../services/duplicate-detection.service";

const VALID_FIELDS: DuplicateField[] = ["cpf", "email", "phone", "name"];

export async function getDuplicatesController(req: Request, res: Response) {
  try {
    const rawFields = req.query.fields;
    let fields: DuplicateField[];

    if (rawFields && typeof rawFields === "string") {
      const parsed = rawFields.split(",").map((f) => f.trim()) as DuplicateField[];
      fields = parsed.filter((f) => VALID_FIELDS.includes(f));
      if (fields.length === 0) fields = VALID_FIELDS;
    } else {
      fields = VALID_FIELDS;
    }

    const groups = await findAllDuplicates(fields);
    res.json(groups);
  } catch (error) {
    console.error("[getDuplicates]", error);
    res.status(500).json({ message: "Erro ao buscar duplicatas." });
  }
}
