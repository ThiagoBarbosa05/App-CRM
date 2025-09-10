
import { eq } from "drizzle-orm";
import { z } from "zod";
import { cashbackSettings } from "../models/cashback-settings";
import { db } from "server/db";

export const DeleteCashbackSettingsInput = z.object({
  id: z.string(),
});

export type DeleteCashbackSettingsInput = z.infer<
  typeof DeleteCashbackSettingsInput
>;

export type DeleteCashbackSettingsOutput = typeof cashbackSettings.$inferSelect;

export const deleteCashbackSettings = async (
  input: DeleteCashbackSettingsInput
): Promise<DeleteCashbackSettingsOutput | null> => {
  const { id } = input;

  const [deletedSetting] = await db
    .delete(cashbackSettings)
    .where(eq(cashbackSettings.id, id))
    .returning();

  return deletedSetting || null;
};
