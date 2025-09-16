import { eq } from "drizzle-orm";
import { z } from "zod";
import { messageJobsLogs } from "../../../shared/schema";
import { db } from "server/db";

export const DeleteMessageJobsLogInput = z.object({
  id: z.string(),
});

export type DeleteMessageJobsLogInput = z.infer<
  typeof DeleteMessageJobsLogInput
>;

export type DeleteMessageJobsLogOutput = typeof messageJobsLogs.$inferSelect;

export const deleteMessageJobsLog = async (
  input: DeleteMessageJobsLogInput
): Promise<DeleteMessageJobsLogOutput | null> => {
  const { id } = input;

  const [deletedLog] = await db
    .delete(messageJobsLogs)
    .where(eq(messageJobsLogs.id, id))
    .returning();

  return deletedLog || null;
};