import { eq } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { messageAutomationSettings } from "../../../shared/schema";
import { db } from "server/db";

export const updateMessageAutomationSettingSchema = createInsertSchema(
  messageAutomationSettings,
  {
    sendTime: z
      .string()
      .regex(
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        "Formato de hora inválido (HH:mm)"
      )
      .optional(),
    daysBefore: z
      .number()
      .int()
      .min(0, "Os dias anteriores devem ser um número não negativo")
      .optional(),
    externalTemplateId: z.string().optional(),
  }
)
  .partial()
  .extend({
    id: z.string({ required_error: "ID is required to update a setting." }),
  });

export type UpdateMessageAutomationSettingInput = z.infer<
  typeof updateMessageAutomationSettingSchema
>;

export type MessageAutomationSettings =
  typeof messageAutomationSettings.$inferSelect;

export async function updateMessageAutomationSetting(
  input: UpdateMessageAutomationSettingInput
): Promise<MessageAutomationSettings> {
  const validatedInput = updateMessageAutomationSettingSchema.parse(input);
  const { id, ...updateData } = validatedInput;

  if (Object.keys(updateData).length === 0) {
    throw new Error("No fields to update were provided.");
  }

  const [updatedSetting] = await db
    .update(messageAutomationSettings)
    .set({
      ...updateData,
      updatedAt: new Date(),
    })
    .where(eq(messageAutomationSettings.id, id))
    .returning();

  if (!updatedSetting) {
    throw new Error(`Message automation setting with ID '${id}' not found.`);
  }

  return updatedSetting;
}
