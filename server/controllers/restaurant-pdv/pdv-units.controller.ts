import { Request, Response } from "express";
import { z } from "zod";
import { pdvUnitsService } from "../../services/pdv-units.service";
import { blingConnectionsService } from "../../services/bling-connections.service";
import { db } from "../../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

const createUnitSchema = z.object({
  name: z.string().min(1, "Nome da unidade é obrigatório"),
  cnpj: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  footerMessage: z.string().optional().nullable(),
  // null = desvincular o catálogo Bling da unidade.
  blingConnectionId: z.string().optional().nullable(),
  // null = sem vendedor padrão.
  defaultSellerId: z.string().optional().nullable(),
  defaultServiceFeePercent: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  waiterCommissionPercent: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
});

/**
 * O dropdown do frontend já só oferece contas conectadas, mas a conexão pode ter
 * sido revogada com o modal aberto — e uma conexão inválida aqui vira um PDV com
 * catálogo vazio, sem erro visível. Retorna a mensagem de erro ou null.
 */
async function validateBlingConnection(
  connectionId: string | null | undefined,
): Promise<string | null> {
  if (!connectionId) return null;
  const connection = await blingConnectionsService.getById(connectionId);
  if (!connection) return "Conta Bling não encontrada";
  if (connection.status !== "connected") {
    return "Conta Bling não está conectada";
  }
  return null;
}

/**
 * O select do frontend já só oferece vendedores mapeados para a conexão
 * escolhida, mas um POST/PUT direto na API poderia gravar uma combinação
 * vendedor/conta inconsistente. Retorna a mensagem de erro ou null.
 */
async function validateDefaultSeller(
  connectionId: string | null | undefined,
  sellerId: string | null | undefined,
): Promise<string | null> {
  if (!sellerId) return null;
  if (!connectionId) {
    return "Selecione uma conta Bling antes de escolher o vendedor padrão";
  }
  const eligible = await pdvUnitsService.listEligibleSellers(connectionId);
  if (!eligible.some((seller) => seller.id === sellerId)) {
    return "Vendedor selecionado não está mapeado para a conta Bling desta unidade";
  }
  return null;
}

export const listPdvUnitsController = async (_req: Request, res: Response) => {
  try {
    const units = await pdvUnitsService.listUnitsWithCatalog();
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
    const blingError = await validateBlingConnection(parsed.data.blingConnectionId);
    if (blingError) {
      return res.status(400).json({ message: blingError });
    }
    const sellerError = await validateDefaultSeller(
      parsed.data.blingConnectionId,
      parsed.data.defaultSellerId,
    );
    if (sellerError) {
      return res.status(400).json({ message: sellerError });
    }
    const unit = await pdvUnitsService.createUnit({
      name: parsed.data.name,
      cnpj: parsed.data.cnpj ?? null,
      phone: parsed.data.phone ?? null,
      address: parsed.data.address ?? null,
      footerMessage: parsed.data.footerMessage ?? null,
      blingConnectionId: parsed.data.blingConnectionId ?? null,
      defaultSellerId: parsed.data.defaultSellerId ?? null,
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
    const blingError = await validateBlingConnection(parsed.data.blingConnectionId);
    if (blingError) {
      return res.status(400).json({ message: blingError });
    }
    // blingConnectionId pode não vir no PUT parcial — nesse caso o vendedor
    // padrão precisa ser validado contra a conexão já salva na unidade.
    let effectiveConnectionId = parsed.data.blingConnectionId;
    if (effectiveConnectionId === undefined && parsed.data.defaultSellerId) {
      const current = await pdvUnitsService.getUnit(req.params.id);
      effectiveConnectionId = current?.blingConnectionId ?? null;
    }
    const sellerError = await validateDefaultSeller(effectiveConnectionId, parsed.data.defaultSellerId);
    if (sellerError) {
      return res.status(400).json({ message: sellerError });
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

export const listEligibleSellersController = async (req: Request, res: Response) => {
  try {
    const { connectionId } = req.query as { connectionId?: string };
    if (!connectionId) {
      return res.json([]);
    }
    const sellers = await pdvUnitsService.listEligibleSellers(connectionId);
    return res.json(sellers);
  } catch (err) {
    console.error("Erro ao listar vendedores elegíveis:", err);
    return res.status(500).json({ message: "Erro ao listar vendedores elegíveis" });
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
