import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { marketingExpenses, marketingBudgets } from "@shared/schema";
import { requireAdmin } from "../middleware/validation";

export const marketingExpensesRouter = Router();

const VALID_CHANNELS = ["whatsapp_disparos", "google_ads", "meta_ads"];

// ── Individual launches ────────────────────────────────────────────────────────

// GET /api/marketing-expenses?year=2026
marketingExpensesRouter.get("/", requireAdmin, async (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const rows = await db
      .select()
      .from(marketingExpenses)
      .where(eq(marketingExpenses.year, year))
      .orderBy(marketingExpenses.launchedAt, marketingExpenses.channel);
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching marketing expenses:", err);
    return res.status(500).json({ message: "Erro ao buscar gastos de marketing" });
  }
});

// POST /api/marketing-expenses — create individual launch
marketingExpensesRouter.post("/", requireAdmin, async (req, res) => {
  try {
    const { launchedAt, channel, amount, notes } = req.body;
    const { userId } = req.user!;

    if (!VALID_CHANNELS.includes(channel)) {
      return res.status(400).json({ message: "Canal inválido" });
    }
    if (!launchedAt || !amount || isNaN(parseFloat(amount))) {
      return res.status(400).json({ message: "Data e valor são obrigatórios" });
    }

    const date = new Date(launchedAt);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;

    const [created] = await db
      .insert(marketingExpenses)
      .values({
        launchedAt,
        year,
        month,
        channel,
        amount: String(parseFloat(amount)),
        notes: notes || null,
        createdById: userId,
      })
      .returning();
    return res.status(201).json(created);
  } catch (err) {
    console.error("Error creating marketing expense:", err);
    return res.status(500).json({ message: "Erro ao criar lançamento" });
  }
});

// DELETE /api/marketing-expenses/:id
marketingExpensesRouter.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await db
      .delete(marketingExpenses)
      .where(eq(marketingExpenses.id, req.params.id));
    return res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting marketing expense:", err);
    return res.status(500).json({ message: "Erro ao excluir lançamento" });
  }
});

// ── Monthly budgets ────────────────────────────────────────────────────────────

// GET /api/marketing-expenses/budgets?year=2026
marketingExpensesRouter.get("/budgets", requireAdmin, async (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const rows = await db
      .select()
      .from(marketingBudgets)
      .where(eq(marketingBudgets.year, year))
      .orderBy(marketingBudgets.month, marketingBudgets.channel);
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching marketing budgets:", err);
    return res.status(500).json({ message: "Erro ao buscar orçamentos" });
  }
});

// PUT /api/marketing-expenses/budgets/:year/:month/:channel — upsert budget
marketingExpensesRouter.put("/budgets/:year/:month/:channel", requireAdmin, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    const { channel } = req.params;
    const { budget } = req.body;

    if (!VALID_CHANNELS.includes(channel)) {
      return res.status(400).json({ message: "Canal inválido" });
    }
    if (month < 1 || month > 12 || isNaN(year)) {
      return res.status(400).json({ message: "Data inválida" });
    }

    const existing = await db
      .select()
      .from(marketingBudgets)
      .where(
        and(
          eq(marketingBudgets.year, year),
          eq(marketingBudgets.month, month),
          eq(marketingBudgets.channel, channel),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(marketingBudgets)
        .set({ budget: String(parseFloat(budget) || 0), updatedAt: new Date() })
        .where(eq(marketingBudgets.id, existing[0].id))
        .returning();
      return res.json(updated);
    } else {
      const [created] = await db
        .insert(marketingBudgets)
        .values({ year, month, channel, budget: String(parseFloat(budget) || 0) })
        .returning();
      return res.json(created);
    }
  } catch (err) {
    console.error("Error upserting marketing budget:", err);
    return res.status(500).json({ message: "Erro ao salvar orçamento" });
  }
});
