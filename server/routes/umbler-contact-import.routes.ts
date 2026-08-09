import { Router } from "express";
import { z } from "zod";
import { getOrganizationMembers } from "../integrations/umbler";
import {
  listContactsForMember,
  startImport,
  getStatus,
} from "../services/umbler-contact-import.service";

export const umblerContactImportRouter = Router();

umblerContactImportRouter.get(
  "/umbler-contact-import/members",
  async (_req, res) => {
    try {
      const members = await getOrganizationMembers();
      return res.json(members);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[umbler-contact-import] Erro ao buscar atendentes:", err);
      return res.status(500).json({ message });
    }
  },
);

umblerContactImportRouter.get(
  "/umbler-contact-import/contacts",
  async (req, res) => {
    const memberId = req.query.memberId;
    if (!memberId || typeof memberId !== "string") {
      return res.status(400).json({ message: "memberId é obrigatório" });
    }

    try {
      const contacts = await listContactsForMember(memberId);
      return res.json(contacts);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[umbler-contact-import] Erro ao listar contatos:", err);
      return res.status(500).json({ message });
    }
  },
);

const contactSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  tags: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      emoji: z.string().nullable().optional(),
      color: z.string().nullable().optional(),
    }),
  ),
  alreadyImported: z.boolean(),
  existingClientId: z.string().optional(),
});

const startImportSchema = z.object({
  memberId: z.string().min(1),
  memberName: z.string().min(1),
  vendorUserId: z.string().min(1),
  contacts: z.array(contactSchema).min(1),
});

umblerContactImportRouter.post(
  "/umbler-contact-import/start",
  async (req, res) => {
    const parsed = startImportSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Dados inválidos", errors: parsed.error.flatten() });
    }

    try {
      const { memberId, memberName, vendorUserId, contacts } = parsed.data;
      await startImport(memberId, memberName, vendorUserId, contacts);
      return res.json({ message: "Importação iniciada" });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("em andamento")) {
        return res.status(409).json({ message });
      }
      console.error("[umbler-contact-import] Erro ao iniciar importação:", err);
      return res.status(500).json({ message: "Erro ao iniciar importação" });
    }
  },
);

umblerContactImportRouter.get(
  "/umbler-contact-import/status",
  (_req, res) => {
    return res.json(getStatus());
  },
);
