import { Request, Response } from "express";
import { blingConnectionsService } from "../../services/bling-connections.service";
import { getBlingVendedores } from "../../integrations/bling";

export async function getBlingVendorsController(req: Request, res: Response) {
  try {
    const accessToken = await blingConnectionsService.getFirstConnectedAccessToken();
    const vendors = await getBlingVendedores(accessToken);

    return res.json({ success: true, data: vendors });
  } catch (error) {
    console.error("[getBlingVendorsController] Erro ao buscar vendedores do Bling:", error);

    const message = error instanceof Error ? error.message : "Erro ao buscar vendedores do Bling";

    if (message.includes("Nenhuma conta Bling conectada")) {
      return res.status(422).json({ success: false, error: message });
    }

    return res.status(500).json({ success: false, error: message });
  }
}
