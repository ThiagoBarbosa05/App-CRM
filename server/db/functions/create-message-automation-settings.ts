import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { messageAutomationSettings } from "../../../shared/schema";
import { db } from "server/db";

export const insertMessageAutomationSettingSchema = createInsertSchema(
  messageAutomationSettings,
  {
    sendTime: z
      .string()
      .regex(
        /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
        "Formato de hora inválido (HH:mm)"
      ),
    daysBefore: z
      .number()
      .int()
      .min(0, "Os dias anteriores devem ser um número não negativo"),
    type: z.enum(["template", "bot"]).default("template"),
    externalTemplateId: z.string().optional(),
    externalFileId: z.string().optional(),
    externalFileUrl: z
      .string()
      .optional()
      .nullable()
      .transform((val) => {
        if (!val || val === "") return null;
        return val;
      })
      .refine((val) => {
        if (val === null) return true;
        try {
          new URL(val);
          return true;
        } catch {
          return false;
        }
      }, "URL inválida"),
  }
).refine(
  (data) => {
    // Validação condicional: externalTemplateId é obrigatório quando type é "template" ou "bot"
    if (
      (data.type === "template" || data.type === "bot") &&
      !data.externalTemplateId
    ) {
      return false;
    }
    return true;
  },
  {
    message: "Template ID ou Bot ID é obrigatório",
    path: ["externalTemplateId"],
  }
);

export const selectMessageAutomationSettingSchema = createSelectSchema(
  messageAutomationSettings
);

export type InsertMessageAutomationSetting = z.infer<
  typeof insertMessageAutomationSettingSchema
>;
export type SelectMessageAutomationSetting = z.infer<
  typeof selectMessageAutomationSettingSchema
>;

export async function createMessageAutomationSetting(
  data: InsertMessageAutomationSetting
): Promise<SelectMessageAutomationSetting> {
  const [newSetting] = await db
    .insert(messageAutomationSettings)
    .values(data)
    .returning();

  return newSetting;
}
