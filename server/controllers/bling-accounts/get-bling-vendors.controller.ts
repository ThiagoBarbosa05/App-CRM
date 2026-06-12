import { Request, Response } from "express";
import { blingConnectionsService } from "../../services/bling-connections.service";
import { getBlingVendedores } from "../../integrations/bling";

export async function getBlingVendorsController(req: Request, res: Response) {
  try {
    const { connectionId } = req.query as { connectionId?: string };

    let accessToken: string;

    if (connectionId) {
      accessToken = await blingConnectionsService.getAccessTokenByConnectionId(connectionId);
    } else {
      accessToken = await blingConnectionsService.getFirstConnectedAccessToken();
    }

    const vendors = await getBlingVendedores(accessToken);

    return res.json({ success: true, data: vendors });
  } catch (error) {
    console.error("[getBlingVendorsController] Erro ao buscar vendedores do Bling:", error);

    const message = error instanceof Error ? error.message : "Erro ao buscar vendedores do Bling";

    if (message.includes("Nenhuma conta Bling conectada") || message.includes("Conexão não encontrada")) {
      return res.status(422).json({ success: false, error: message });
    }

    return res.status(500).json({ success: false, error: message });
  }
}
