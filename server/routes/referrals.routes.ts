import { Router, Request, Response, NextFunction } from "express";
import { sendReferralMessageController } from "../controllers/referrals/send-referral-message.controller";
import { deleteReferralController } from "../controllers/referrals/delete-referral.controller";
import { getProgramController } from "../controllers/referrals/get-program.controller";
import { referralsService } from "../services/referrals.service";

export const referralsRouter = Router();

function requireAdminOrGerente(req: Request, res: Response, next: NextFunction) {
  const role = req.user?.role;
  if (role !== "admin" && role !== "administrador" && role !== "gerente") {
    return res.status(403).json({ message: "Acesso restrito a administradores e gerentes" });
  }
  return next();
}

referralsRouter.get("/program", getProgramController);
referralsRouter.post("/:referralId/send-message", sendReferralMessageController);
referralsRouter.delete("/:referralId", deleteReferralController);

// ─── Catálogo de Benefícios ────────────────────────────────────────────────

referralsRouter.get("/benefits/catalog", async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === "true";
    const catalog = await referralsService.getBenefitCatalog(includeInactive);
    return res.json(catalog);
  } catch (error) {
    console.error("Erro ao buscar catálogo:", error);
    return res.status(500).json({ message: "Erro ao buscar catálogo de benefícios" });
  }
});

referralsRouter.post("/benefits/catalog", requireAdminOrGerente, async (req, res) => {
  try {
    const { name, description, type, isActive } = req.body;
    if (!name || !type || !["B1", "B2"].includes(type)) {
      return res.status(400).json({ message: "Nome e tipo (B1 ou B2) são obrigatórios" });
    }
    const benefit = await referralsService.createBenefit({
      name,
      description: description ?? null,
      type,
      isActive: isActive ?? true,
    });
    return res.status(201).json(benefit);
  } catch (error) {
    console.error("Erro ao criar benefício:", error);
    return res.status(500).json({ message: "Erro ao criar benefício" });
  }
});

referralsRouter.put("/benefits/catalog/:id", requireAdminOrGerente, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, type, isActive } = req.body;
    if (type && !["B1", "B2"].includes(type)) {
      return res.status(400).json({ message: "Tipo inválido (use B1 ou B2)" });
    }
    const updated = await referralsService.updateBenefit(id, {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(type !== undefined && { type }),
      ...(isActive !== undefined && { isActive }),
    });
    if (!updated) return res.status(404).json({ message: "Benefício não encontrado" });
    return res.json(updated);
  } catch (error) {
    console.error("Erro ao atualizar benefício:", error);
    return res.status(500).json({ message: "Erro ao atualizar benefício" });
  }
});

referralsRouter.delete("/benefits/catalog/:id", requireAdminOrGerente, async (req, res) => {
  try {
    const { id } = req.params;
    await referralsService.deleteBenefit(id);
    return res.json({ message: "Benefício excluído" });
  } catch (error) {
    console.error("Erro ao excluir benefício:", error);
    return res.status(500).json({ message: "Erro ao excluir benefício" });
  }
});

// ─── Entregas ──────────────────────────────────────────────────────────────

referralsRouter.post("/benefits/deliver", async (req, res) => {
  try {
    const { referrerId, benefitCatalogId, notes } = req.body;
    const deliveredByUserId = req.user?.userId;
    if (!referrerId || !benefitCatalogId) {
      return res.status(400).json({ message: "referrerId e benefitCatalogId são obrigatórios" });
    }
    if (!deliveredByUserId) {
      return res.status(401).json({ message: "Usuário não autenticado" });
    }
    await referralsService.deliverBenefitFromCatalog(
      referrerId,
      benefitCatalogId,
      deliveredByUserId,
      notes,
    );
    return res.json({ message: "Benefício entregue com sucesso" });
  } catch (error: any) {
    console.error("Erro ao entregar benefício:", error);
    return res.status(500).json({ message: error?.message ?? "Erro ao entregar benefício" });
  }
});

referralsRouter.get("/benefits/deliveries", async (req, res) => {
  try {
    const user = req.user;
    const deliveries = await referralsService.getDeliveries(user?.userId, user?.role);
    return res.json(deliveries);
  } catch (error) {
    console.error("Erro ao buscar entregas:", error);
    return res.status(500).json({ message: "Erro ao buscar histórico de entregas" });
  }
});
