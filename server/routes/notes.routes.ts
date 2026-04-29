import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { notes, noteSections, users } from "@shared/schema";

export const notesRouter = Router();

notesRouter.get("/", async (req, res) => {
  try {
    const { sectionId } = req.query;

    const rows = await db
      .select({
        note: notes,
        createdBy: { id: users.id, name: users.name },
      })
      .from(notes)
      .leftJoin(users, eq(notes.createdById, users.id))
      .where(sectionId ? eq(notes.sectionId, sectionId as string) : undefined)
      .orderBy(notes.updatedAt);

    return res.json(rows.map((r) => ({ ...r.note, createdBy: r.createdBy })));
  } catch (error) {
    console.error("Erro ao buscar notas:", error);
    return res.status(500).json({ message: "Erro ao buscar notas" });
  }
});

notesRouter.get("/:id", async (req, res) => {
  try {
    const [row] = await db
      .select({
        note: notes,
        createdBy: { id: users.id, name: users.name },
      })
      .from(notes)
      .leftJoin(users, eq(notes.createdById, users.id))
      .where(eq(notes.id, req.params.id));

    if (!row) return res.status(404).json({ message: "Nota não encontrada" });
    return res.json({ ...row.note, createdBy: row.createdBy });
  } catch (error) {
    console.error("Erro ao buscar nota:", error);
    return res.status(500).json({ message: "Erro ao buscar nota" });
  }
});

notesRouter.post("/", async (req, res) => {
  try {
    const { userId } = req.user!;

    const { title, sectionId, content } = z
      .object({
        title: z.string().min(1),
        sectionId: z.string().min(1),
        content: z.string().optional(),
      })
      .parse(req.body);

    const [section] = await db
      .select()
      .from(noteSections)
      .where(eq(noteSections.id, sectionId));
    if (!section) return res.status(404).json({ message: "Seção não encontrada" });

    const [note] = await db
      .insert(notes)
      .values({ title, content: content ?? "", sectionId, createdById: userId })
      .returning();

    return res.status(201).json(note);
  } catch (error) {
    console.error("Erro ao criar nota:", error);
    return res.status(500).json({ message: "Erro ao criar nota" });
  }
});

notesRouter.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = z
      .object({
        title: z.string().min(1).optional(),
        content: z.string().optional(),
      })
      .parse(req.body);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;

    const [note] = await db
      .update(notes)
      .set(updates)
      .where(eq(notes.id, id))
      .returning();

    return res.json(note);
  } catch (error) {
    console.error("Erro ao atualizar nota:", error);
    return res.status(500).json({ message: "Erro ao atualizar nota" });
  }
});

notesRouter.delete("/:id", async (req, res) => {
  try {
    await db.delete(notes).where(eq(notes.id, req.params.id));
    return res.json({ message: "Nota excluída" });
  } catch (error) {
    console.error("Erro ao excluir nota:", error);
    return res.status(500).json({ message: "Erro ao excluir nota" });
  }
});
