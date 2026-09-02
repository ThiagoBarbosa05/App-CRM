import { Router } from "express";
import { z } from "zod";
import { insertAutomationRuleSchema } from "@shared/schema";
import { validateBody } from "../middleware/validation";
import {
  createAutomationRule,
  deleteAutomationRule,
  getAutomationRuleById,
  listAutomationRules,
  reorderAutomationRules,
  toggleAutomationRuleActive,
  updateAutomationRule,
} from "../services/automation-rules.service";
import { getMessageTemplateById } from "../services/message-templates.service";

export const automationRulesRouter = Router();
const automationRuleRequestSchema = insertAutomationRuleSchema.omit({
  createdBy: true,
});

async function validateRuleConfiguration(
  data: z.infer<typeof automationRuleRequestSchema>,
  currentRuleId?: string,
): Promise<string | null> {
  if (!data.smsEnabled && !data.emailEnabled) return "Selecione ao menos um canal";
  if (data.smsEnabled && !data.smsTemplateId) return "Selecione um modelo de SMS";
  if (data.emailEnabled && !data.emailTemplateId) return "Selecione um modelo de e-mail";

  const templateChecks = await Promise.all([
    data.smsEnabled && data.smsTemplateId
      ? getMessageTemplateById(data.smsTemplateId)
      : null,
    data.emailEnabled && data.emailTemplateId
      ? getMessageTemplateById(data.emailTemplateId)
      : null,
  ]);
  const [smsTemplate, emailTemplate] = templateChecks;
  if (data.smsEnabled && (!smsTemplate || smsTemplate.channel !== "sms" || !smsTemplate.isActive)) {
    return "O modelo de SMS precisa estar ativo e ser do canal SMS";
  }
  if (data.emailEnabled && (!emailTemplate || emailTemplate.channel !== "email" || !emailTemplate.isActive)) {
    return "O modelo de e-mail precisa estar ativo e ser do canal e-mail";
  }

  const params = data.triggerParams ?? {};
  if (data.trigger === "cashback_expiring") {
    const days = params.daysBeforeExpiry;
    if (typeof days !== "number" || !Number.isInteger(days) || days < 0) {
      return "daysBeforeExpiry deve ser um número inteiro não negativo";
    }
  }
  if (data.trigger === "inactivity_reengagement") {
    const attempt = params.attemptNumber;
    const days = params.inactivityDays;
    if (typeof attempt !== "number" || !Number.isInteger(attempt) || attempt < 1) {
      return "attemptNumber deve ser um número inteiro maior que zero";
    }
    if (typeof days !== "number" || !Number.isInteger(days) || days < 0) {
      return "inactivityDays deve ser um número inteiro não negativo";
    }
    const rules = await listAutomationRules();
    const duplicate = rules.some((rule) =>
      rule.id !== currentRuleId &&
      rule.isActive &&
      rule.trigger === "inactivity_reengagement" &&
      (rule.triggerParams as Record<string, unknown> | null)?.attemptNumber === attempt,
    );
    if (duplicate) return "Já existe uma regra ativa para esta tentativa";
  }
  return null;
}

automationRulesRouter.get("/", async (_req, res) => {
  try {
    const rules = await listAutomationRules();
    res.json(rules);
  } catch (error) {
    console.error("Erro ao buscar regras de automação:", error);
    res.status(500).json({ message: "Erro ao buscar regras de automação" });
  }
});

automationRulesRouter.patch(
  "/reorder",
  validateBody(z.object({ orderedIds: z.array(z.string()).min(1) })),
  async (req, res) => {
    try {
      await reorderAutomationRules(req.body.orderedIds);
      res.status(204).send();
    } catch (error) {
      console.error("Erro ao reordenar regras de automação:", error);
      res.status(500).json({ message: "Erro ao reordenar regras de automação" });
    }
  },
);

automationRulesRouter.post(
  "/",
  validateBody(automationRuleRequestSchema),
  async (req, res) => {
    try {
      const validationError = await validateRuleConfiguration(req.body);
      if (validationError) return res.status(400).json({ message: validationError });
      const created = await createAutomationRule({
        ...req.body,
        createdBy: req.user!.userId,
      });
      res.status(201).json(created);
    } catch (error) {
      console.error("Erro ao criar regra de automação:", error);
      res.status(500).json({ message: "Erro ao criar regra de automação" });
    }
  },
);

automationRulesRouter.put(
  "/:id",
  validateBody(automationRuleRequestSchema.partial()),
  async (req, res) => {
    try {
      const current = await getAutomationRuleById(req.params.id);
      if (!current) return res.status(404).json({ message: "Regra não encontrada" });
      const validationError = await validateRuleConfiguration(
        { ...current, ...req.body },
        req.params.id,
      );
      if (validationError) return res.status(400).json({ message: validationError });
      const updated = await updateAutomationRule(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Erro ao atualizar regra de automação:", error);
      res.status(500).json({ message: "Erro ao atualizar regra de automação" });
    }
  },
);

automationRulesRouter.patch(
  "/:id/toggle",
  validateBody(z.object({ isActive: z.boolean() })),
  async (req, res) => {
    try {
      const updated = await toggleAutomationRuleActive(
        req.params.id,
        req.body.isActive,
      );
      res.json(updated);
    } catch (error) {
      console.error("Erro ao alternar status da regra de automação:", error);
      res
        .status(500)
        .json({ message: "Erro ao alternar status da regra de automação" });
    }
  },
);

automationRulesRouter.delete("/:id", async (req, res) => {
  try {
    await deleteAutomationRule(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao excluir regra de automação:", error);
    res.status(500).json({ message: "Erro ao excluir regra de automação" });
  }
});

export default automationRulesRouter;
