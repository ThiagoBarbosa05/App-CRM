import { getContactByPhone } from "../integrations/umbler";
import {
  umblerSyncRepository,
  type ClientForSync,
} from "../repositories/umbler-sync.repository";
import {
  calculateTagsHash,
  normalizePhoneToE164,
  isValidE164Phone,
  RateLimiter,
  retryWithBackoff,
  type UmblerTag,
} from "../lib/umbler-sync-utils";
import { formatPhoneToDigits } from "../lib/format-phone";
import { ClientsRepository } from "server/repositories/clients.repository";

export interface SyncResult {
  success: boolean;
  clientsProcessed: number;
  clientsSynced: number;
  clientsNotFound: number;
  clientsError: number;
  errors: Array<{ clientId: string; error: string }>;
  duration: number;
}

export interface SyncOptions {
  batchSize?: number;
  maxRetries?: number;
  specificClientIds?: string[];
}

export class UmblerSyncService {
  private rateLimiter: RateLimiter;
  private isSyncing = false;
  private clientsRepository = new ClientsRepository();

  constructor() {
    // Rate limit: 100 requests em 5 segundos
    this.rateLimiter = new RateLimiter(100, 5);
  }

  /**
   * Executa sincronização de um batch de clientes
   */
  async syncBatch(options: SyncOptions = {}): Promise<SyncResult> {
    if (this.isSyncing) {
      throw new Error("Sync already in progress");
    }

    this.isSyncing = true;
    const startTime = Date.now();

    const result: SyncResult = {
      success: true,
      clientsProcessed: 0,
      clientsSynced: 0,
      clientsNotFound: 0,
      clientsError: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Busca clientes para sincronizar
      const clients = options.specificClientIds
        ? await umblerSyncRepository.getClientsByIds(options.specificClientIds)
        : await umblerSyncRepository.getClientsBatchForSync(
            options.batchSize || 100
          );

      console.log(`[UmblerSync] Starting sync for ${clients.length} clients`);

      // Processa cada cliente
      for (const client of clients) {
        try {
          await this.syncClient(client);
          result.clientsProcessed++;

          // Log de progresso a cada 10 clientes
          if (result.clientsProcessed % 10 === 0) {
            console.log(
              `[UmblerSync] Progress: ${result.clientsProcessed}/${clients.length}`
            );
          }
        } catch (error) {
          result.clientsError++;
          result.errors.push({
            clientId: client.id,
            error: error instanceof Error ? error.message : String(error),
          });
          console.error(
            `[UmblerSync] Error syncing client ${client.id}:`,
            error
          );
        }
      }

      result.duration = Date.now() - startTime;

      console.log("[UmblerSync] Batch sync completed", {
        processed: result.clientsProcessed,
        synced: result.clientsSynced,
        notFound: result.clientsNotFound,
        errors: result.clientsError,
        duration: `${result.duration}ms`,
      });

      return result;
    } catch (error) {
      result.success = false;
      result.duration = Date.now() - startTime;
      console.error("[UmblerSync] Batch sync failed:", error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sincroniza um único cliente
   */
  private async syncClient(client: ClientForSync): Promise<void> {
    // 1. Normaliza telefone para E.164 usando formatPhoneToDigits
    const phoneE164 = formatPhoneToDigits(client.phone);

    if (!phoneE164 || !isValidE164Phone(phoneE164)) {
      console.warn(
        `[UmblerSync] Invalid phone for client ${client.id}: ${client.phone}`
      );
      await umblerSyncRepository.markAsError(
        client.id,
        `Invalid phone format: ${client.phone}`
      );
      return;
    }

    // 2. Busca snapshot existente
    const existingSnapshot = await umblerSyncRepository.getSnapshotByClientId(
      client.id
    );

    // 3. Verifica cache de "não encontrado" (7 dias)
    if (existingSnapshot?.notFoundAt) {
      const daysSinceNotFound =
        (Date.now() - existingSnapshot.notFoundAt.getTime()) /
        (1000 * 60 * 60 * 24);

      if (daysSinceNotFound < 7) {
        console.log(
          `[UmblerSync] Skipping client ${client.id} - not found in Umbler recently`
        );
        return;
      }
    }

    // 4. Rate limiting - aguarda slot disponível
    await this.rateLimiter.waitForSlot();

    // 5. Consulta Umbler com retry
    let contact;
    try {
      contact = await retryWithBackoff(
        async () => {
          const result = await getContactByPhone(phoneE164);
          return result;
        },
        3,
        1000
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Se erro 404, marca como não encontrado
      if (errorMessage.includes("404") || errorMessage.includes("not found")) {
        await umblerSyncRepository.markAsNotFound(client.id);
        return;
      }

      // Outros erros
      await umblerSyncRepository.markAsError(client.id, errorMessage);
      throw error;
    }

    // 6. Contato não encontrado
    if (!contact) {
      await umblerSyncRepository.markAsNotFound(client.id);
      return;
    }

    // 7. Calcula hash das tags
    const tags: UmblerTag[] = contact.tags || [];
    const tagsHash = calculateTagsHash(tags);

    // 8. Verifica se houve mudança
    const hasChanged = umblerSyncRepository.hasTagsChanged(
      existingSnapshot?.tagsHash || null,
      tagsHash
    );

    if (!hasChanged) {
      console.log(
        `[UmblerSync] No changes for client ${client.id} - skipping update`
      );
      await umblerSyncRepository.touchSnapshot(client.id);
      return;
    }

    // 9. Atualiza tags no CRM
    console.log(
      `[UmblerSync] Syncing tags for client ${client.id} - ${tags.length} tags`
    );

    // Mapear tags para formato { id, name }
    const tagsData = tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
    }));

    try {
      // Usa o repository existente para sincronizar tags
      await this.clientsRepository.syncClientTags(client.id, tagsData);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      await umblerSyncRepository.markAsError(
        client.id,
        `Failed to sync tags: ${errorMessage}`
      );
      throw error;
    }

    // 10. Atualiza snapshot
    await umblerSyncRepository.upsertSnapshot({
      crmClientId: client.id,
      phoneE164,
      umblerContactId: contact.id,
      tagsHash,
      tagsJson: JSON.stringify(tags),
    });

    // 11. Throttle entre requisições
    await this.rateLimiter.throttle();
  }

  /**
   * Sincroniza um cliente específico (útil para testes ou sync manual)
   */
  async syncSingleClient(clientId: string): Promise<void> {
    const clients = await umblerSyncRepository.getClientsByIds([clientId]);

    if (clients.length === 0) {
      throw new Error(`Client ${clientId} not found`);
    }

    await this.syncClient(clients[0]);
  }

  /**
   * Retorna estatísticas de sincronização
   */
  async getStats() {
    return umblerSyncRepository.getSyncStats();
  }

  /**
   * Limpa snapshots órfãos (clientes deletados)
   */
  async cleanupOrphans(): Promise<number> {
    return umblerSyncRepository.cleanupOrphanedSnapshots();
  }

  /**
   * Verifica se há sincronização em andamento
   */
  isSyncInProgress(): boolean {
    return this.isSyncing;
  }

  /**
   * Reseta rate limiter (útil para testes)
   */
  resetRateLimiter(): void {
    this.rateLimiter.reset();
  }
}

export const umblerSyncService = new UmblerSyncService();
