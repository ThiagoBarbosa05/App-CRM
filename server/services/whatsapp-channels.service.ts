import { db } from "../db";
import { whatsappChannels, whatsappConversations, users } from "../../shared/schema";
import { and, eq, isNull } from "drizzle-orm";
import type { InsertWhatsappChannel } from "../../shared/schema";
import type { ChannelOverride } from "../integrations/whatsapp";
import { decryptToken, encryptToken } from "../lib/token-crypto";

/** Canal resolvido para envio — discrimina pelo provider */
export type ResolvedChannel =
  | { id: number; provider: "cloud_api"; phoneNumberId: string; accessToken: string }
  | { id: number; provider: "evolution"; evolutionInstanceName: string };

/**
 * Payload de criação/atualização de canal usado pelas rotas — usa `accessToken` em
 * texto plano (nunca persistido diretamente); o service cuida de criptografar antes
 * de gravar em `whatsapp_channels.access_token_encrypted`.
 */
type ChannelWriteInput = Omit<InsertWhatsappChannel, "id" | "createdAt" | "accessTokenEncrypted"> & {
  accessToken?: string | null;
};

function toDbPatch(data: Partial<ChannelWriteInput>) {
  const { accessToken, ...rest } = data;
  const patch: Partial<InsertWhatsappChannel> = { ...rest };
  if (accessToken !== undefined) {
    patch.accessTokenEncrypted = accessToken ? encryptToken(accessToken) : null;
  }
  return patch;
}

/** Decifra `accessTokenEncrypted` de uma linha de `whatsapp_channels`, expondo `accessToken` em texto plano. */
function decryptChannelRow<T extends { accessTokenEncrypted?: string | null }>(
  row: T,
): Omit<T, "accessTokenEncrypted"> & { accessToken: string | null } {
  const { accessTokenEncrypted, ...rest } = row;
  return {
    ...rest,
    accessToken: accessTokenEncrypted ? decryptToken(accessTokenEncrypted) : null,
  };
}

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
    .where(isNull(whatsappChannels.deletedAt))
    .orderBy(whatsappChannels.createdAt);
}

export async function getChannelById(id: number) {
  const [channel] = await db
    .select()
    .from(whatsappChannels)
    .where(and(eq(whatsappChannels.id, id), isNull(whatsappChannels.deletedAt)))
    .limit(1);
  return channel ? decryptChannelRow(channel) : null;
}

export async function getChannelByPhoneNumberId(phoneNumberId: string) {
  const [channel] = await db
    .select()
    .from(whatsappChannels)
    .where(eq(whatsappChannels.phoneNumberId, phoneNumberId))
    .limit(1);
  return channel ? decryptChannelRow(channel) : null;
}

export async function getChannelForConversation(conversationId: string): Promise<ChannelOverride | null> {
  const [row] = await db
    .select({
      phoneNumberId: whatsappChannels.phoneNumberId,
      accessTokenEncrypted: whatsappChannels.accessTokenEncrypted,
    })
    .from(whatsappConversations)
    .innerJoin(whatsappChannels, eq(whatsappConversations.channelId, whatsappChannels.id))
    .where(and(eq(whatsappConversations.id, conversationId), isNull(whatsappChannels.deletedAt)))
    .limit(1);

  if (!row || !row.phoneNumberId || !row.accessTokenEncrypted) return null;
  return { phoneNumberId: row.phoneNumberId, accessToken: decryptToken(row.accessTokenEncrypted) };
}

export async function createChannel(data: ChannelWriteInput) {
  const [created] = await db
    .insert(whatsappChannels)
    .values(toDbPatch(data) as InsertWhatsappChannel)
    .returning();
  return decryptChannelRow(created);
}

export async function updateChannel(id: number, data: Partial<ChannelWriteInput>) {
  const [updated] = await db
    .update(whatsappChannels)
    .set(toDbPatch(data))
    .where(eq(whatsappChannels.id, id))
    .returning();
  return updated ? decryptChannelRow(updated) : null;
}

/**
 * Soft delete: mantém a linha (e o channelId em mensagens/conversas antigas,
 * preservando o histórico) e apenas marca deletedAt + isActive=false. Libera
 * phoneNumberId/evolutionInstanceName (colunas unique) para reimportação do
 * mesmo número em um novo canal.
 */
export async function deleteChannel(id: number) {
  await db
    .update(whatsappChannels)
    .set({
      deletedAt: new Date(),
      isActive: false,
      phoneNumberId: null,
      evolutionInstanceName: null,
    })
    .where(eq(whatsappChannels.id, id));
}

export async function getChannelByUserId(userId: string): Promise<ChannelOverride | null> {
  const [row] = await db
    .select({ phoneNumberId: whatsappChannels.phoneNumberId, accessTokenEncrypted: whatsappChannels.accessTokenEncrypted })
    .from(whatsappChannels)
    .where(and(eq(whatsappChannels.userId, userId), eq(whatsappChannels.isActive, true)))
    .limit(1);
  if (!row || !row.phoneNumberId || !row.accessTokenEncrypted) return null;
  return { phoneNumberId: row.phoneNumberId, accessToken: decryptToken(row.accessTokenEncrypted) };
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

/**
 * Conjunto com os números (somente dígitos, com DDI) de todos os canais da
 * empresa. Usado para ignorar mensagens recebidas vindas de um número próprio
 * (ex.: o bot dispara pelo número Cloud API e a mensagem é espelhada de volta por
 * um canal Evolution conectado), que não devem virar conversas de contato.
 */
export async function getOwnChannelPhones(): Promise<Set<string>> {
  const rows = await db
    .select({ displayPhone: whatsappChannels.displayPhone })
    .from(whatsappChannels);
  const phones = new Set<string>();
  for (const r of rows) {
    const digits = r.displayPhone?.replace(/\D/g, "");
    if (digits) phones.add(digits);
  }
  return phones;
}

/**
 * Retorna o id do canal ativo de um usuário (atendente), para qualquer provider.
 * Usado na transferência para vincular a conversa ao canal do atendente.
 */
export async function getActiveChannelIdByUserId(userId: string): Promise<number | null> {
  const [row] = await db
    .select({ id: whatsappChannels.id })
    .from(whatsappChannels)
    .where(and(eq(whatsappChannels.userId, userId), eq(whatsappChannels.isActive, true)))
    .limit(1);
  return row?.id ?? null;
}

export async function getChannelByEvolutionInstance(instanceName: string) {
  const [channel] = await db
    .select()
    .from(whatsappChannels)
    .where(eq(whatsappChannels.evolutionInstanceName, instanceName))
    .limit(1);
  return channel ? decryptChannelRow(channel) : null;
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
      accessTokenEncrypted: whatsappChannels.accessTokenEncrypted,
      evolutionInstanceName: whatsappChannels.evolutionInstanceName,
    })
    .from(whatsappChannels)
    .where(and(eq(whatsappChannels.userId, userId), eq(whatsappChannels.isActive, true)))
    .limit(1);
  if (!row) return null;
  return toResolvedChannel(decryptChannelRow(row));
}

export async function resolveChannelForConversation(conversationId: string): Promise<ResolvedChannel | null> {
  const [row] = await db
    .select({
      id: whatsappChannels.id,
      provider: whatsappChannels.provider,
      phoneNumberId: whatsappChannels.phoneNumberId,
      accessTokenEncrypted: whatsappChannels.accessTokenEncrypted,
      evolutionInstanceName: whatsappChannels.evolutionInstanceName,
    })
    .from(whatsappConversations)
    .innerJoin(whatsappChannels, eq(whatsappConversations.channelId, whatsappChannels.id))
    .where(and(eq(whatsappConversations.id, conversationId), isNull(whatsappChannels.deletedAt)))
    .limit(1);
  if (!row) return null;
  return toResolvedChannel(decryptChannelRow(row));
}

export async function updateConnectionStatus(channelId: number, status: string): Promise<void> {
  await db
    .update(whatsappChannels)
    .set({ connectionStatus: status })
    .where(eq(whatsappChannels.id, channelId));
}

/**
 * Todos os usuários do sistema com o canal ativo de cada um (se houver).
 * Usado pela picker "Atendente" da transferência de conversas — permite
 * transferir diretamente para qualquer atendente, independente de setor.
 */
export async function listAttendantsWithChannel(): Promise<
  {
    userId: string;
    name: string;
    role: string;
    channelId: number | null;
    channelName: string | null;
    channelDisplayPhone: string | null;
    channelConnectionStatus: string | null;
    channelProvider: string | null;
  }[]
> {
  return db
    .select({
      userId: users.id,
      name: users.name,
      role: users.role,
      channelId: whatsappChannels.id,
      channelName: whatsappChannels.name,
      channelDisplayPhone: whatsappChannels.displayPhone,
      channelConnectionStatus: whatsappChannels.connectionStatus,
      channelProvider: whatsappChannels.provider,
    })
    .from(users)
    .leftJoin(
      whatsappChannels,
      and(eq(whatsappChannels.userId, users.id), eq(whatsappChannels.isActive, true)),
    )
    .orderBy(users.name);
}
