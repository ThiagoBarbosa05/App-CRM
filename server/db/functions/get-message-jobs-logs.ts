import { desc, eq } from "drizzle-orm";
import { db } from "server/db";
import { messageJobsLogs } from "../../../shared/schema";
import { z } from "zod";

export const GetMessageJobsLogsInput = z.object({
  clientId: z.string().optional(),
  status: z.string().optional(),
});

export type GetMessageJobsLogsInput = z.infer<typeof GetMessageJobsLogsInput>;

export async function getMessageJobsLogs(input: GetMessageJobsLogsInput): Promise<
  (typeof messageJobsLogs.$inferSelect)[]
> {
  try {
    const query = db
      .select()
      .from(messageJobsLogs)
      .orderBy(desc(messageJobsLogs.created_at));

    if (input.clientId) {
        query.where(eq(messageJobsLogs.clientId, input.clientId));
    }
    if (input.status) {
        query.where(eq(messageJobsLogs.status, input.status));
    }


    const logs = await query;
    return logs;
  } catch (error) {
    console.error("Error fetching message jobs logs:", error);
    throw new Error(
      "Could not fetch message jobs logs due to a database error."
    );
  }
}