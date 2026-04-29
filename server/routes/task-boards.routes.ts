import { Router } from "express";
import { z } from "zod";
import { eq, sql, count } from "drizzle-orm";
import { db } from "../db";
import { taskBoards, taskStages, tasks } from "@shared/schema";

export const taskBoardsRouter = Router();

const DEFAULT_BOARD_STAGES = [
  { name: "A Fazer",              color: "slate",  order: 1, isDefault: true },
  { name: "Em Andamento",         color: "blue",   order: 2, isDefault: true },
  { name: "Aguardando Aprovação", color: "amber",  order: 3, isDefault: true },
  { name: "Concluído",            color: "green",  order: 4, isDefault: true },
];

async function ensureDefaultBoard(userId: string) {
  const [existing] = await db
    .select()
    .from(taskBoards)
    .where(eq(taskBoards.isDefault, true))
    .limit(1);
  if (existing) return existing;

  const [board] = await db
    .insert(taskBoards)
    .values({ name: "Geral", color: "slate", isDefault: true, createdById: userId })
    .returning();

  // Migra etapas sem board para o board padrão
  const unassigned = await db
    .select()
    .from(taskStages)
    .where(sql`${taskStages.boardId} IS NULL`);

  if (unassigned.length > 0) {
    await db
      .update(taskStages)
      .set({ boardId: board.id })
      .where(sql`${taskStages.boardId} IS NULL`);
  } else {
    const ts = Date.now();
    await db.insert(taskStages).values(
      DEFAULT_BOARD_STAGES.map((s, i) => ({
        name: s.name,
        slug: `${["a_fazer", "em_andamento", "aguardando_aprovacao", "concluido"][i]}`,
        color: s.color,
        order: s.order,
        isDefault: s.isDefault,
        boardId: board.id,
      })),
    );
  }

  // Migra tarefas sem board para o board padrão
  await db
    .update(tasks)
    .set({ boardId: board.id })
    .where(sql`${tasks.boardId} IS NULL`);

  return board;
}

taskBoardsRouter.get("/", async (req, res) => {
  try {
    const { userId } = req.user!;
    await ensureDefaultBoard(userId);

    const boards = await db
      .select()
      .from(taskBoards)
      .orderBy(taskBoards.createdAt);

    const taskCounts = await db
      .select({ boardId: tasks.boardId, total: count() })
      .from(tasks)
      .groupBy(tasks.boardId);

    const countMap = Object.fromEntries(
      taskCounts.map((r) => [r.boardId ?? "", r.total]),
    );

    return res.json(boards.map((b) => ({ ...b, taskCount: countMap[b.id] ?? 0 })));
  } catch (error) {
    console.error("Erro ao buscar boards:", error);
    return res.status(500).json({ message: "Erro ao buscar boards" });
  }
});

taskBoardsRouter.post("/", async (req, res) => {
  try {
    const { userId, role } = req.user!;
    if (role !== "admin" && role !== "gerente") {
      return res.status(403).json({ message: "Sem permissão" });
    }

    const { name, color, description } = z
      .object({
        name: z.string().min(1),
        color: z.string().optional(),
        description: z.string().optional(),
      })
      .parse(req.body);

    const [board] = await db
      .insert(taskBoards)
      .values({ name, color: color ?? "blue", description, isDefault: false, createdById: userId })
      .returning();

    const ts = Date.now();
    await db.insert(taskStages).values(
      DEFAULT_BOARD_STAGES.map((s, i) => ({
        name: s.name,
        slug: `${["a_fazer", "em_andamento", "aguardando_aprovacao", "concluido"][i]}_${ts}_${i}`,
        color: s.color,
        order: s.order,
        isDefault: s.isDefault,
        boardId: board.id,
      })),
    );

    return res.status(201).json(board);
  } catch (error) {
    console.error("Erro ao criar board:", error);
    return res.status(500).json({ message: "Erro ao criar board" });
  }
});

taskBoardsRouter.patch("/:id", async (req, res) => {
  try {
    const { role } = req.user!;
    if (role !== "admin" && role !== "gerente") {
      return res.status(403).json({ message: "Sem permissão" });
    }

    const { id } = req.params;
    const { name, color, description } = z
      .object({
        name: z.string().min(1).optional(),
        color: z.string().optional(),
        description: z.string().optional(),
      })
      .parse(req.body);

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;
    if (description !== undefined) updates.description = description;

    const [board] = await db
      .update(taskBoards)
      .set(updates)
      .where(eq(taskBoards.id, id))
      .returning();

    return res.json(board);
  } catch (error) {
    console.error("Erro ao atualizar board:", error);
    return res.status(500).json({ message: "Erro ao atualizar board" });
  }
});

taskBoardsRouter.delete("/:id", async (req, res) => {
  try {
    const { role } = req.user!;
    if (role !== "admin") {
      return res.status(403).json({ message: "Apenas administradores podem excluir boards" });
    }

    const { id } = req.params;
    const [board] = await db.select().from(taskBoards).where(eq(taskBoards.id, id));
    if (!board) return res.status(404).json({ message: "Board não encontrado" });
    if (board.isDefault) return res.status(400).json({ message: "O board padrão não pode ser excluído" });

    await db.delete(taskBoards).where(eq(taskBoards.id, id));
    return res.json({ message: "Board excluído" });
  } catch (error) {
    console.error("Erro ao excluir board:", error);
    return res.status(500).json({ message: "Erro ao excluir board" });
  }
});
