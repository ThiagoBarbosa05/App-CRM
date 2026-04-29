import { Router } from "express";
import { z } from "zod";
import { eq, max, count } from "drizzle-orm";
import { db } from "../db";
import { taskFileFolders, taskFiles } from "@shared/schema";

export const taskFileFoldersRouter = Router();

taskFileFoldersRouter.get("/", async (_req, res) => {
  try {
    const folders = await db
      .select()
      .from(taskFileFolders)
      .orderBy(taskFileFolders.order, taskFileFolders.createdAt);

    const fileCounts = await db
      .select({ folderId: taskFiles.folderId, total: count() })
      .from(taskFiles)
      .groupBy(taskFiles.folderId);

    const countMap = Object.fromEntries(fileCounts.map((r) => [r.folderId, r.total]));
    return res.json(folders.map((f) => ({ ...f, fileCount: countMap[f.id] ?? 0 })));
  } catch (error) {
    console.error("Erro ao buscar pastas:", error);
    return res.status(500).json({ message: "Erro ao buscar pastas" });
  }
});

taskFileFoldersRouter.post("/", async (req, res) => {
  try {
    const { userId } = req.user!;
    const { name, color } = z
      .object({ name: z.string().min(1), color: z.string().optional() })
      .parse(req.body);

    const [{ maxOrder }] = await db
      .select({ maxOrder: max(taskFileFolders.order) })
      .from(taskFileFolders);

    const [folder] = await db
      .insert(taskFileFolders)
      .values({ name, color: color ?? "slate", order: (maxOrder ?? 0) + 1, createdById: userId })
      .returning();

    return res.status(201).json({ ...folder, fileCount: 0 });
  } catch (error) {
    console.error("Erro ao criar pasta:", error);
    return res.status(500).json({ message: "Erro ao criar pasta" });
  }
});

async function updateFolder(req: any, res: any) {
  try {
    const { id } = req.params;
    const { name, color } = z
      .object({ name: z.string().min(1).optional(), color: z.string().optional() })
      .parse(req.body);

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;

    const [folder] = await db
      .update(taskFileFolders)
      .set(updates)
      .where(eq(taskFileFolders.id, id))
      .returning();

    return res.json(folder);
  } catch (error) {
    console.error("Erro ao atualizar pasta:", error);
    return res.status(500).json({ message: "Erro ao atualizar pasta" });
  }
}

taskFileFoldersRouter.put("/:id", updateFolder);
taskFileFoldersRouter.patch("/:id", updateFolder);

taskFileFoldersRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await db.delete(taskFileFolders).where(eq(taskFileFolders.id, id));
    return res.json({ message: "Pasta excluída" });
  } catch (error) {
    console.error("Erro ao excluir pasta:", error);
    return res.status(500).json({ message: "Erro ao excluir pasta" });
  }
});
