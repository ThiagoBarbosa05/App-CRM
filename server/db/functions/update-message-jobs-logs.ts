import { eq } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { messageJobsLogs } from "../../../shared/schema";
import { db } from "server/db";

export const updateMessageJobsLogSchema = createInsertSchema(messageJobsLogs)
.partial().extend({
  id: z.string({ required_error: "ID is required to update a log." }),
});

export type UpdateMessageJobsLogInput = z.infer<typeof updateMessageJobsLogSchema>;

export type MessageJobsLogs = typeof messageJobsLogs.$inferSelect;

export async function updateMessageJobsLog(
  input: UpdateMessageJobsLogInput
): Promise<MessageJobsLogs> {
  const validatedInput = updateMessageJobsLogSchema.parse(input);
  const { id, ...updateData } = validatedInput;

  if (Object.keys(updateData).length === 0) {
    throw new Error("No fields to update were provided.");
  }

  const [updatedLog] = await db
    .update(messageJobsLogs)
    .set(updateData)
    .where(eq(messageJobsLogs.id, id))
    .returning();

  if (!updatedLog) {
    throw new Error(`Message jobs log with ID '${id}' not found.`);
  }

  return updatedLog;
}