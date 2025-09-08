
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { cashbackSettings } from "../models/cashback-settings";
import { db } from "server/db";

export const insertCashbackSettingSchema = createInsertSchema(cashbackSettings, {
  name: z.string().min(3, "O nome deve ter pelo menos 3 caracteres"),
  percentageRate: z.string().refine(val => !isNaN(parseFloat(val)), { message: "Taxa de porcentagem inválida" }),
  expirationDays: z.number().int().positive("Os dias de expiração devem ser um número positivo"),
});

export const selectCashbackSettingSchema = createSelectSchema(cashbackSettings);

export type InsertCashbackSetting = z.infer<typeof insertCashbackSettingSchema>;
export type SelectCashbackSetting = z.infer<typeof selectCashbackSettingSchema>;

/**
 * Cria uma nova configuração de cashback no banco de dados.
 * @param data - Os dados para a nova configuração de cashback.
 * @returns A configuração de cashback criada.
 */
export async function createCashbackSetting(
  data: InsertCashbackSetting
): Promise<SelectCashbackSetting> {
  const [newSetting] = await db
    .insert(cashbackSettings)
    .values({
      ...data,
      percentageRate: String(data.percentageRate), // Garante que o valor seja uma string
    })
    .returning();

  return newSetting;
}
