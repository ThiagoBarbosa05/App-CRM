import { db } from "../db";
import { whatsappChannels, whatsappConversations } from "../../shared/schema";
import { and, eq } from "drizzle-orm";
import type { InsertWhatsappChannel } from "../../shared/schema";
import type { ChannelOverride } from "../integrations/whatsapp";

export async function listChannels() {
  return db
    .select({
      id: whatsappChannels.id,
      name: whatsappChannels.name,
      phoneNumberId: whatsappChannels.phoneNumberId,
      wabaId: whatsappChannels.wabaId,
      displayPhone: whatsappChannels.displayPhone,
      userId: whatsappChannels.userId,
      isActive: whatsappChannels.isActive,
      createdAt: whatsappChannels.createdAt,
    })
    .from(whatsappChannels)
    .orderBy(whatsappChannels.createdAt);
}

export async function getChannelById(id: number) {
  const [channel] = await db
    .select()
    .from(whatsappChannels)
    .where(eq(whatsappChannels.id, id))
    .limit(1);
  return channel ?? null;
}

export async function getChannelByPhoneNumberId(phoneNumberId: string) {
  const [channel] = await db
    .select()
    .from(whatsappChannels)
    .where(eq(whatsappChannels.phoneNumberId, phoneNumberId))
    .limit(1);
  return channel ?? null;
}

export async function getChannelForConversation(conversationId: string): Promise<ChannelOverride | null> {
  const [row] = await db
    .select({
      phoneNumberId: whatsappChannels.phoneNumberId,
      accessToken: whatsappChannels.accessToken,
    })
    .from(whatsappConversations)
    .innerJoin(whatsappChannels, eq(whatsappConversations.channelId, whatsappChannels.id))
    .where(eq(whatsappConversations.id, conversationId))
    .limit(1);

  return row ?? null;
}

export async function createChannel(data: Omit<InsertWhatsappChannel, "id" | "createdAt">) {
  const [created] = await db
    .insert(whatsappChannels)
    .values(data)
    .returning();
  return created;
}

export async function updateChannel(
  id: number,
  data: Partial<Omit<InsertWhatsappChannel, "id" | "createdAt">>,
) {
  const [updated] = await db
    .update(whatsappChannels)
    .set(data)
    .where(eq(whatsappChannels.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteChannel(id: number) {
  await db.delete(whatsappChannels).where(eq(whatsappChannels.id, id));
}

export async function getChannelByUserId(userId: string): Promise<ChannelOverride | null> {
  const [row] = await db
    .select({ phoneNumberId: whatsappChannels.phoneNumberId, accessToken: whatsappChannels.accessToken })
    .from(whatsappChannels)
    .where(and(eq(whatsappChannels.userId, userId), eq(whatsappChannels.isActive, true)))
    .limit(1);
  return row ?? null;
}

export async function listChannelsByUserId(userId: string): Promise<{ id: number; name: string; displayPhone: string | null }[]> {
  return db
    .select({ id: whatsappChannels.id, name: whatsappChannels.name, displayPhone: whatsappChannels.displayPhone })
    .from(whatsappChannels)
    .where(and(eq(whatsappChannels.userId, userId), eq(whatsappChannels.isActive, true)))
    .orderBy(whatsappChannels.createdAt);
}

export async function listActiveChannels(): Promise<{ id: number; name: string; displayPhone: string | null }[]> {
  return db
    .select({ id: whatsappChannels.id, name: whatsappChannels.name, displayPhone: whatsappChannels.displayPhone })
    .from(whatsappChannels)
    .where(eq(whatsappChannels.isActive, true))
    .orderBy(whatsappChannels.createdAt);
}
