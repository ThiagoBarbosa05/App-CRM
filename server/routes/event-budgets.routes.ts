import { Router } from "express";
import { z } from "zod";
import {
  insertEventBudgetSchema,
  insertEventCostEntrySchema,
} from "@shared/schema";
import { calculateActualResult } from "@shared/event-budget";
import { storage } from "../storage";
import { hasEventsModuleAccess } from "@shared/roles";

export const eventBudgetsRouter = Router();

const idSchema = z.object({ id: z.string().min(1) });
const costIdSchema = z.object({ costId: z.string().min(1) });

function canAccess(user: Express.User | undefined) {
  return hasEventsModuleAccess(user?.role, user?.eventAccess);
}

function canSeeBudget(
  budget: { createdBy: string },
  user: Express.User | undefined,
) {
  if (!user) return false;
  return (
    user.role === "admin" ||
    user.role === "administrador" ||
    user.eventAccess === true ||
    budget.createdBy === user.userId
  );
}

function toNumber(value: string | number | null | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isNonNegativeDecimal(value: unknown): boolean {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function validateBudgetNumbers(data: Record<string, unknown>): string | null {
  for (const field of ["plannedCost", "plannedPrice", "targetMargin", "revenueOverride"]) {
    if (data[field] != null && !isNonNegativeDecimal(data[field])) {
      return `${field} deve ser um valor numérico não negativo`;
    }
  }
  if (
    data.actualParticipants != null &&
    (!Number.isInteger(Number(data.actualParticipants)) || Number(data.actualParticipants) < 1)
  ) {
    return "actualParticipants deve ser um número inteiro maior que zero";
  }
  return null;
}

function validateCostNumbers(data: Record<string, unknown>): string | null {
  for (const field of ["quantity", "unitValue"]) {
    if (data[field] != null && !isNonNegativeDecimal(data[field])) {
      return `${field} deve ser um valor numérico não negativo`;
    }
  }
  return null;
}

function summary(
  budget: {
    plannedCost: string;
    plannedPrice: string;
    participants: number;
    actualParticipants: number | null;
    revenueOverride: string | null;
  },
  costs: Array<{ quantity: string; unitValue: string; isPaid: boolean; category: string }>,
) {
  const totalCost = costs.reduce(
    (total, cost) => total + toNumber(cost.quantity, 1) * toNumber(cost.unitValue),
    0,
  );
  const paidCost = costs.reduce(
    (total, cost) =>
      total + (cost.isPaid ? toNumber(cost.quantity, 1) * toNumber(cost.unitValue) : 0),
    0,
  );
  const participants = budget.actualParticipants ?? budget.participants;
  const revenue =
    budget.revenueOverride == null
      ? toNumber(budget.plannedPrice)
      : toNumber(budget.revenueOverride);
  const result = calculateActualResult({
    participants,
    revenue,
    costs,
  });
  const byCategory = costs.reduce<Record<string, number>>((acc, cost) => {
    acc[cost.category] =
      (acc[cost.category] ?? 0) +
      toNumber(cost.quantity, 1) * toNumber(cost.unitValue);
    return acc;
  }, {});
  return {
    ...result,
    paidCost,
    openCost: totalCost - paidCost,
    participants,
    revenue,
    plannedCost: toNumber(budget.plannedCost),
    plannedPrice: toNumber(budget.plannedPrice),
    byCategory,
  };
}

eventBudgetsRouter.use((req, res, next) => {
  if (!canAccess(req.user)) {
    return res.status(403).json({
      message: "Sem permissão para acessar orçamentos de eventos",
      code: "FORBIDDEN",
    });
  }
  return next();
});

eventBudgetsRouter.get("/", async (req, res) => {
  try {
    const eventId = typeof req.query.eventId === "string" ? req.query.eventId : undefined;
    const budgets = await storage.getEventBudgets(
      req.user?.userId,
      req.user?.eventAccess ? "admin" : req.user?.role,
      eventId,
    );
    return res.json(budgets);
  } catch (error) {
    console.error("Error listing event budgets:", error);
    return res.status(500).json({ message: "Não foi possível carregar os orçamentos" });
  }
});

eventBudgetsRouter.post("/", async (req, res) => {
  try {
    const parsed = insertEventBudgetSchema
      .omit({ createdBy: true, status: true, approvedBy: true })
      .parse(req.body);
    const numericError = validateBudgetNumbers(parsed);
    if (numericError) return res.status(400).json({ message: numericError });
    const budget = await storage.createEventBudget({
      ...parsed,
      createdBy: req.user!.userId,
      status: "rascunho",
      approvedBy: null,
    });
    return res.status(201).json(budget);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Dados do orçamento inválidos", errors: error.errors });
    }
    console.error("Error creating event budget:", error);
    return res.status(500).json({ message: "Não foi possível salvar o orçamento" });
  }
});

eventBudgetsRouter.get("/:id", async (req, res) => {
  try {
    const { id } = idSchema.parse(req.params);
    const budget = await storage.getEventBudgetById(id);
    if (!budget || !canSeeBudget(budget, req.user)) {
      return res.status(404).json({ message: "Orçamento não encontrado" });
    }
    const costs = await storage.getEventCostEntries(id);
    return res.json({ budget, costs, summary: summary(budget, costs) });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "ID inválido" });
    console.error("Error reading event budget:", error);
    return res.status(500).json({ message: "Não foi possível carregar o orçamento" });
  }
});

eventBudgetsRouter.patch("/:id", async (req, res) => {
  try {
    const { id } = idSchema.parse(req.params);
    const current = await storage.getEventBudgetById(id);
    if (!current || !canSeeBudget(current, req.user)) {
      return res.status(404).json({ message: "Orçamento não encontrado" });
    }
    const parsed = insertEventBudgetSchema
      .omit({ createdBy: true, status: true, approvedBy: true })
      .partial()
      .parse(req.body);
    const numericError = validateBudgetNumbers(parsed);
    if (numericError) return res.status(400).json({ message: numericError });
    const approvedBaselineFields = [
      "eventId",
      "participants",
      "plannedCost",
      "plannedPrice",
      "targetMargin",
      "proposalText",
      "calculatorData",
    ];
    if (
      current.status === "aprovado" &&
      approvedBaselineFields.some((field) => field in parsed)
    ) {
      return res.status(409).json({
        message: "O planejamento aprovado não pode ser alterado. Ajuste somente a receita ou os participantes realizados.",
      });
    }
    const budget = await storage.updateEventBudget(id, parsed);
    return res.json(budget);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Dados do orçamento inválidos", errors: error.errors });
    console.error("Error updating event budget:", error);
    return res.status(500).json({ message: "Não foi possível atualizar o orçamento" });
  }
});

eventBudgetsRouter.post("/:id/approve", async (req, res) => {
  try {
    const { id } = idSchema.parse(req.params);
    const current = await storage.getEventBudgetById(id);
    if (!current || !canSeeBudget(current, req.user)) {
      return res.status(404).json({ message: "Orçamento não encontrado" });
    }
    if (current.status !== "rascunho") {
      return res.status(409).json({ message: "Somente orçamentos em rascunho podem ser aprovados" });
    }
    const budget = await storage.approveEventBudget(id, req.user!.userId);
    return res.json(budget);
  } catch (error) {
    console.error("Error approving event budget:", error);
    return res.status(500).json({ message: "Não foi possível aprovar o orçamento" });
  }
});

eventBudgetsRouter.post("/:id/costs", async (req, res) => {
  try {
    const { id } = idSchema.parse(req.params);
    const budget = await storage.getEventBudgetById(id);
    if (!budget || !canSeeBudget(budget, req.user)) {
      return res.status(404).json({ message: "Orçamento não encontrado" });
    }
    if (budget.status !== "aprovado") {
      return res.status(409).json({ message: "Aprove o orçamento antes de lançar custos realizados" });
    }
    const parsed = insertEventCostEntrySchema.omit({ createdBy: true, budgetId: true }).parse(req.body);
    const numericError = validateCostNumbers(parsed);
    if (numericError) return res.status(400).json({ message: numericError });
    const entry = await storage.createEventCostEntry({
      ...parsed,
      budgetId: id,
      createdBy: req.user!.userId,
    });
    return res.status(201).json(entry);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Dados do custo inválidos", errors: error.errors });
    console.error("Error creating event cost:", error);
    return res.status(500).json({ message: "Não foi possível salvar o custo" });
  }
});

eventBudgetsRouter.patch("/:id/costs/:costId", async (req, res) => {
  try {
    const { id, costId } = idSchema.merge(costIdSchema).parse(req.params);
    const budget = await storage.getEventBudgetById(id);
    if (!budget || !canSeeBudget(budget, req.user)) {
      return res.status(404).json({ message: "Orçamento não encontrado" });
    }
    if (budget.status !== "aprovado") {
      return res.status(409).json({ message: "Custos realizados só podem ser alterados em orçamentos aprovados" });
    }
    const costs = await storage.getEventCostEntries(id);
    if (!costs.some((cost) => cost.id === costId)) {
      return res.status(404).json({ message: "Lançamento não encontrado" });
    }
    const parsed = insertEventCostEntrySchema
      .omit({ createdBy: true, budgetId: true })
      .partial()
      .parse(req.body);
    const numericError = validateCostNumbers(parsed);
    if (numericError) return res.status(400).json({ message: numericError });
    const entry = await storage.updateEventCostEntry(costId, parsed);
    if (!entry) return res.status(404).json({ message: "Lançamento não encontrado" });
    return res.json(entry);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Dados do custo inválidos", errors: error.errors });
    console.error("Error updating event cost:", error);
    return res.status(500).json({ message: "Não foi possível atualizar o custo" });
  }
});

eventBudgetsRouter.delete("/:id/costs/:costId", async (req, res) => {
  try {
    const { id, costId } = idSchema.merge(costIdSchema).parse(req.params);
    const budget = await storage.getEventBudgetById(id);
    if (!budget || !canSeeBudget(budget, req.user)) {
      return res.status(404).json({ message: "Orçamento não encontrado" });
    }
    if (budget.status !== "aprovado") {
      return res.status(409).json({ message: "Custos realizados só podem ser removidos em orçamentos aprovados" });
    }
    const costs = await storage.getEventCostEntries(id);
    if (!costs.some((cost) => cost.id === costId)) {
      return res.status(404).json({ message: "Lançamento não encontrado" });
    }
    const deleted = await storage.deleteEventCostEntry(costId);
    return res.json({ deleted });
  } catch (error) {
    console.error("Error deleting event cost:", error);
    return res.status(500).json({ message: "Não foi possível remover o custo" });
  }
});
