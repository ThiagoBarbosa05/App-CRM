import { Router } from "express";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { eq, desc, and, or, inArray } from "drizzle-orm";

import { db } from "../db";
import {
  tasks,
  taskComments,
  users,
  insertTaskSchema,
  insertTaskCommentSchema,
} from "@shared/schema";

export const tasksRouter = Router();

// Lista tarefas — admin/gerente vê todas, vendedor vê só as suas
tasksRouter.get("/", async (req, res) => {
  try {
    const { userId, role } = req.user!;

    const { boardId } = req.query;

    const whereClause = (() => {
      const conditions = [];
      if (role === "vendedor") conditions.push(eq(tasks.assigneeId, userId));
      if (boardId) conditions.push(eq(tasks.boardId, boardId as string));
      return conditions.length === 1 ? conditions[0] : conditions.length > 1 ? and(...conditions) : undefined;
    })();

    const rows = await db
      .select({
        task: tasks,
        assignee: {
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        },
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assigneeId, users.id))
      .where(whereClause)
      .orderBy(desc(tasks.createdAt));

    // Busca criadores em batch
    const creatorIds = Array.from(new Set(rows.map((r) => r.task.createdById)));
    const creatorMap: Record<string, { id: string; name: string }> = {};
    if (creatorIds.length > 0) {
      const creators = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(
          creatorIds.length === 1
            ? eq(users.id, creatorIds[0])
            : or(...creatorIds.map((id) => eq(users.id, id))),
        );
      creators.forEach((c) => { creatorMap[c.id] = c; });
    }

    const result = rows.map((r) => ({
      ...r.task,
      assignee: r.assignee,
      createdBy: creatorMap[r.task.createdById] ?? null,
    }));

    return res.json(result);
  } catch (error) {
    console.error("Erro ao buscar tarefas:", error);
    return res.status(500).json({ message: "Erro ao buscar tarefas" });
  }
});

// Busca uma tarefa com comentários
tasksRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user!;

    const [row] = await db
      .select({
        task: tasks,
        assignee: {
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
        },
      })
      .from(tasks)
      .leftJoin(users, eq(tasks.assigneeId, users.id))
      .where(eq(tasks.id, id));

    if (!row) return res.status(404).json({ message: "Tarefa não encontrada" });
    if (role === "vendedor" && row.task.assigneeId !== userId) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const comments = await db
      .select({
        comment: taskComments,
        user: { id: users.id, name: users.name },
      })
      .from(taskComments)
      .leftJoin(users, eq(taskComments.userId, users.id))
      .where(eq(taskComments.taskId, id))
      .orderBy(taskComments.createdAt);

    return res.json({
      ...row.task,
      assignee: row.assignee,
      comments: comments.map((c) => ({ ...c.comment, user: c.user })),
    });
  } catch (error) {
    console.error("Erro ao buscar tarefa:", error);
    return res.status(500).json({ message: "Erro ao buscar tarefa" });
  }
});

// Reordena tarefas dentro de um estágio
tasksRouter.post("/reorder", async (req, res) => {
  try {
    const { orderedIds } = z.object({ orderedIds: z.array(z.string()).min(1) }).parse(req.body);
    await Promise.all(
      orderedIds.map((id, index) =>
        db.update(tasks).set({ order: (index + 1) * 100 }).where(eq(tasks.id, id))
      )
    );
    return res.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: fromZodError(error).toString() });
    }
    console.error("Erro ao reordenar tarefas:", error);
    return res.status(500).json({ message: "Erro ao reordenar tarefas" });
  }
});

// Cria tarefa — apenas admin e gerente
tasksRouter.post("/", async (req, res) => {
  console.log("[tasks] POST / chamado — user:", req.user?.userId, "role:", req.user?.role);
  console.log("[tasks] body recebido:", JSON.stringify(req.body));
  try {
    const { userId, role } = req.user!;
    if (role === "vendedor") {
      return res.status(403).json({ message: "Sem permissão para criar tarefas" });
    }

    const data = insertTaskSchema.parse({
      ...req.body,
      createdById: userId,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
    });

    console.log("[tasks] dados validados, inserindo no banco...");
    const [task] = await db.insert(tasks).values(data).returning();
    console.log("[tasks] tarefa criada com ID:", task.id);
    return res.status(201).json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("[tasks] Erro de validação Zod:", fromZodError(error).toString());
      return res.status(400).json({ message: fromZodError(error).toString() });
    }
    console.error("[tasks] Erro ao criar tarefa:", error);
    return res.status(500).json({ message: "Erro ao criar tarefa" });
  }
});

// Atualiza tarefa — admin/gerente atualiza tudo; vendedor só muda o status da própria tarefa
tasksRouter.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user!;

    const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!existing) return res.status(404).json({ message: "Tarefa não encontrada" });

    if (role === "vendedor") {
      if (existing.assigneeId !== userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      // Vendedor só pode alterar o status
      const { status } = z
        .object({ status: z.string().min(1) })
        .parse(req.body);
      const [updated] = await db
        .update(tasks)
        .set({ status, updatedAt: new Date() })
        .where(eq(tasks.id, id))
        .returning();
      return res.json(updated);
    }

    const data = insertTaskSchema.partial().parse({
      ...req.body,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : req.body.dueDate,
    });
    const [updated] = await db
      .update(tasks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: fromZodError(error).toString() });
    }
    console.error("Erro ao atualizar tarefa:", error);
    return res.status(500).json({ message: "Erro ao atualizar tarefa" });
  }
});

// Exclui tarefa — apenas admin
tasksRouter.delete("/:id", async (req, res) => {
  try {
    const { role } = req.user!;
    if (role !== "admin") {
      return res.status(403).json({ message: "Apenas administradores podem excluir tarefas" });
    }
    const { id } = req.params;
    await db.delete(tasks).where(eq(tasks.id, id));
    return res.json({ message: "Tarefa excluída" });
  } catch (error) {
    console.error("Erro ao excluir tarefa:", error);
    return res.status(500).json({ message: "Erro ao excluir tarefa" });
  }
});

// Reordena tarefas dentro de uma coluna
tasksRouter.post("/reorder", async (req, res) => {
  try {
    const { orderedIds } = req.body as { orderedIds: string[] };
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ message: "orderedIds deve ser um array" });
    }
    await Promise.all(
      orderedIds.map((id, index) =>
        db.update(tasks).set({ order: index }).where(eq(tasks.id, id))
      )
    );
    return res.json({ message: "Ordem atualizada" });
  } catch (error) {
    console.error("Erro ao reordenar tarefas:", error);
    return res.status(500).json({ message: "Erro ao reordenar tarefas" });
  }
});

// Adiciona comentário — qualquer usuário autenticado com acesso à tarefa
tasksRouter.post("/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.user!;

    const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!existing) return res.status(404).json({ message: "Tarefa não encontrada" });
    if (role === "vendedor" && existing.assigneeId !== userId) {
      return res.status(403).json({ message: "Acesso negado" });
    }

    const data = insertTaskCommentSchema.parse({
      taskId: id,
      userId,
      content: req.body.content,
    });

    const [comment] = await db.insert(taskComments).values(data).returning();
    return res.status(201).json(comment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: fromZodError(error).toString() });
    }
    console.error("Erro ao adicionar comentário:", error);
    return res.status(500).json({ message: "Erro ao adicionar comentário" });
  }
});
