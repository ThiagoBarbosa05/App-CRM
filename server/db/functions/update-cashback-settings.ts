
import { eq } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { cashbackSettings } from "../models/cashback-settings";
import { db } from "server/db";

/**
 * Schema for validating the input when updating cashback settings.
 * The 'id' is required to identify the setting, while all other fields are optional.
 */
export const updateCashbackSettingsSchema = createInsertSchema(cashbackSettings, {
  percentageRate: z.string().optional(),
  minimumPurchase: z.string().optional(),
  maximumCashback: z.string().optional().nullable(),
}).partial().extend({
  id: z.string({ required_error: "ID is required to update a setting." }),
});

/**
 * The type definition for the input data used to update a cashback setting.
 * Inferred from the Zod schema to ensure type safety.
 */
export type UpdateCashbackSettingsInput = z.infer<typeof updateCashbackSettingsSchema>;

/**
 * The type definition for the output data (the updated cashback setting).
 * This is inferred directly from the Drizzle table schema.
 */
export type CashbackSettings = typeof cashbackSettings.$inferSelect;

/**
 * Updates an existing cashback setting in the database.
 *
 * This function takes a partial set of cashback setting data, including the ID of the
 * setting to be updated. It validates the input, applies the changes, updates the
 * 'updatedAt' timestamp, and returns the full, updated setting object.
 *
 * @param {UpdateCashbackSettingsInput} input - The data for the cashback setting to update. Must include the 'id'.
 * @returns {Promise<CashbackSettings>} A promise that resolves to the updated cashback setting object.
 * @throws {Error} Throws an error if the input is invalid, no fields are provided for updating, or the setting is not found.
 */
export async function updateCashbackSettings(
  input: UpdateCashbackSettingsInput
): Promise<CashbackSettings> {
  // Validate the input against the schema
  const validatedInput = updateCashbackSettingsSchema.parse(input);
  const { id, ...updateData } = validatedInput;

  // Ensure there's at least one field to update besides the id.
  if (Object.keys(updateData).length === 0) {
    throw new Error("No fields to update were provided.");
  }

  const [updatedSetting] = await db
    .update(cashbackSettings)
    .set({
      ...updateData,
      updatedAt: new Date(), // Automatically update the timestamp
    })
    .where(eq(cashbackSettings.id, id))
    .returning();

  // If the database returns nothing, the setting was not found.
  if (!updatedSetting) {
    throw new Error(`Cashback setting with ID '${id}' not found.`);
  }

  return updatedSetting;
}