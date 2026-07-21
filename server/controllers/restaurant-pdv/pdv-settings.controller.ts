import { Request, Response } from "express";
import { z } from "zod";
import { db } from "../../db";
import { pdvUnits } from "@shared/schema";
import { eq } from "drizzle-orm";

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

export const getPdvSettingsController = async (req: Request, res: Response) => {
  try {
    const unitId = req.pdvUnitId;
    if (!unitId) {
      return res.status(400).json({ message: "Nenhuma unidade PDV selecionada" });
    }

    const [unit] = await db.select().from(pdvUnits).where(eq(pdvUnits.id, unitId)).limit(1);
    if (!unit) {
      return res.status(404).json({ message: "Unidade PDV não encontrada" });
    }

    return res.json({
      id: unit.id,
      companyName: unit.name,
      companyCnpj: unit.cnpj,
      companyAddress: unit.address,
      companyPhone: unit.phone,
      companyFooterMessage: unit.footerMessage,
      defaultServiceFeePercent: unit.defaultServiceFeePercent,
      waiterCommissionPercent: unit.waiterCommissionPercent,
      updatedAt: unit.updatedAt,
    });
  } catch (err) {
    console.error("Erro ao buscar configurações do PDV:", err);
    return res.status(500).json({ message: "Erro ao buscar configurações" });
  }
};

export const updatePdvSettingsController = async (req: Request, res: Response) => {
  try {
    const unitId = req.pdvUnitId;
    if (!unitId) {
      return res.status(400).json({ message: "Nenhuma unidade PDV selecionada" });
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    if (data.companyName !== undefined) updateData.name = data.companyName;
    if ("companyCnpj" in data) updateData.cnpj = data.companyCnpj ?? null;
    if ("companyAddress" in data) updateData.address = data.companyAddress ?? null;
    if ("companyPhone" in data) updateData.phone = data.companyPhone ?? null;
    if ("companyFooterMessage" in data) updateData.footerMessage = data.companyFooterMessage ?? null;
    if (data.defaultServiceFeePercent !== undefined) updateData.defaultServiceFeePercent = data.defaultServiceFeePercent;
    if (data.waiterCommissionPercent !== undefined) updateData.waiterCommissionPercent = data.waiterCommissionPercent;

    const [updated] = await db
      .update(pdvUnits)
      .set(updateData)
      .where(eq(pdvUnits.id, unitId))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: "Unidade PDV não encontrada" });
    }

    return res.json({
      id: updated.id,
      companyName: updated.name,
      companyCnpj: updated.cnpj,
      companyAddress: updated.address,
      companyPhone: updated.phone,
      companyFooterMessage: updated.footerMessage,
      defaultServiceFeePercent: updated.defaultServiceFeePercent,
      waiterCommissionPercent: updated.waiterCommissionPercent,
      updatedAt: updated.updatedAt,
    });
  } catch (err) {
    console.error("Erro ao salvar configurações do PDV:", err);
    return res.status(500).json({ message: "Erro ao salvar configurações" });
  }
};
