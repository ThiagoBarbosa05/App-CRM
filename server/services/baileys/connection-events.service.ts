import { desc, eq, sql } from "drizzle-orm";
import { db } from "../../db";
import { whatsappChannelConnectionEvents } from "@shared/schema";

export async function logChannelConnectionEvent(
  channelId: number,
  eventType: "connected" | "disconnected" | "connecting" | "qr",
  reasonCode?: string,
  reasonLabel?: string,
): Promise<void> {
  await db.insert(whatsappChannelConnectionEvents).values({
    channelId,
    eventType,
    reasonCode,
    reasonLabel,
  });
}

export async function listChannelConnectionEvents(
  channelId: number,
  limit: number,
  offset: number,
) {
  const whereClause = eq(whatsappChannelConnectionEvents.channelId, channelId);

  const [events, totalResult] = await Promise.all([
    db
      .select()
      .from(whatsappChannelConnectionEvents)
      .where(whereClause)
      .orderBy(desc(whatsappChannelConnectionEvents.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(whatsappChannelConnectionEvents)
      .where(whereClause),
  ]);

  return { events, total: totalResult[0]?.count ?? 0 };
}
