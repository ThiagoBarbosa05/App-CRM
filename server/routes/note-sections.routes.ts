import { Router } from "express";
import { z } from "zod";
import { eq, max, count } from "drizzle-orm";
import { db } from "../db";
import { noteSections, notes } from "@shared/schema";

export const noteSectionsRouter = Router();

noteSectionsRouter.get("/", async (_req, res) => {
  try {
    const sections = await db
      .select()
      .from(noteSections)
      .orderBy(noteSections.order, noteSections.createdAt);

    const noteCounts = await db
      .select({ sectionId: notes.sectionId, total: count() })
      .from(notes)
      .groupBy(notes.sectionId);

    const countMap = Object.fromEntries(noteCounts.map((r) => [r.sectionId, r.total]));

    return res.json(sections.map((s) => ({ ...s, noteCount: countMap[s.id] ?? 0 })));
  } catch (error) {
    console.error("Erro ao buscar seções:", error);
    return res.status(500).json({ message: "Erro ao buscar seções" });
  }
});

noteSectionsRouter.post("/", async (req, res) => {
  try {
    const { userId } = req.user!;

    const { name, color } = z
      .object({ name: z.string().min(1), color: z.string().optional() })
      .parse(req.body);

    const [{ maxOrder }] = await db
      .select({ maxOrder: max(noteSections.order) })
      .from(noteSections);

    const [section] = await db
      .insert(noteSections)
      .values({ name, color: color ?? "slate", order: (maxOrder ?? 0) + 1, createdById: userId })
      .returning();

    return res.status(201).json({ ...section, noteCount: 0 });
  } catch (error) {
    console.error("Erro ao criar seção:", error);
    return res.status(500).json({ message: "Erro ao criar seção" });
  }
});

noteSectionsRouter.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = z
      .object({ name: z.string().min(1).optional(), color: z.string().optional() })
      .parse(req.body);

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;

    const [section] = await db
      .update(noteSections)
      .set(updates)
      .where(eq(noteSections.id, id))
      .returning();

    return res.json(section);
  } catch (error) {
    console.error("Erro ao atualizar seção:", error);
    return res.status(500).json({ message: "Erro ao atualizar seção" });
  }
});

noteSectionsRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(noteSections).where(eq(noteSections.id, id));
    return res.json({ message: "Seção excluída" });
  } catch (error) {
    console.error("Erro ao excluir seção:", error);
    return res.status(500).json({ message: "Erro ao excluir seção" });
  }
});
