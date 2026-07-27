import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { marketingExpenses } from "@shared/schema";
import { requireAdmin } from "../middleware/validation";

export const marketingExpensesRouter = Router();

// GET /api/marketing-expenses?year=2026
marketingExpensesRouter.get("/", requireAdmin, async (req, res) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const rows = await db
      .select()
      .from(marketingExpenses)
      .where(eq(marketingExpenses.year, year))
      .orderBy(marketingExpenses.month, marketingExpenses.channel);
    return res.json(rows);
  } catch (err) {
    console.error("Error fetching marketing expenses:", err);
    return res.status(500).json({ message: "Erro ao buscar gastos de marketing" });
  }
});

// PUT /api/marketing-expenses/:year/:month/:channel
marketingExpensesRouter.put("/:year/:month/:channel", requireAdmin, async (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    const { channel } = req.params;
    const { amount, budget, notes } = req.body;
    const { userId } = req.user!;

    const VALID_CHANNELS = ["whatsapp_disparos", "google_ads", "meta_ads"];
    if (!VALID_CHANNELS.includes(channel)) {
      return res.status(400).json({ message: "Canal inválido" });
    }
    if (month < 1 || month > 12 || isNaN(year)) {
      return res.status(400).json({ message: "Data inválida" });
    }

    const existing = await db
      .select()
      .from(marketingExpenses)
      .where(
        and(
          eq(marketingExpenses.year, year),
          eq(marketingExpenses.month, month),
          eq(marketingExpenses.channel, channel),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(marketingExpenses)
        .set({
          amount: String(amount ?? 0),
          budget: budget != null && budget !== "" ? String(budget) : null,
          notes: notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(marketingExpenses.id, existing[0].id))
        .returning();
      return res.json(updated);
    } else {
      const [created] = await db
        .insert(marketingExpenses)
        .values({
          year,
          month,
          channel,
          amount: String(amount ?? 0),
          budget: budget != null && budget !== "" ? String(budget) : null,
          notes: notes ?? null,
          createdById: userId,
        })
        .returning();
      return res.json(created);
    }
  } catch (err) {
    console.error("Error upserting marketing expense:", err);
    return res.status(500).json({ message: "Erro ao salvar gasto de marketing" });
  }
});
