import { Request, Response } from "express";
import { getTemplates, getApprovedTemplates } from "../integrations/umbler";

export async function getTemplatesController(req: Request, res: Response) {
  try {
    const { approved } = req.query;

    // Se approved=true, retorna apenas templates aprovados
    if (approved === "true") {
      const approvedTemplates = await getApprovedTemplates();

      if (!approvedTemplates) {
        return res.status(500).json({
          message: "Error fetching approved templates from Umbler API.",
        });
      }

      return res.status(200).json(approvedTemplates);
    }

    // Caso contrário, retorna todos os templates
    const templates = await getTemplates();

    if (!templates) {
      return res.status(500).json({
        message: "Error fetching templates from Umbler API.",
      });
    }

    res.status(200).json(templates);
  } catch (error) {
    console.error("Failed to fetch templates:", error);
    res.status(500).json({
      message: "Internal server error while fetching templates.",
    });
  }
}
