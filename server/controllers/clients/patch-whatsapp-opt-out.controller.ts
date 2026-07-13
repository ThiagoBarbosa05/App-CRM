import { Request, Response } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { setWhatsappOptOutByClientId } from "../../services/whatsapp-opt-out.service";

const bodySchema = z.object({
  optedOut: z.boolean(),
});

/**
 * @route PATCH /api/clients/:id/whatsapp-opt-out
 * @description Marca (ou reverte) manualmente o opt-out de marketing por WhatsApp de um cliente
 * @access Private
 * @urlParams {string} id - ID do cliente
 * @bodyParams {boolean} optedOut - true para opt-out, false para reverter
 */
export const patchWhatsappOptOutController = async (req: Request, res: Response) => {
  try {
    const { optedOut } = bodySchema.parse(req.body);
    await setWhatsappOptOutByClientId(req.params.id, optedOut);
    res.status(200).json({ ok: true, optedOut });
  } catch (error) {
    console.error("Erro no patchWhatsappOptOutController:", error);

    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }

    res.status(500).json({ message: "Erro ao atualizar opt-out de WhatsApp" });
  }
};
