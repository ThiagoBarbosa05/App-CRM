import { db } from "../db";
import {
  whatsappSectors,
  whatsappSectorMembers,
  whatsappConversations,
  whatsappChannels,
  users,
} from "../../shared/schema";
import type { InsertWhatsappSector } from "../../shared/schema";
import { and, eq, sql } from "drizzle-orm";

/**
 * Setores com contagem de membros e de membros "online" (com canal ativo
 * conectado), para exibir na picker de transferência (ex: "3 online").
 */
export async function listSectors(includeInactive = false) {
  const memberCount = sql<number>`count(distinct ${whatsappSectorMembers.userId})`;
  const onlineCount = sql<number>`count(distinct ${whatsappSectorMembers.userId}) filter (where ${whatsappChannels.id} is not null and (${whatsappChannels.provider} = 'cloud_api' or ${whatsappChannels.connectionStatus} = 'connected'))`;

  const base = db
    .select({
      id: whatsappSectors.id,
      name: whatsappSectors.name,
      color: whatsappSectors.color,
      isActive: whatsappSectors.isActive,
      createdAt: whatsappSectors.createdAt,
      memberCount,
      onlineCount,
    })
    .from(whatsappSectors)
    .leftJoin(whatsappSectorMembers, eq(whatsappSectorMembers.sectorId, whatsappSectors.id))
    .leftJoin(
      whatsappChannels,
      and(eq(whatsappChannels.userId, whatsappSectorMembers.userId), eq(whatsappChannels.isActive, true)),
    );

  if (includeInactive) {
    return base.groupBy(whatsappSectors.id).orderBy(whatsappSectors.name);
  }
  return base
    .where(eq(whatsappSectors.isActive, true))
    .groupBy(whatsappSectors.id)
    .orderBy(whatsappSectors.name);
}

export async function getSectorById(id: string) {
  const [sector] = await db
    .select()
    .from(whatsappSectors)
    .where(eq(whatsappSectors.id, id))
    .limit(1);
  return sector ?? null;
}

export async function createSector(data: { name: string; color?: string }) {
  const [created] = await db.insert(whatsappSectors).values(data).returning();
  return created;
}

export async function updateSector(
  id: string,
  data: Partial<Pick<InsertWhatsappSector, "name" | "color" | "isActive">>,
) {
  const [updated] = await db
    .update(whatsappSectors)
    .set(data)
    .where(eq(whatsappSectors.id, id))
    .returning();
  return updated ?? null;
}

export async function deleteSector(id: string) {
  await db.transaction(async (tx) => {
    // Desvincula conversas para preservá-las (sectorId é metadado nullable);
    // os membros do setor são removidos automaticamente (ON DELETE CASCADE).
    await tx
      .update(whatsappConversations)
      .set({ sectorId: null })
      .where(eq(whatsappConversations.sectorId, id));
    await tx.delete(whatsappSectors).where(eq(whatsappSectors.id, id));
  });
}

/** Membros de um setor com o canal ativo de cada um (se houver), para a picker de transferência. */
export async function listSectorMembers(sectorId: string) {
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      channelId: whatsappChannels.id,
      channelName: whatsappChannels.name,
      channelDisplayPhone: whatsappChannels.displayPhone,
      channelConnectionStatus: whatsappChannels.connectionStatus,
      channelProvider: whatsappChannels.provider,
    })
    .from(whatsappSectorMembers)
    .innerJoin(users, eq(whatsappSectorMembers.userId, users.id))
    .leftJoin(
      whatsappChannels,
      and(eq(whatsappChannels.userId, users.id), eq(whatsappChannels.isActive, true)),
    )
    .where(eq(whatsappSectorMembers.sectorId, sectorId))
    .orderBy(users.name);
}

/** Substitui a lista de membros de um setor pela lista informada. */
export async function setSectorMembers(sectorId: string, userIds: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(whatsappSectorMembers).where(eq(whatsappSectorMembers.sectorId, sectorId));
    if (userIds.length > 0) {
      await tx
        .insert(whatsappSectorMembers)
        .values(userIds.map((userId) => ({ sectorId, userId })));
    }
  });
}

export async function listSectorsForUser(userId: string) {
  return db
    .select({ id: whatsappSectors.id, name: whatsappSectors.name, color: whatsappSectors.color })
    .from(whatsappSectorMembers)
    .innerJoin(whatsappSectors, eq(whatsappSectorMembers.sectorId, whatsappSectors.id))
    .where(and(eq(whatsappSectorMembers.userId, userId), eq(whatsappSectors.isActive, true)))
    .orderBy(whatsappSectors.name);
}

/** Ids dos setores de um usuário — usado para escopar a visibilidade de conversas de vendedores. */
export async function listSectorIdsForUser(userId: string): Promise<string[]> {
  const rows = await db
    .select({ sectorId: whatsappSectorMembers.sectorId })
    .from(whatsappSectorMembers)
    .where(eq(whatsappSectorMembers.userId, userId));
  return rows.map((r) => r.sectorId);
}

/** Substitui a lista de setores de um usuário pela lista informada — simétrico a setSectorMembers, do lado do usuário. */
export async function setSectorsForUser(userId: string, sectorIds: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(whatsappSectorMembers).where(eq(whatsappSectorMembers.userId, userId));
    if (sectorIds.length > 0) {
      await tx
        .insert(whatsappSectorMembers)
        .values(sectorIds.map((sectorId) => ({ sectorId, userId })))
        .onConflictDoNothing();
    }
  });
}

/**
 * Setores de todos os usuários de uma vez, agrupados por userId — usado na
 * listagem de atendentes para exibir o escopo de acesso sem N+1 requests.
 */
export async function listSectorsForAllUsers(): Promise<
  Record<string, { id: string; name: string; color: string }[]>
> {
  const rows = await db
    .select({
      userId: whatsappSectorMembers.userId,
      id: whatsappSectors.id,
      name: whatsappSectors.name,
      color: whatsappSectors.color,
    })
    .from(whatsappSectorMembers)
    .innerJoin(whatsappSectors, eq(whatsappSectorMembers.sectorId, whatsappSectors.id))
    .where(eq(whatsappSectors.isActive, true))
    .orderBy(whatsappSectors.name);

  const map: Record<string, { id: string; name: string; color: string }[]> = {};
  for (const row of rows) {
    (map[row.userId] ??= []).push({ id: row.id, name: row.name, color: row.color });
  }
  return map;
}
