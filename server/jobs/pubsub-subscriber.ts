import { createPubSubService, PubSubService } from "../services/pubsub.service";
import {
  loadPubSubConfig,
  validatePubSubConfig,
} from "../config/pubsub.config";

/**
 * Instância global do serviço Pub/Sub
 */
let pubSubServiceInstance: PubSubService | null = null;

/**
 * Inicializa e inicia o consumo de mensagens do Pub/Sub
 *
 * Esta função deve ser chamada durante o startup da aplicação
 * para começar a processar mensagens do Bling Control.
 *
 * @example
 * ```typescript
 * // No arquivo server/index.ts
 * import { initializePubSubSubscriber } from './jobs/pubsub-subscriber';
 *
 * // Após inicializar o servidor
 * initializePubSubSubscriber();
 * ```
 */
export async function initializePubSubSubscriber(): Promise<void> {
  try {
    console.log("[PubSub Subscriber] Inicializando consumidor do Pub/Sub...");

    // Carrega configurações
    const config = loadPubSubConfig();

    // Verifica se está habilitado
    if (!config.enabled) {
      console.log(
        "[PubSub Subscriber] Pub/Sub está desabilitado. Defina PUBSUB_ENABLED=true para habilitar."
      );
      return;
    }

    // Valida configurações
    if (!validatePubSubConfig(config)) {
      throw new Error("Configuração do Pub/Sub inválida");
    }

    // Cria instância do serviço
    pubSubServiceInstance = createPubSubService({
      projectId: config.projectId,
      subscriptionName: config.subscriptionName,
      keyFilename: config.keyFilename,
      maxMessages: config.maxMessages,
      ackDeadlineSeconds: config.ackDeadlineSeconds,
      maxRetries: config.maxRetries,
    });

    // Inicia consumo
    await pubSubServiceInstance.start();

    console.log(
      "[PubSub Subscriber] Consumidor do Pub/Sub inicializado com sucesso"
    );
    console.log(`[PubSub Subscriber] Subscription: ${config.subscriptionName}`);
    console.log(`[PubSub Subscriber] Max Messages: ${config.maxMessages}`);
  } catch (error) {
    console.error(
      "[PubSub Subscriber] Erro ao inicializar consumidor do Pub/Sub:",
      error
    );
    // Não propaga erro para não quebrar startup da aplicação
    // O Pub/Sub é um componente adicional, não crítico
  }
}

/**
 * Para o consumidor do Pub/Sub (graceful shutdown)
 *
 * Esta função deve ser chamada durante o shutdown da aplicação
 * para garantir que todas as mensagens em processamento sejam finalizadas.
 *
 * @example
 * ```typescript
 * // No arquivo server/index.ts
 * import { shutdownPubSubSubscriber } from './jobs/pubsub-subscriber';
 *
 * process.on('SIGTERM', async () => {
 *   await shutdownPubSubSubscriber();
 *   process.exit(0);
 * });
 * ```
 */
export async function shutdownPubSubSubscriber(): Promise<void> {
  if (!pubSubServiceInstance) {
    console.log("[PubSub Subscriber] Nenhum consumidor ativo para parar");
    return;
  }

  try {
    console.log("[PubSub Subscriber] Parando consumidor do Pub/Sub...");
    await pubSubServiceInstance.stop();
    pubSubServiceInstance = null;
    console.log("[PubSub Subscriber] Consumidor parado com sucesso");
  } catch (error) {
    console.error(
      "[PubSub Subscriber] Erro ao parar consumidor do Pub/Sub:",
      error
    );
  }
}

/**
 * Retorna estatísticas de processamento do Pub/Sub
 *
 * @returns Estatísticas de processamento ou null se não estiver ativo
 */
export async function getPubSubStats(): Promise<{
  total: number;
  success: number;
  failed: number;
  processing: number;
  retrying: number;
} | null> {
  if (!pubSubServiceInstance) {
    return null;
  }

  try {
    return await pubSubServiceInstance.getProcessingStats();
  } catch (error) {
    console.error("[PubSub Subscriber] Erro ao buscar estatísticas:", error);
    return null;
  }
}

/**
 * Verifica se o consumidor está ativo
 */
export function isPubSubActive(): boolean {
  return pubSubServiceInstance !== null;
}
