import { Request, Response } from "express";
import { z } from "zod";
import { pdvUnitsService } from "../../services/pdv-units.service";
import { db } from "../../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const createUnitSchema = z.object({
  name: z.string().min(1, "Nome da unidade é obrigatório"),
  cnpj: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  footerMessage: z.string().optional().nullable(),
  defaultServiceFeePercent: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  waiterCommissionPercent: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
});

export const listPdvUnitsController = async (_req: Request, res: Response) => {
  try {
    const units = await pdvUnitsService.listUnits();
    return res.json(units);
  } catch (err) {
    console.error("Erro ao listar unidades:", err);
    return res.status(500).json({ message: "Erro ao listar unidades" });
  }
};

export const createPdvUnitController = async (req: Request, res: Response) => {
  try {
    const parsed = createUnitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const unit = await pdvUnitsService.createUnit({
      name: parsed.data.name,
      cnpj: parsed.data.cnpj ?? null,
      phone: parsed.data.phone ?? null,
      address: parsed.data.address ?? null,
      footerMessage: parsed.data.footerMessage ?? null,
      defaultServiceFeePercent: parsed.data.defaultServiceFeePercent ?? "10.00",
      waiterCommissionPercent: parsed.data.waiterCommissionPercent ?? "0.00",
      isActive: true,
    });
    return res.status(201).json(unit);
  } catch (err) {
    console.error("Erro ao criar unidade:", err);
    return res.status(500).json({ message: "Erro ao criar unidade" });
  }
};

export const updatePdvUnitController = async (req: Request, res: Response) => {
  try {
    const parsed = createUnitSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }
    const unit = await pdvUnitsService.updateUnit(req.params.id, parsed.data);
    if (!unit) return res.status(404).json({ message: "Unidade não encontrada" });
    return res.json(unit);
  } catch (err) {
    console.error("Erro ao atualizar unidade:", err);
    return res.status(500).json({ message: "Erro ao atualizar unidade" });
  }
};

export const deactivatePdvUnitController = async (req: Request, res: Response) => {
  try {
    await pdvUnitsService.deactivateUnit(req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    console.error("Erro ao desativar unidade:", err);
    return res.status(500).json({ message: "Erro ao desativar unidade" });
  }
};

export const listPdvUnitUsersController = async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, pdvUnitId: users.pdvUnitId })
      .from(users)
      .where(eq(users.pdvUnitId, req.params.id));
    return res.json(rows);
  } catch (err) {
    console.error("Erro ao listar usuários da unidade:", err);
    return res.status(500).json({ message: "Erro ao listar usuários da unidade" });
  }
};
