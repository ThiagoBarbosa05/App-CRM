import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../db";
import { wineries, users } from "../../shared/schema";
import { eq, asc, ilike } from "drizzle-orm";

export const wineriesRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ message: "Não autenticado" });
  return next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Acesso restrito a administradores" });
  }
  return next();
}

// GET /api/wineries — lista todas (autenticado)
wineriesRouter.get("/", requireAuth, async (req, res) => {
  try {
    const { q } = req.query;
    let query = db.select({ id: wineries.id, name: wineries.name }).from(wineries).orderBy(asc(wineries.name));
    if (q && typeof q === "string" && q.trim()) {
      query = db
        .select({ id: wineries.id, name: wineries.name })
        .from(wineries)
        .where(ilike(wineries.name, `%${q.trim()}%`))
        .orderBy(asc(wineries.name)) as typeof query;
    }
    const rows = await query;
    return res.json(rows);
  } catch (error) {
    console.error("[GET /wineries]", error);
    return res.status(500).json({ message: "Erro ao buscar vinícolas" });
  }
});

// POST /api/wineries — cria nova (admin)
wineriesRouter.post("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const schema = z.object({ name: z.string().min(1, "Nome é obrigatório") });
    const { name } = schema.parse(req.body);
    const [winery] = await db
      .insert(wineries)
      .values({ name: name.trim(), createdBy: req.user!.userId })
      .onConflictDoNothing()
      .returning();
    if (!winery) {
      const [existing] = await db.select().from(wineries).where(eq(wineries.name, name.trim()));
      return res.status(200).json(existing);
    }
    return res.status(201).json(winery);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    console.error("[POST /wineries]", error);
    return res.status(500).json({ message: "Erro ao cadastrar vinícola" });
  }
});

// DELETE /api/wineries/:id — remove (admin)
wineriesRouter.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.delete(wineries).where(eq(wineries.id, req.params.id));
    return res.json({ success: true });
  } catch (error) {
    console.error("[DELETE /wineries]", error);
    return res.status(500).json({ message: "Erro ao remover vinícola" });
  }
});
