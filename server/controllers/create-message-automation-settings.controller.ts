import { Request, Response } from "express";
import {
  createMessageAutomationSetting,
  insertMessageAutomationSettingSchema,
} from "../db/functions/create-message-automation-settings";
import { ZodError } from "zod";
import { reconfigureBirthdayScheduler } from "../jobs/reconfigure-scheduler";

export async function createMessageAutomationSettingsController(
  req: Request,
  res: Response
) {
  try {
    const validationResult = insertMessageAutomationSettingSchema.safeParse(
      req.body
    );

    if (!validationResult.success) {
      return res.status(400).json({ errors: validationResult.error.flatten() });
    }

    const validatedData = validationResult.data;
    const newSetting = await createMessageAutomationSetting(validatedData);

    // Reconfigurar schedulers após criação
    try {
      await reconfigureBirthdayScheduler();
      console.log(
        "[Create Controller] Schedulers reconfigurados após criação de nova configuração"
      );
    } catch (schedulerError) {
      console.error(
        "[Create Controller] Erro ao reconfigurar schedulers:",
        schedulerError
      );
      // Não falhar a resposta por erro no scheduler, apenas logar
    }

    return res.status(201).json(newSetting);
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({ errors: error.flatten() });
    }
    console.error("Error creating message automation setting:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
