import { desc } from "drizzle-orm";
import { db } from "server/db";
import { messageAutomationSettings } from "../../../shared/schema";

export async function getAllMessageAutomationSettings(): Promise<
  (typeof messageAutomationSettings.$inferSelect)[]
> {
  try {
    const settings = await db
      .select()
      .from(messageAutomationSettings)
      .orderBy(desc(messageAutomationSettings.createdAt));

    return settings;
  } catch (error) {
    console.error("Error fetching message automation settings:", error);
    throw new Error(
      "Could not fetch message automation settings due to a database error."
    );
  }
}