import { Request, Response } from "express";
import { db } from "../../db";
import { clients } from "@shared/schema";
import { or, ilike, sql } from "drizzle-orm";

export const searchClientsController = async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q ?? "").trim();
    if (q.length < 2) {
      return res.json([]);
    }

    const term = `%${q}%`;
    const rows = await db
      .select({
        id: clients.id,
        name: clients.name,
        phone: clients.phone,
        cpf: clients.cpf,
        email: clients.email,
      })
      .from(clients)
      .where(
        or(
          ilike(clients.name, term),
          ilike(sql`coalesce(${clients.phone}, '')`, term),
          ilike(sql`coalesce(${clients.cpf}, '')`, term),
          ilike(sql`coalesce(${clients.email}, '')`, term),
        ),
      )
      .limit(10);

    return res.json(rows);
  } catch (err) {
    console.error("Erro ao buscar clientes:", err);
    return res.status(500).json({ message: "Erro ao buscar clientes" });
  }
};
