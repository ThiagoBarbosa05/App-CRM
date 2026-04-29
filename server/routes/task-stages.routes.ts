import { Router } from "express";
import { z } from "zod";
import { eq, max, sql, and } from "drizzle-orm";
import { db } from "../db";
import { taskStages, tasks } from "@shared/schema";

export const taskStagesRouter = Router();

taskStagesRouter.get("/", async (req, res) => {
  try {
    const { boardId } = req.query;
    const stages = await db
      .select()
      .from(taskStages)
      .where(boardId ? eq(taskStages.boardId, boardId as string) : undefined)
      .orderBy(taskStages.order);
    return res.json(stages);
  } catch (error) {
    console.error("Erro ao buscar etapas:", error);
    return res.status(500).json({ message: "Erro ao buscar etapas" });
  }
});

taskStagesRouter.post("/", async (req, res) => {
  try {
    const { role } = req.user!;
    if (role !== "admin" && role !== "gerente") {
      return res.status(403).json({ message: "Sem permissão" });
    }

    const { name, color, boardId } = z
      .object({
        name: z.string().min(1),
        color: z.string().optional(),
        boardId: z.string().min(1),
      })
      .parse(req.body);

    const slug = `stage_${Date.now()}`;
    const [{ maxOrder }] = await db
      .select({ maxOrder: max(taskStages.order) })
      .from(taskStages)
      .where(eq(taskStages.boardId, boardId));

    const [stage] = await db
      .insert(taskStages)
      .values({ name, slug, color: color ?? "slate", order: (maxOrder ?? 0) + 1, isDefault: false, boardId })
      .returning();

    return res.status(201).json(stage);
  } catch (error) {
    console.error("Erro ao criar etapa:", error);
    return res.status(500).json({ message: "Erro ao criar etapa" });
  }
});

taskStagesRouter.patch("/:id", async (req, res) => {
  try {
    const { role } = req.user!;
    if (role !== "admin" && role !== "gerente") {
      return res.status(403).json({ message: "Sem permissão" });
    }

    const { id } = req.params;
    const { name, color } = z
      .object({ name: z.string().min(1).optional(), color: z.string().optional() })
      .parse(req.body);

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;

    const [stage] = await db
      .update(taskStages)
      .set(updates)
      .where(eq(taskStages.id, id))
      .returning();

    return res.json(stage);
  } catch (error) {
    console.error("Erro ao atualizar etapa:", error);
    return res.status(500).json({ message: "Erro ao atualizar etapa" });
  }
});

taskStagesRouter.delete("/:id", async (req, res) => {
  try {
    const { role } = req.user!;
    if (role !== "admin") {
      return res.status(403).json({ message: "Apenas administradores podem excluir etapas" });
    }

    const { id } = req.params;
    const [stage] = await db.select().from(taskStages).where(eq(taskStages.id, id));
    if (!stage) return res.status(404).json({ message: "Etapa não encontrada" });
    if (stage.isDefault) return res.status(400).json({ message: "Etapas padrão não podem ser excluídas" });

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(eq(tasks.status, stage.slug));

    if (count > 0) {
      return res.status(400).json({ message: `Mova as ${count} tarefas desta etapa antes de excluí-la` });
    }

    await db.delete(taskStages).where(eq(taskStages.id, id));
    return res.json({ message: "Etapa excluída" });
  } catch (error) {
    console.error("Erro ao excluir etapa:", error);
    return res.status(500).json({ message: "Erro ao excluir etapa" });
  }
});
