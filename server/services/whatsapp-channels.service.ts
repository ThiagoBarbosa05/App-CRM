import { db } from "../db";
import { whatsappChannels, whatsappConversations, whatsappMessages } from "../../shared/schema";
import { and, eq } from "drizzle-orm";
import type { InsertWhatsappChannel } from "../../shared/schema";
import type { ChannelOverride } from "../integrations/whatsapp";

/** Canal resolvido para envio — discrimina pelo provider */
export type ResolvedChannel =
  | { id: number; provider: "cloud_api"; phoneNumberId: string; accessToken: string }
  | { id: number; provider: "evolution"; evolutionInstanceName: string };

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
      provider: whatsappChannels.provider,
      evolutionInstanceName: whatsappChannels.evolutionInstanceName,
      connectionStatus: whatsappChannels.connectionStatus,
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

  if (!row || !row.phoneNumberId || !row.accessToken) return null;
  return { phoneNumberId: row.phoneNumberId, accessToken: row.accessToken };
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
  await db.transaction(async (tx) => {
    // Desvincula mensagens e conversas para preservá-las (channelId é metadado nullable)
    await tx
      .update(whatsappMessages)
      .set({ channelId: null })
      .where(eq(whatsappMessages.channelId, id));
    await tx
      .update(whatsappConversations)
      .set({ channelId: null })
      .where(eq(whatsappConversations.channelId, id));
    await tx.delete(whatsappChannels).where(eq(whatsappChannels.id, id));
  });
}

export async function getChannelByUserId(userId: string): Promise<ChannelOverride | null> {
  const [row] = await db
    .select({ phoneNumberId: whatsappChannels.phoneNumberId, accessToken: whatsappChannels.accessToken })
    .from(whatsappChannels)
    .where(and(eq(whatsappChannels.userId, userId), eq(whatsappChannels.isActive, true)))
    .limit(1);
  if (!row || !row.phoneNumberId || !row.accessToken) return null;
  return { phoneNumberId: row.phoneNumberId, accessToken: row.accessToken };
}

export async function listChannelsByUserId(userId: string): Promise<{ id: number; name: string; displayPhone: string | null; connectionStatus: string | null; provider: string }[]> {
  return db
    .select({ id: whatsappChannels.id, name: whatsappChannels.name, displayPhone: whatsappChannels.displayPhone, connectionStatus: whatsappChannels.connectionStatus, provider: whatsappChannels.provider })
    .from(whatsappChannels)
    .where(and(eq(whatsappChannels.userId, userId), eq(whatsappChannels.isActive, true)))
    .orderBy(whatsappChannels.createdAt);
}

export async function listActiveChannels(): Promise<{ id: number; name: string; displayPhone: string | null; connectionStatus: string | null; provider: string }[]> {
  return db
    .select({ id: whatsappChannels.id, name: whatsappChannels.name, displayPhone: whatsappChannels.displayPhone, connectionStatus: whatsappChannels.connectionStatus, provider: whatsappChannels.provider })
    .from(whatsappChannels)
    .where(eq(whatsappChannels.isActive, true))
    .orderBy(whatsappChannels.createdAt);
}

export async function getChannelByEvolutionInstance(instanceName: string) {
  const [channel] = await db
    .select()
    .from(whatsappChannels)
    .where(eq(whatsappChannels.evolutionInstanceName, instanceName))
    .limit(1);
  return channel ?? null;
}

function toResolvedChannel(ch: { id: number; provider: string; phoneNumberId: string | null; accessToken: string | null; evolutionInstanceName: string | null }): ResolvedChannel | null {
  if (ch.provider === "evolution" && ch.evolutionInstanceName) {
    return { id: ch.id, provider: "evolution", evolutionInstanceName: ch.evolutionInstanceName };
  }
  if (ch.phoneNumberId && ch.accessToken) {
    return { id: ch.id, provider: "cloud_api", phoneNumberId: ch.phoneNumberId, accessToken: ch.accessToken };
  }
  return null;
}

export async function resolveChannelById(id: number): Promise<ResolvedChannel | null> {
  const ch = await getChannelById(id);
  if (!ch) return null;
  return toResolvedChannel(ch);
}

export async function resolveChannelByUserId(userId: string): Promise<ResolvedChannel | null> {
  const [row] = await db
    .select({
      id: whatsappChannels.id,
      provider: whatsappChannels.provider,
      phoneNumberId: whatsappChannels.phoneNumberId,
      accessToken: whatsappChannels.accessToken,
      evolutionInstanceName: whatsappChannels.evolutionInstanceName,
    })
    .from(whatsappChannels)
    .where(and(eq(whatsappChannels.userId, userId), eq(whatsappChannels.isActive, true)))
    .limit(1);
  if (!row) return null;
  return toResolvedChannel(row);
}

export async function resolveChannelForConversation(conversationId: string): Promise<ResolvedChannel | null> {
  const [row] = await db
    .select({
      id: whatsappChannels.id,
      provider: whatsappChannels.provider,
      phoneNumberId: whatsappChannels.phoneNumberId,
      accessToken: whatsappChannels.accessToken,
      evolutionInstanceName: whatsappChannels.evolutionInstanceName,
    })
    .from(whatsappConversations)
    .innerJoin(whatsappChannels, eq(whatsappConversations.channelId, whatsappChannels.id))
    .where(eq(whatsappConversations.id, conversationId))
    .limit(1);
  if (!row) return null;
  return toResolvedChannel(row);
}

export async function updateConnectionStatus(channelId: number, status: string): Promise<void> {
  await db
    .update(whatsappChannels)
    .set({ connectionStatus: status })
    .where(eq(whatsappChannels.id, channelId));
}
