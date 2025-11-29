import { Request, Response } from "express";
import { getBots } from "../../integrations/umbler";

/**
 * Controller para buscar bots flowchart com manual-starts
 * GET /api/umbler/bots
 * Query params:
 * - query: string (opcional) - filtro de busca pelo título do bot
 * - skip: number (opcional) - número de itens a pular (paginação)
 * - take: number (opcional) - número de itens a retornar
 * - hidden: boolean (opcional) - se deve incluir bots ocultos
 */
export async function getBotsController(req: Request, res: Response) {
  try {
    const { query, skip, take, hidden } = req.query;

    const skipNumber = skip ? parseInt(skip as string, 10) : 0;
    const takeNumber = take ? parseInt(take as string, 10) : 34;
    const hiddenBoolean = hidden === "true";

    const bots = await getBots(
      query as string | undefined,
      skipNumber,
      takeNumber,
      hiddenBoolean
    );

    if (!bots) {
      return res.status(500).json({ error: "Failed to fetch bots" });
    }

    return res.status(200).json(bots);
  } catch (error) {
    console.error("Error in getBotsController:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
