import { Request, Response } from "express";
import { tagsService } from "../../services/tags.service";

export async function getCountriesController(req: Request, res: Response) {
  try {
    const countries = await tagsService.getCountries();
    return res.json(countries);
  } catch (error) {
    console.error("[getCountriesController] Erro:", error);
    return res.status(500).json({ message: "Erro ao buscar países" });
  }
}
