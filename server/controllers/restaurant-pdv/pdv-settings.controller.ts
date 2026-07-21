import { Request, Response } from "express";
import { z } from "zod";
import { db } from "../../db";
import { restaurantPdvSettings } from "@shared/schema";

const DEFAULTS = {
  id: 1,
  companyName: "PDV Restaurante",
  companyCnpj: null,
  companyAddress: null,
  companyPhone: null,
  companyFooterMessage: null,
  defaultServiceFeePercent: "10.00",
  waiterCommissionPercent: "0.00",
  updatedAt: new Date(),
};

const updateSchema = z.object({
  companyName: z.string().min(1, "Nome da empresa é obrigatório").optional(),
  companyCnpj: z.string().optional().nullable(),
  companyAddress: z.string().optional().nullable(),
  companyPhone: z.string().optional().nullable(),
  companyFooterMessage: z.string().optional().nullable(),
  defaultServiceFeePercent: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Taxa de serviço inválida")
    .optional(),
  waiterCommissionPercent: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Comissão inválida")
    .optional(),
});

export const getPdvSettingsController = async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(restaurantPdvSettings).limit(1);
    return res.json(rows[0] ?? DEFAULTS);
  } catch (err) {
    console.error("Erro ao buscar configurações do PDV:", err);
    return res.status(500).json({ message: "Erro ao buscar configurações" });
  }
};

export const updatePdvSettingsController = async (req: Request, res: Response) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const data = parsed.data;

    const [updated] = await db
      .insert(restaurantPdvSettings)
      .values({
        id: 1,
        companyName: data.companyName ?? DEFAULTS.companyName,
        companyCnpj: "companyCnpj" in data ? data.companyCnpj ?? null : null,
        companyAddress: "companyAddress" in data ? data.companyAddress ?? null : null,
        companyPhone: "companyPhone" in data ? data.companyPhone ?? null : null,
        companyFooterMessage:
          "companyFooterMessage" in data ? data.companyFooterMessage ?? null : null,
        defaultServiceFeePercent:
          data.defaultServiceFeePercent ?? DEFAULTS.defaultServiceFeePercent,
        waiterCommissionPercent:
          data.waiterCommissionPercent ?? DEFAULTS.waiterCommissionPercent,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: restaurantPdvSettings.id,
        set: {
          ...(data.companyName !== undefined && { companyName: data.companyName }),
          ...("companyCnpj" in data && { companyCnpj: data.companyCnpj ?? null }),
          ...("companyAddress" in data && { companyAddress: data.companyAddress ?? null }),
          ...("companyPhone" in data && { companyPhone: data.companyPhone ?? null }),
          ...("companyFooterMessage" in data && {
            companyFooterMessage: data.companyFooterMessage ?? null,
          }),
          ...(data.defaultServiceFeePercent !== undefined && {
            defaultServiceFeePercent: data.defaultServiceFeePercent,
          }),
          ...(data.waiterCommissionPercent !== undefined && {
            waiterCommissionPercent: data.waiterCommissionPercent,
          }),
          updatedAt: new Date(),
        },
      })
      .returning();

    return res.json(updated);
  } catch (err) {
    console.error("Erro ao salvar configurações do PDV:", err);
    return res.status(500).json({ message: "Erro ao salvar configurações" });
  }
};
