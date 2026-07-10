import { Router } from "express";
import { z } from "zod";
import { insertAutomationRuleSchema } from "@shared/schema";
import { validateBody } from "../middleware/validation";
import {
  createAutomationRule,
  deleteAutomationRule,
  listAutomationRules,
  toggleAutomationRuleActive,
  updateAutomationRule,
} from "../services/automation-rules.service";

export const automationRulesRouter = Router();

automationRulesRouter.get("/", async (_req, res) => {
  try {
    const rules = await listAutomationRules();
    res.json(rules);
  } catch (error) {
    console.error("Erro ao buscar regras de automação:", error);
    res.status(500).json({ message: "Erro ao buscar regras de automação" });
  }
});

automationRulesRouter.post(
  "/",
  validateBody(insertAutomationRuleSchema),
  async (req, res) => {
    try {
      const created = await createAutomationRule(req.body);
      res.status(201).json(created);
    } catch (error) {
      console.error("Erro ao criar regra de automação:", error);
      res.status(500).json({ message: "Erro ao criar regra de automação" });
    }
  },
);

automationRulesRouter.put(
  "/:id",
  validateBody(insertAutomationRuleSchema.partial()),
  async (req, res) => {
    try {
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
