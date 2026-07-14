import { Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { systemSettings } from "../../../shared/schema";
import { syncMenuFromBling } from "../../services/restaurant-menu-bling-sync.service";

const CONNECTION_SETTING_KEY = "restaurant_pdv_bling_connection_id";

export const syncMenuBlingController = async (req: Request, res: Response) => {
  try {
    const createdBy = req.user?.userId;
    if (!createdBy) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    let connectionId: string | undefined = req.body?.connectionId;
    if (!connectionId) {
      const [setting] = await db
        .select()
        .from(systemSettings)
        .where(eq(systemSettings.key, CONNECTION_SETTING_KEY));
      connectionId = setting?.value;
    }

    if (!connectionId) {
      return res.status(400).json({
        message: "Nenhuma conexão Bling configurada para o PDV Restaurante",
      });
    }

    const result = await syncMenuFromBling(connectionId, createdBy);
    return res.json(result);
  } catch (error: any) {
    console.error("Erro ao sincronizar cardápio com o Bling:", error);
    return res.status(500).json({
      message: error?.message ?? "Erro ao sincronizar cardápio com o Bling",
    });
  }
};
