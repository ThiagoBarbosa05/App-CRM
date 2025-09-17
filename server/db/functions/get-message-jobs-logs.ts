import { desc, eq, and, count } from "drizzle-orm";
import { db } from "server/db";
import { messageJobsLogs } from "../../../shared/schema";
import { z } from "zod";

export const GetMessageJobsLogsInput = z.object({
  clientId: z.string().optional(),
  automationId: z.string().optional(),
  status: z.enum(["agendado", "enviado", "falhou"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});

export type GetMessageJobsLogsInput = z.infer<typeof GetMessageJobsLogsInput>;

export async function getMessageJobsLogs(input: GetMessageJobsLogsInput): Promise<
  {
    data: (typeof messageJobsLogs.$inferSelect)[];
    total: number;
    page: number;
    pageSize: number;
  }
> {
  try {
    const {
      clientId,
      automationId,
      status,
      page = 1,
      pageSize = 20,
    } = input;

    // Build where conditions
    const where: any[] = [];
  if (clientId) where.push(eq(messageJobsLogs.clientId, clientId));
  if (automationId) where.push(eq(messageJobsLogs.automationId, automationId));
  if (status) where.push(eq(messageJobsLogs.status, status));

    // Get total count
    const totalRows = await db
      .select({ count: count() })
      .from(messageJobsLogs)
      .where(where.length ? and(...where) : undefined);
    const total = Number(totalRows[0]?.count ?? 0);

    // Get paginated data
    const data = await db
      .select()
      .from(messageJobsLogs)
      .where(where.length ? and(...where) : undefined)
      .orderBy(desc(messageJobsLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { data, total, page, pageSize };
  } catch (error) {
    console.error("Error fetching message jobs logs:", error);
    throw new Error(
      "Could not fetch message jobs logs due to a database error."
    );
  }
}