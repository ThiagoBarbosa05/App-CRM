import { db } from "../db";
import { whatsappChannels, whatsappChannelMembers, whatsappChannelQrReaders, whatsappConversations, users } from "../../shared/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
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
      defaultSectorId: whatsappChannels.defaultSectorId,
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

/** Setor padrão configurado no canal — usado para rotear conversas novas ao serem criadas. */
export async function getDefaultSectorIdForChannel(channelId: number): Promise<string | null> {
  const [row] = await db
    .select({ defaultSectorId: whatsappChannels.defaultSectorId })
    .from(whatsappChannels)
    .where(eq(whatsappChannels.id, channelId))
    .limit(1);
  return row?.defaultSectorId ?? null;
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
 * mesmo número em um novo canal. Também remove as concessões explícitas de
 * whatsapp_channel_members — sem isso, membros que tinham acesso via
 * concessão (não dono) continuariam "no escopo" desse canal para sempre,
 * mesmo desativado, ao contrário do dono, que perde o acesso imediatamente
 * (listChannelIdsForUser/listChannelsByUserId filtram isActive=true).
 */
export async function deleteChannel(id: number) {
  await db.transaction(async (tx) => {
    await tx.delete(whatsappChannelMembers).where(eq(whatsappChannelMembers.channelId, id));
    await tx
      .update(whatsappChannels)
      .set({
        deletedAt: new Date(),
        isActive: false,
        phoneNumberId: null,
        evolutionInstanceName: null,
      })
      .where(eq(whatsappChannels.id, id));
  });
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
 * Canais ativos que um usuário pode acessar (dono OU membro via
 * whatsapp_channel_members) — usado por GET /channels/mine para um vendedor,
 * que hoje só via o canal do qual era dono.
 */
export async function listAccessibleChannelsForUser(
  userId: string,
): Promise<{ id: number; name: string; displayPhone: string | null; connectionStatus: string | null; provider: string }[]> {
  const ids = await listChannelIdsForUser(userId);
  if (ids.length === 0) return [];
  return db
    .select({ id: whatsappChannels.id, name: whatsappChannels.name, displayPhone: whatsappChannels.displayPhone, connectionStatus: whatsappChannels.connectionStatus, provider: whatsappChannels.provider })
    .from(whatsappChannels)
    .where(and(inArray(whatsappChannels.id, ids), eq(whatsappChannels.isActive, true)))
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

/**
 * Ids de todos os canais que um usuário pode acessar: os que ele é dono
 * (whatsapp_channels.user_id — um usuário pode ser dono de vários) somados aos
 * que recebeu acesso explícito via whatsapp_channel_members (canal
 * compartilhado, ex: número oficial da loja). Usado para escopar a
 * visibilidade de conversas de um vendedor (junto com listSectorIdsForUser).
 */
export async function listChannelIdsForUser(userId: string): Promise<number[]> {
  const [ownedRows, memberRows] = await Promise.all([
    db
      .select({ id: whatsappChannels.id })
      .from(whatsappChannels)
      .where(and(eq(whatsappChannels.userId, userId), eq(whatsappChannels.isActive, true))),
    db
      .select({ channelId: whatsappChannelMembers.channelId })
      .from(whatsappChannelMembers)
      .where(eq(whatsappChannelMembers.userId, userId)),
  ]);
  const ids = new Set<number>(ownedRows.map((r) => r.id));
  for (const r of memberRows) ids.add(r.channelId);
  return Array.from(ids);
}

/** Concessões explícitas (whatsapp_channel_members) de um canal — não inclui o dono. */
export async function listChannelMembers(channelId: number): Promise<{ userId: string }[]> {
  return db
    .select({ userId: whatsappChannelMembers.userId })
    .from(whatsappChannelMembers)
    .where(eq(whatsappChannelMembers.channelId, channelId));
}

/** Substitui a lista de canais com acesso concedido (não-dono) a um usuário pela lista informada. */
export async function setChannelsForUser(userId: string, channelIds: number[]) {
  await db.transaction(async (tx) => {
    await tx.delete(whatsappChannelMembers).where(eq(whatsappChannelMembers.userId, userId));
    if (channelIds.length > 0) {
      await tx
        .insert(whatsappChannelMembers)
        .values(channelIds.map((channelId) => ({ channelId, userId })))
        .onConflictDoNothing();
    }
  });
}

/** Ids de canais com acesso concedido (não-dono) a um usuário — o que a UI de escopo mostra/edita. */
export async function listGrantedChannelIdsForUser(userId: string): Promise<number[]> {
  const rows = await db
    .select({ channelId: whatsappChannelMembers.channelId })
    .from(whatsappChannelMembers)
    .where(eq(whatsappChannelMembers.userId, userId));
  return rows.map((r) => r.channelId);
}

/**
 * Canais com acesso concedido (whatsapp_channel_members) de todos os usuários
 * de uma vez, agrupados por userId — usado na listagem de atendentes para
 * exibir o escopo de acesso sem N+1 requests. Mesma fonte usada pela UI de
 * "Escopo de acesso" (não inclui canal do qual o usuário é dono).
 */
export async function listGrantedChannelsForAllUsers(): Promise<
  Record<string, { id: number; name: string; displayPhone: string | null }[]>
> {
  const rows = await db
    .select({
      userId: whatsappChannelMembers.userId,
      id: whatsappChannels.id,
      name: whatsappChannels.name,
      displayPhone: whatsappChannels.displayPhone,
    })
    .from(whatsappChannelMembers)
    .innerJoin(whatsappChannels, eq(whatsappChannelMembers.channelId, whatsappChannels.id))
    .where(eq(whatsappChannels.isActive, true))
    .orderBy(whatsappChannels.name);

  const map: Record<string, { id: number; name: string; displayPhone: string | null }[]> = {};
  for (const row of rows) {
    (map[row.userId] ??= []).push({ id: row.id, name: row.name, displayPhone: row.displayPhone });
  }
  return map;
}

/**
 * Permissão granular e independente de whatsapp_channel_members: quais canais
 * um usuário pode ler/gerar o QR Code de conexão sem ser o dono. Usada pela
 * UI de "Escopo de acesso" (campo "Liberar leitura de QRCode nos canais") e
 * por canConnectChannel em server/routes/whatsapp-channels.routes.ts.
 */
export async function listQrReaderChannelIdsForUser(userId: string): Promise<number[]> {
  const rows = await db
    .select({ channelId: whatsappChannelQrReaders.channelId })
    .from(whatsappChannelQrReaders)
    .where(eq(whatsappChannelQrReaders.userId, userId));
  return rows.map((r) => r.channelId);
}

/** Substitui a lista de canais com permissão de leitura de QR concedida a um usuário. */
export async function setQrReaderChannelsForUser(userId: string, channelIds: number[]) {
  await db.transaction(async (tx) => {
    await tx.delete(whatsappChannelQrReaders).where(eq(whatsappChannelQrReaders.userId, userId));
    if (channelIds.length > 0) {
      await tx
        .insert(whatsappChannelQrReaders)
        .values(channelIds.map((channelId) => ({ channelId, userId })))
        .onConflictDoNothing();
    }
  });
}

/**
 * IDs de todos os usuários com permissão de leitura de QR para um canal (não
 * inclui o dono — quem chama deve incluir `channel.userId` separadamente).
 * Usada para notificar admins/gerentes via SSE sobre QR e status de conexão,
 * já que eles podem conectar canais que não são seus (ver canUserReadChannelQr).
 */
export async function listQrReaderUserIdsForChannel(channelId: number): Promise<string[]> {
  const rows = await db
    .select({ userId: whatsappChannelQrReaders.userId })
    .from(whatsappChannelQrReaders)
    .where(eq(whatsappChannelQrReaders.channelId, channelId));
  return rows.map((r) => r.userId);
}

/** True se o usuário é dono do canal ou tem permissão explícita de leitura de QR. */
export async function canUserReadChannelQr(userId: string, channelId: number): Promise<boolean> {
  const [ownedRow] = await db
    .select({ id: whatsappChannels.id })
    .from(whatsappChannels)
    .where(and(eq(whatsappChannels.id, channelId), eq(whatsappChannels.userId, userId)));
  if (ownedRow) return true;

  const [grantRow] = await db
    .select({ id: whatsappChannelQrReaders.id })
    .from(whatsappChannelQrReaders)
    .where(
      and(
        eq(whatsappChannelQrReaders.channelId, channelId),
        eq(whatsappChannelQrReaders.userId, userId),
      ),
    );
  return !!grantRow;
}
