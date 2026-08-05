import type { Request, Response } from "express";
import { z } from "zod";

import { authorizeDefaultBlingContact } from "../../services/bling-sales-order.service";

const schema = z.object({
  reason: z.string().trim().min(3).max(300),
});

export const authorizeDefaultBlingContactController = async (
  req: Request,
  res: Response,
) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const actorId = req.user?.userId;
    if (!actorId) return res.status(401).json({ message: "Usuário não autenticado" });

    const order = await authorizeDefaultBlingContact(
      req.params.id,
      actorId,
      parsed.data.reason,
    );
    return res.json({ order });
  } catch (error: unknown) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String(error.code)
        : null;
    const message = error instanceof Error ? error.message : "Falha ao autorizar fallback";
    if (code === "NOT_FOUND") return res.status(404).json({ message });
    if (
      code === "ORDER_NOT_CLOSED" ||
      code === "BLING_ORDER_EXISTS" ||
      code === "NO_CLIENT" ||
      code === "NO_UNIT" ||
      code === "NO_DEFAULT_CONTACT"
    ) {
      return res.status(409).json({ message });
    }
    console.error(`[Bling] Erro ao autorizar Consumidor Final para ${req.params.id}:`, error);
    return res.status(500).json({ message: "Erro ao autorizar Consumidor Final" });
  }
};
