import type { Request, Response } from "express";
import { pdvUnitsService } from "../../services/pdv-units.service";

/**
 * Formas de pagamento ativas da conta Bling vinculada à unidade do operador.
 * 409 quando a unidade não tem conexão/token Bling — o front usa esse status
 * para cair no fallback dos métodos locais.
 */
export const listBlingPaymentMethodsController = async (
  req: Request,
  res: Response,
) => {
  try {
    const unitId = req.pdvUnitId;
    if (!unitId) {
      return res.status(400).json({ message: "Selecione uma unidade PDV" });
    }
    const formas = await pdvUnitsService.listBlingPaymentMethods(unitId);
    return res.json(formas);
  } catch (err: any) {
    if (err?.code === "NO_BLING_CONNECTION" || err?.code === "NO_BLING_TOKEN") {
      return res.status(409).json({ message: err.message });
    }
    console.error("Erro ao listar formas de pagamento do Bling:", err);
    return res.status(502).json({
      message:
        "Não foi possível listar as formas de pagamento no Bling. Verifique a conexão.",
    });
  }
};
