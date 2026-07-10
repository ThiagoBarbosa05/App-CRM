import { Router } from "express";
import { z } from "zod";
import { insertMessageTemplateSchema } from "@shared/schema";
import { validateBody } from "../middleware/validation";
import {
  createMessageTemplate,
  deleteMessageTemplate,
  getMessageTemplateById,
  listMessageTemplates,
  renderTemplate,
  updateMessageTemplate,
} from "../services/message-templates.service";
import { sendSms, SmsApiError } from "../integrations/sms";
import { sendEmail, EmailApiError } from "../integrations/email";

export const messageTemplatesRouter = Router();

const TEST_SEND_SAMPLE_VARIABLES: Record<string, string> = {
  nome: "Maria Silva",
  valor: "R$ 50,00",
  data: "15/07/2026",
  dias: "30",
  data_ultima_compra: "10/06/2026",
};

const testSendSchema = z.object({
  to: z.string().min(1, "Informe um destino para o teste"),
});

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

messageTemplatesRouter.post(
  "/:id/test-send",
  validateBody(testSendSchema),
  async (req, res) => {
    try {
      const template = await getMessageTemplateById(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Modelo não encontrado" });
      }

      const { to } = req.body as { to: string };
      const body = renderTemplate(template.body, TEST_SEND_SAMPLE_VARIABLES);

      if (template.channel === "sms") {
        await sendSms({ to, body: `[TESTE] ${body}` });
      } else {
        const subject = template.subject
          ? renderTemplate(template.subject, TEST_SEND_SAMPLE_VARIABLES)
          : "Aviso";
        await sendEmail({
          to,
          subject: `[TESTE] ${subject}`,
          html: body,
        });
      }

      res.json({ message: "Mensagem de teste enviada com sucesso" });
    } catch (error) {
      const message =
        error instanceof SmsApiError || error instanceof EmailApiError || error instanceof Error
          ? error.message
          : "Erro ao enviar mensagem de teste";
      console.error("Erro ao enviar mensagem de teste:", error);
      res.status(422).json({ message });
    }
  },
);

export default messageTemplatesRouter;
