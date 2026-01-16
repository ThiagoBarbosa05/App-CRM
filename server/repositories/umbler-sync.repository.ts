import { db } from "../db";
import {
  umblerContactSnapshot,
  clients,
  type Client,
} from "../../shared/schema";
import { eq, isNull, lt, and, sql, desc } from "drizzle-orm";

export interface SnapshotData {
  crmClientId: string;
  phoneE164: string;
  umblerContactId: string;
  tagsHash: string;
  tagsJson: string;
}

export interface SnapshotRecord {
  id: string;
  crmClientId: string;
  phoneE164: string;
  umblerContactId: string | null;
  tagsHash: string | null;
  tagsJson: string | null;
  lastSyncedAt: Date | null;
  lastCheckedAt: Date;
  notFoundAt: Date | null;
  syncStatus: "pending" | "synced" | "not_found" | "error";
  errorMessage: string | null;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientForSync {
  id: string;
  name: string;
  phone: string;
}

export class UmblerSyncRepository {
  /**
   * Busca snapshot por ID do cliente CRM
   */
  async getSnapshotByClientId(
    clientId: string
  ): Promise<SnapshotRecord | null> {
    const result = await db
      .select()
      .from(umblerContactSnapshot)
      .where(eq(umblerContactSnapshot.crmClientId, clientId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Cria ou atualiza snapshot
   */
  async upsertSnapshot(data: SnapshotData): Promise<void> {
    const now = new Date();

    await db
      .insert(umblerContactSnapshot)
      .values({
        crmClientId: data.crmClientId,
        phoneE164: data.phoneE164,
        umblerContactId: data.umblerContactId,
        tagsHash: data.tagsHash,
        tagsJson: data.tagsJson,
        lastSyncedAt: now,
        lastCheckedAt: now,
        syncStatus: "synced",
        errorMessage: null,
        retryCount: 0,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: umblerContactSnapshot.crmClientId,
        set: {
          phoneE164: data.phoneE164,
          umblerContactId: data.umblerContactId,
          tagsHash: data.tagsHash,
          tagsJson: data.tagsJson,
          lastSyncedAt: now,
          lastCheckedAt: now,
          syncStatus: "synced",
          errorMessage: null,
          notFoundAt: null, // Reset not_found se agora encontrou
          retryCount: 0,
          updatedAt: now,
        },
      });
  }

  /**
   * Marca contato como não encontrado no Umbler
   */
  async markAsNotFound(clientId: string): Promise<void> {
    const now = new Date();

    await db
      .insert(umblerContactSnapshot)
      .values({
        crmClientId: clientId,
        phoneE164: "", // Será preenchido depois
        notFoundAt: now,
        lastCheckedAt: now,
        syncStatus: "not_found",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: umblerContactSnapshot.crmClientId,
        set: {
          notFoundAt: now,
          lastCheckedAt: now,
          syncStatus: "not_found",
          errorMessage: "Contact not found in Umbler",
          updatedAt: now,
        },
      });
  }

  /**
   * Marca erro na sincronização
   */
  async markAsError(clientId: string, errorMessage: string): Promise<void> {
    const now = new Date();

    await db
      .insert(umblerContactSnapshot)
      .values({
        crmClientId: clientId,
        phoneE164: "",
        lastCheckedAt: now,
        syncStatus: "error",
        errorMessage,
        retryCount: 1,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: umblerContactSnapshot.crmClientId,
        set: {
          lastCheckedAt: now,
          syncStatus: "error",
          errorMessage,
          retryCount: sql`${umblerContactSnapshot.retryCount} + 1`,
          updatedAt: now,
        },
      });
  }

  /**
   * Atualiza apenas o timestamp de verificação (touch)
   */
  async touchSnapshot(clientId: string): Promise<void> {
    await db
      .update(umblerContactSnapshot)
      .set({
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(umblerContactSnapshot.crmClientId, clientId));
  }

  /**
   * Busca batch de clientes para sincronizar
   * Prioriza clientes que nunca foram sincronizados ou há mais tempo
   */
  async getClientsBatchForSync(batchSize = 100): Promise<ClientForSync[]> {
    // Busca clientes ativos com telefone válido
    // Prioriza clientes sem snapshot ou com snapshot mais antigo
    const result = await db
      .select({
        id: clients.id,
        name: clients.name,
        phone: clients.phone,
        lastChecked: umblerContactSnapshot.lastCheckedAt,
        notFoundAt: umblerContactSnapshot.notFoundAt,
      })
      .from(clients)
      .leftJoin(
        umblerContactSnapshot,
        eq(clients.id, umblerContactSnapshot.crmClientId)
      )
      .where(
        and(
          // Cliente ativo
          // Tem telefone
          sql`${clients.phone} IS NOT NULL AND ${clients.phone} != ''`,
          // Não foi marcado como "não encontrado" nos últimos 7 dias
          sql`(${umblerContactSnapshot.notFoundAt} IS NULL OR ${umblerContactSnapshot.notFoundAt} < NOW() - INTERVAL '7 days')`
        )
      )
      .orderBy(
        // Prioriza clientes nunca verificados
        sql`CASE WHEN ${umblerContactSnapshot.lastCheckedAt} IS NULL THEN 0 ELSE 1 END`,
        // Depois os mais antigos
        sql`${umblerContactSnapshot.lastCheckedAt} ASC NULLS FIRST`
      )
      .limit(batchSize);

    return result.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone || "",
    }));
  }

  /**
   * Busca clientes específicos para re-sincronização
   */
  async getClientsByIds(clientIds: string[]): Promise<ClientForSync[]> {
    const result = await db
      .select({
        id: clients.id,
        name: clients.name,
        phone: clients.phone,
      })
      .from(clients)
      .where(sql`${clients.id} IN ${clientIds}`);

    return result.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone || "",
    }));
  }

  /**
   * Estatísticas de sincronização
   */
  async getSyncStats(): Promise<{
    total: number;
    synced: number;
    pending: number;
    notFound: number;
    error: number;
    lastSyncDate: Date | null;
  }> {
    const stats = await db
      .select({
        syncStatus: umblerContactSnapshot.syncStatus,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(umblerContactSnapshot)
      .groupBy(umblerContactSnapshot.syncStatus);

    const lastSync = await db
      .select({
        lastSyncedAt: umblerContactSnapshot.lastSyncedAt,
      })
      .from(umblerContactSnapshot)
      .where(isNull(umblerContactSnapshot.notFoundAt))
      .orderBy(desc(umblerContactSnapshot.lastSyncedAt))
      .limit(1);

    const statsMap = stats.reduce((acc, row) => {
      acc[row.syncStatus] = row.count;
      return acc;
    }, {} as Record<string, number>);

    const totalClients = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(clients);

    return {
      total: totalClients[0]?.count || 0,
      synced: statsMap.synced || 0,
      pending: statsMap.pending || 0,
      notFound: statsMap.not_found || 0,
      error: statsMap.error || 0,
      lastSyncDate: lastSync[0]?.lastSyncedAt || null,
    };
  }

  /**
   * Limpa snapshots de clientes inativos ou excluídos
   */
  async cleanupOrphanedSnapshots(): Promise<number> {
    const result = await db
      .delete(umblerContactSnapshot)
      .where(
        sql`NOT EXISTS (SELECT 1 FROM ${clients} WHERE ${clients.id} = ${umblerContactSnapshot.crmClientId})`
      );

    return result.rowCount || 0;
  }

  /**
   * Verifica se há mudança nas tags comparando hashes
   */
  hasTagsChanged(currentHash: string | null, newHash: string): boolean {
    if (!currentHash) return true; // Primeira sincronização
    return currentHash !== newHash;
  }
}

export const umblerSyncRepository = new UmblerSyncRepository();
