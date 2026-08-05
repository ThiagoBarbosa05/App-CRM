import { Request, Response } from "express";
import { z } from "zod";
import { restaurantPdvService } from "../../services/restaurant-pdv.service";
import {
  BlingSyncError,
  ensureBlingContactForClient,
} from "../../services/bling-clients-export.service";

const schema = z.object({
  clientId: z.string().nullable(),
  clientName: z.string().nullable(),
});

export const updateOrderClientController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const actorId = req.user?.userId;
    if (!actorId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }

    const updated = await restaurantPdvService.updateOrderClient(
      id,
      parsed.data,
      actorId,
      req.pdvUnitId,
    );
    if (!updated.clientId || !updated.blingConnectionId) {
      return res.json({
        ...updated,
        clientBlingSync: { status: "not_applicable" as const },
      });
    }

    // O cliente local já foi vinculado. A tentativa no Bling acontece depois
    // do commit e nunca desfaz a associação da comanda se a API estiver fora.
    try {
      const contact = await ensureBlingContactForClient(
        updated.clientId,
        updated.blingConnectionId,
      );
      return res.json({
        ...updated,
        clientBlingSync: {
          status: "synced" as const,
          blingContactId: contact.blingContactId,
          resolution: contact.resolution,
        },
      });
    } catch (error) {
      console.error(
        `[PDV] Cliente ${updated.clientId} vinculado, mas não sincronizado com o Bling:`,
        error instanceof Error ? error.message : error,
      );
      const definitive = error instanceof BlingSyncError && error.httpStatus === 422;
      return res.json({
        ...updated,
        clientBlingSync: {
          status: definitive ? ("error" as const) : ("pending" as const),
          message:
            error instanceof BlingSyncError
              ? error.userMessage
              : "A sincronização será tentada novamente no fechamento.",
        },
      });
    }
  } catch (error: any) {
    if (error?.code === "NOT_FOUND" || error?.code === "FORBIDDEN") {
      return res.status(404).json({ message: error.message });
    }
    if (error?.code === "ORDER_CLOSED") {
      return res.status(409).json({ message: error.message });
    }
    console.error("Erro ao atualizar cliente da comanda:", error);
    return res.status(500).json({ message: "Erro ao atualizar cliente" });
  }
};
