import { Router } from "express";

export const messageAutomationSettingsRouter = Router();

messageAutomationSettingsRouter.post("/", async (req, res) => {
  const { createMessageAutomationSettingsController } = await import(
    "../controllers/create-message-automation-settings.controller"
  );
  return createMessageAutomationSettingsController(req, res);
});

messageAutomationSettingsRouter.get("/", async (req, res) => {
  const { getMessageAutomationSettingsController } = await import(
    "../controllers/get-message-automation-settings.controller"
  );
  return getMessageAutomationSettingsController(req, res);
});

messageAutomationSettingsRouter.put("/:id", async (req, res) => {
  const { updateMessageAutomationSettingsController } = await import(
    "../controllers/update-message-automation-settings.controller"
  );
  return updateMessageAutomationSettingsController(req, res);
});

messageAutomationSettingsRouter.delete("/:id", async (req, res) => {
  const { deleteMessageAutomationSettingsController } = await import(
    "../controllers/delete-message-automation-settings.controller"
  );
  return deleteMessageAutomationSettingsController(req, res);
});

export default messageAutomationSettingsRouter;
