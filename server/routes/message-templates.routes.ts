import { Router } from "express";
import { insertMessageTemplateSchema } from "@shared/schema";
import { validateBody } from "../middleware/validation";
import {
  createMessageTemplate,
  deleteMessageTemplate,
  listMessageTemplates,
  updateMessageTemplate,
} from "../services/message-templates.service";

export const messageTemplatesRouter = Router();

messageTemplatesRouter.get("/", async (_req, res) => {
  try {
    const templates = await listMessageTemplates();
    res.json(templates);
  } catch (error) {
    console.error("Erro ao buscar modelos de mensagem:", error);
    res.status(500).json({ message: "Erro ao buscar modelos de mensagem" });
  }
});

messageTemplatesRouter.post(
  "/",
  validateBody(insertMessageTemplateSchema),
  async (req, res) => {
    try {
      const created = await createMessageTemplate(req.body);
      res.status(201).json(created);
    } catch (error) {
      console.error("Erro ao criar modelo de mensagem:", error);
      res.status(500).json({ message: "Erro ao criar modelo de mensagem" });
    }
  },
);

messageTemplatesRouter.put(
  "/:id",
  validateBody(insertMessageTemplateSchema.partial()),
  async (req, res) => {
    try {
      const updated = await updateMessageTemplate(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Erro ao atualizar modelo de mensagem:", error);
      res.status(500).json({ message: "Erro ao atualizar modelo de mensagem" });
    }
  },
);

messageTemplatesRouter.delete("/:id", async (req, res) => {
  try {
    await deleteMessageTemplate(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir modelo de mensagem:", error);
    res.status(500).json({ message: "Erro ao excluir modelo de mensagem" });
  }
});

export default messageTemplatesRouter;
