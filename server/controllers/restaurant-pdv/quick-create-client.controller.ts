import { Request, Response } from "express";
import { z } from "zod";
import { db } from "../../db";
import { clients } from "@shared/schema";

const schema = z.object({
  name: z.string().min(2, "Informe o nome completo"),
  phone: z.string().optional().nullable(),
  cpf: z.string().optional().nullable(),
  email: z.string().email("E-mail inválido").optional().nullable(),
});

export const quickCreateClientController = async (req: Request, res: Response) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message });
    }

    const { name, phone, cpf, email } = parsed.data;

    const [created] = await db
      .insert(clients)
      .values({
        name,
        phone: phone || null,
        cpf: cpf || null,
        email: email || null,
        categoria: "consumidor",
        origem: "pdv",
      })
      .returning({
        id: clients.id,
        name: clients.name,
        phone: clients.phone,
        cpf: clients.cpf,
        email: clients.email,
      });

    return res.status(201).json(created);
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ message: "Já existe um cliente com este telefone, CPF ou e-mail." });
    }
    console.error("Erro ao cadastrar cliente rápido:", err);
    return res.status(500).json({ message: "Erro ao cadastrar cliente" });
  }
};
