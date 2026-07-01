// @deprecated — Migração para WhatsApp Cloud API (Etapa 6). Remover após estabilização.
import { getContactByPhone } from "../integrations/umbler";
import {
  umblerSyncRepository,
  type ClientForSync,
} from "../repositories/umbler-sync.repository";
import {
  calculateTagsHash,
  RateLimiter,
  retryWithBackoff,
  type UmblerTag,
} from "../lib/umbler-sync-utils";
import { normalizePhoneE164 } from "@shared/phone";
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

    console.log("═══════════════════════════════════════════════════════");
    console.log("[UmblerSync] 🚀 Iniciando nova sincronização");
    console.log("[UmblerSync] ⏰ Timestamp:", new Date().toISOString());
    console.log("[UmblerSync] 📦 Batch size:", options.batchSize || 100);
    console.log(
      "[UmblerSync] 🎯 Specific clients:",
      options.specificClientIds ? "Sim" : "Não"
    );
    console.log("═══════════════════════════════════════════════════════");

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
      console.log("[UmblerSync] 🔍 Buscando clientes para sincronizar...");
      const clients = options.specificClientIds
        ? await umblerSyncRepository.getClientsByIds(options.specificClientIds)
        : await umblerSyncRepository.getClientsBatchForSync(
            options.batchSize || 100
          );

      console.log(`[UmblerSync] ✅ ${clients.length} clientes encontrados`);
      if (clients.length === 0) {
        console.log("[UmblerSync] ⚠️  Nenhum cliente para processar");
      }

      // Processa cada cliente
      console.log("[UmblerSync] 🔄 Iniciando processamento de clientes...");
      for (const client of clients) {
        const clientStartTime = Date.now();
        try {
          await this.syncClient(client);
          result.clientsProcessed++;
          const clientDuration = Date.now() - clientStartTime;

          // Log de progresso a cada 10 clientes
          if (result.clientsProcessed % 10 === 0) {
            const progressPercent = (
              (result.clientsProcessed / clients.length) *
              100
            ).toFixed(1);
            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
            const avgTimePerClient = (
              (Date.now() - startTime) /
              result.clientsProcessed
            ).toFixed(0);
            const estimatedRemaining = (
              (((Date.now() - startTime) / result.clientsProcessed) *
                (clients.length - result.clientsProcessed)) /
              1000
            ).toFixed(0);

            console.log(
              "───────────────────────────────────────────────────────"
            );
            console.log(
              `[UmblerSync] 📊 Progresso: ${result.clientsProcessed}/${clients.length} (${progressPercent}%)`
            );
            console.log(
              `[UmblerSync] ⏱️  Tempo decorrido: ${elapsedTime}s | Média: ${avgTimePerClient}ms/cliente`
            );
            console.log(
              `[UmblerSync] 🔮 Tempo estimado restante: ${estimatedRemaining}s`
            );
            console.log(
              `[UmblerSync] ✅ Sincronizados: ${result.clientsSynced} | ❌ Erros: ${result.clientsError} | 🔍 Não encontrados: ${result.clientsNotFound}`
            );
            console.log(
              "───────────────────────────────────────────────────────"
            );
          }
        } catch (error) {
          result.clientsError++;
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          result.errors.push({
            clientId: client.id,
            error: errorMsg,
          });
          console.error(
            `[UmblerSync] ❌ Erro ao sincronizar cliente ${client.id} (${client.name}):`,
            errorMsg
          );
        }
      }

      result.duration = Date.now() - startTime;

      const successRate =
        result.clientsProcessed > 0
          ? ((result.clientsSynced / result.clientsProcessed) * 100).toFixed(1)
          : "0.0";
      const errorRate =
        result.clientsProcessed > 0
          ? ((result.clientsError / result.clientsProcessed) * 100).toFixed(1)
          : "0.0";

      console.log("═══════════════════════════════════════════════════════");
      console.log("[UmblerSync] ✅ Sincronização batch concluída com sucesso!");
      console.log("═══════════════════════════════════════════════════════");
      console.log("[UmblerSync] 📈 RESUMO DA EXECUÇÃO:");
      console.log(
        `[UmblerSync] 📦 Total processado: ${result.clientsProcessed} clientes`
      );
      console.log(
        `[UmblerSync] ✅ Sincronizados: ${result.clientsSynced} (${successRate}%)`
      );
      console.log(`[UmblerSync] 🔍 Não encontrados: ${result.clientsNotFound}`);
      console.log(
        `[UmblerSync] ❌ Erros: ${result.clientsError} (${errorRate}%)`
      );
      console.log(
        `[UmblerSync] ⏱️  Duração total: ${(result.duration / 1000).toFixed(
          2
        )}s`
      );
      console.log(
        `[UmblerSync] ⚡ Velocidade média: ${(
          result.duration / result.clientsProcessed
        ).toFixed(0)}ms/cliente`
      );
      console.log(`[UmblerSync] 🕐 Finalizado em: ${new Date().toISOString()}`);

      if (result.errors.length > 0) {
        console.log("[UmblerSync] 🚨 ERROS ENCONTRADOS:");
        result.errors.forEach((err, idx) => {
          console.log(
            `[UmblerSync]   ${idx + 1}. Cliente ${err.clientId}: ${err.error}`
          );
        });
      }
      console.log("═══════════════════════════════════════════════════════");

      return result;
    } catch (error) {
      result.success = false;
      result.duration = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);

      console.error("═══════════════════════════════════════════════════════");
      console.error("[UmblerSync] 🔥 FALHA CRÍTICA NA SINCRONIZAÇÃO");
      console.error("═══════════════════════════════════════════════════════");
      console.error("[UmblerSync] ❌ Erro:", errorMsg);
      console.error(
        "[UmblerSync] 📊 Processados antes da falha:",
        result.clientsProcessed
      );
      console.error(
        "[UmblerSync] ⏱️  Duração até falha:",
        (result.duration / 1000).toFixed(2) + "s"
      );
      console.error("[UmblerSync] 🕐 Timestamp:", new Date().toISOString());
      if (error instanceof Error && error.stack) {
        console.error("[UmblerSync] 📜 Stack trace:", error.stack);
      }
      console.error("═══════════════════════════════════════════════════════");
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sincroniza um único cliente
   */
  private async syncClient(client: ClientForSync): Promise<void> {
    console.log(
      `[UmblerSync] 👤 Processando cliente: ${client.name} (${client.id})`
    );

    // 1. Normaliza telefone para E.164 usando normalizePhoneE164
    console.log(`[UmblerSync]   📞 Telefone original: ${client.phone}`);
    const phoneE164 = normalizePhoneE164(client.phone);
    console.log(`[UmblerSync]   📞 Telefone normalizado: ${phoneE164}`);

    if (!phoneE164) {
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
          `[UmblerSync]   ⏭️  Pulando cliente - marcado como "não encontrado" há ${daysSinceNotFound.toFixed(
            1
          )} dias`
        );
        return;
      } else {
        console.log(
          `[UmblerSync]   🔄 Cache de "não encontrado" expirou (${daysSinceNotFound.toFixed(
            1
          )} dias) - tentando novamente`
        );
      }
    }

    // 4. Rate limiting - aguarda slot disponível
    const remainingSlots = this.rateLimiter.getRemainingRequests();
    console.log(
      `[UmblerSync]   🚦 Rate limit - slots disponíveis: ${remainingSlots}/100`
    );
    await this.rateLimiter.waitForSlot();

    // 5. Consulta Umbler com retry
    console.log(`[UmblerSync]   🌐 Consultando Umbler API...`);
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
      console.log(
        `[UmblerSync]   ✅ Contato encontrado no Umbler: ${contact?.id}`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Se erro 404, marca como não encontrado
      if (errorMessage.includes("404") || errorMessage.includes("not found")) {
        console.log(`[UmblerSync]   🔍 Contato não encontrado no Umbler (404)`);
        await umblerSyncRepository.markAsNotFound(client.id);
        return;
      }

      // Outros erros
      console.error(
        `[UmblerSync]   ❌ Erro ao consultar Umbler: ${errorMessage}`
      );
      await umblerSyncRepository.markAsError(client.id, errorMessage);
      throw error;
    }

    // 6. Contato não encontrado
    if (!contact) {
      console.log(`[UmblerSync]   🔍 Contato não retornado pela API`);
      await umblerSyncRepository.markAsNotFound(client.id);
      return;
    }

    // 7. Calcula hash das tags
    const tags: UmblerTag[] = contact.tags || [];
    console.log(`[UmblerSync]   🏷️  Tags recebidas: ${tags.length}`);
    if (tags.length > 0) {
      console.log(
        `[UmblerSync]   📝 Tags: ${tags.map((t) => t.name).join(", ")}`
      );
    }
    const tagsHash = calculateTagsHash(tags);
    console.log(
      `[UmblerSync]   🔐 Hash calculado: ${tagsHash.substring(0, 16)}...`
    );

    // 8. Verifica se houve mudança
    const hasChanged = umblerSyncRepository.hasTagsChanged(
      existingSnapshot?.tagsHash || null,
      tagsHash
    );

    if (!hasChanged) {
      console.log(
        `[UmblerSync]   ⏭️  Sem mudanças detectadas - atualizando timestamp apenas`
      );
      await umblerSyncRepository.touchSnapshot(client.id);
      return;
    }

    console.log(
      `[UmblerSync]   🔄 Mudanças detectadas - sincronizando tags...`
    );

    // 9. Atualiza tags no CRM
    console.log(
      `[UmblerSync]   💾 Sincronizando ${tags.length} tags no CRM...`
    );

    try {
      // Vincula cada tag do Umbler ao cliente via tabela pivô contact_tags
      for (const tag of tags) {
        await this.clientsRepository.linkWhatsappTagToClient(
          client.id,
          tag.id,
          tag.name,
          (tag as any).emoji ?? null,
          (tag as any).color ?? null,
        );
      }
      console.log(`[UmblerSync]   ✅ Tags sincronizadas com sucesso no CRM`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(
        `[UmblerSync]   ❌ Erro ao sincronizar tags no CRM: ${errorMessage}`
      );
      await umblerSyncRepository.markAsError(
        client.id,
        `Failed to sync tags: ${errorMessage}`
      );
      throw error;
    }

    // 10. Atualiza snapshot
    console.log(`[UmblerSync]   💾 Atualizando snapshot local...`);
    await umblerSyncRepository.upsertSnapshot({
      crmClientId: client.id,
      phoneE164,
      umblerContactId: contact.id,
      tagsHash,
      tagsJson: JSON.stringify(tags),
    });
    console.log(`[UmblerSync]   ✅ Snapshot atualizado com sucesso`);
    console.log(
      `[UmblerSync] ✨ Cliente ${client.name} sincronizado com sucesso!`
    );

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
