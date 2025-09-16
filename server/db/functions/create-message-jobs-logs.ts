import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { messageJobsLogs } from "../../../shared/schema";
import { db } from "server/db";

export const insertMessageJobsLogSchema = createInsertSchema(messageJobsLogs);

export const selectMessageJobsLogSchema = createSelectSchema(messageJobsLogs);

export type InsertMessageJobsLog = z.infer<typeof insertMessageJobsLogSchema>;
export type SelectMessageJobsLog = z.infer<typeof selectMessageJobsLogSchema>;

export async function createMessageJobsLog(
  data: InsertMessageJobsLog
): Promise<SelectMessageJobsLog> {
  const [newLog] = await db
    .insert(messageJobsLogs)
    .values(data)
    .returning();

  return newLog;
}