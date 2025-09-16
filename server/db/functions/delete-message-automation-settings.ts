import { eq } from "drizzle-orm";
import { z } from "zod";
import { messageAutomationSettings } from "../../../shared/schema";
import { db } from "server/db";

export const DeleteMessageAutomationSettingsInput = z.object({
  id: z.string(),
});

export type DeleteMessageAutomationSettingsInput = z.infer<
  typeof DeleteMessageAutomationSettingsInput
>;

export type DeleteMessageAutomationSettingsOutput = typeof messageAutomationSettings.$inferSelect;

export const deleteMessageAutomationSettings = async (
  input: DeleteMessageAutomationSettingsInput
): Promise<DeleteMessageAutomationSettingsOutput | null> => {
  const { id } = input;

  const [deletedSetting] = await db
    .delete(messageAutomationSettings)
    .where(eq(messageAutomationSettings.id, id))
    .returning();

  return deletedSetting || null;
};