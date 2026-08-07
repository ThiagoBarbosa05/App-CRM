import { Request, Response } from "express";
import { or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { clients } from "@shared/schema";
import {
  clientIdentityConditions,
  clientIdentityOrderBy,
  toStoredPhone,
} from "../../services/client-lookup";

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

    const { name, phone, email } = parsed.data;
    // Dígitos crus: o cadastro manual grava assim e o pré-check compara
    // normalizado; gravar "127.022.387-93" aqui criava um par que o
    // `clients_cpf_unique` (UNIQUE sobre o texto cru) não reconhece.
    const cpf = parsed.data.cpf?.replace(/\D/g, "") || null;

    const identity = { cpf, phones: [phone], email };
    const conditions = clientIdentityConditions(identity);

    // Sem este lookup o PDV dependia só do UNIQUE sobre o texto cru, que é cego
    // para os cadastros legados em formato antigo ("31999910141" × o
    // "+5531999910141" que o PDV grava) — e cada atendimento criava uma cópia.
    if (conditions.length > 0) {
      const [existing] = await db
        .select({
          id: clients.id,
          name: clients.name,
          phone: clients.phone,
          cpf: clients.cpf,
          email: clients.email,
        })
        .from(clients)
        .where(or(...conditions))
        .orderBy(...clientIdentityOrderBy(identity))
        .limit(1);

      if (existing) {
        // 200 (e não 409) para o operador seguir o atendimento com o cliente já
        // cadastrado, em vez de ficar preso num erro que ele não pode resolver.
        return res.status(200).json({ ...existing, existing: true });
      }
    }

    const [created] = await db
      .insert(clients)
      .values({
        name,
        // E.164 — sem isso o PDV gravava o telefone exatamente como digitado, e
        // o UNIQUE de `phone` não reconhecia o cliente já cadastrado.
        phone: toStoredPhone(phone),
        cpf,
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

    return res.status(201).json({ ...created, existing: false });
  } catch (err: any) {
    if (err?.code === "23505") {
      return res.status(409).json({ message: "Já existe um cliente com este telefone, CPF ou e-mail." });
    }
    console.error("Erro ao cadastrar cliente rápido:", err);
    return res.status(500).json({ message: "Erro ao cadastrar cliente" });
  }
};
