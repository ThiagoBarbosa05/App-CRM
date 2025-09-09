import { desc, eq } from "drizzle-orm";
import { db } from "server/db";
import { cashbackSettings } from "../models/cashback-settings";

/**
 * Fetches all active cashback settings from the database, ordered by creation date.
 * This function prioritizes performance by selecting only active settings and ordering them
 * at the database level.
 *
 * @returns {Promise<Array<typeof cashbackSettings.$inferSelect>>} A promise that resolves to an array of cashback settings.
 */
export async function getAllCashbackSettings(): Promise<
  (typeof cashbackSettings.$inferSelect)[]
> {
  try {
    const settings = await db
      .select()
      .from(cashbackSettings)
      .where(eq(cashbackSettings.isActive, "true"))
      .orderBy(desc(cashbackSettings.createdAt));

    return settings;
  } catch (error) {
    console.error("Error fetching cashback settings:", error);
    // In a real-world application, you might want to use a more sophisticated logger
    throw new Error(
      "Could not fetch cashback settings due to a database error."
    );
  }
}
