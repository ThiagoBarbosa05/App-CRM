/**
 * Configuração do Google Cloud Pub/Sub para consumo de mensagens do Bling Control
 *
 * Variáveis de ambiente necessárias:
 * - GCP_PROJECT_ID: ID do projeto GCP
 * - GCP_PUBSUB_SUBSCRIPTION: Nome da subscription do Pub/Sub
 * - GCP_KEY_FILENAME: (Opcional) Caminho para o arquivo de credenciais JSON
 * - PUBSUB_MAX_MESSAGES: (Opcional) Número máximo de mensagens processadas simultaneamente (padrão: 10)
 * - PUBSUB_ACK_DEADLINE: (Opcional) Tempo em segundos para ACK (padrão: 60)
 * - PUBSUB_MAX_RETRIES: (Opcional) Número máximo de tentativas de reprocessamento (padrão: 3)
 * - PUBSUB_ENABLED: (Opcional) Habilitar/desabilitar consumo do Pub/Sub (padrão: false)
 */

export interface PubSubEnvironmentConfig {
  projectId: string;
  subscriptionName: string;
  keyFilename?: string;
  maxMessages: number;
  ackDeadlineSeconds: number;
  maxRetries: number;
  enabled: boolean;
}

/**
 * Carrega e valida configurações do Pub/Sub a partir das variáveis de ambiente
 * @throws Error se configurações obrigatórias estiverem faltando
 */
export function loadPubSubConfig(): PubSubEnvironmentConfig {
  // Verifica se o Pub/Sub está habilitado
  const enabled = process.env.PUBSUB_ENABLED === "true";

  if (!enabled) {
    console.log("[PubSub Config] Consumo do Pub/Sub está desabilitado");
    return {
      projectId: "",
      subscriptionName: "",
      maxMessages: 10,
      ackDeadlineSeconds: 60,
      maxRetries: 3,
      enabled: false,
    };
  }

  // Valida variáveis obrigatórias
  const projectId = process.env.GCP_PROJECT_ID;
  const subscriptionName = process.env.GCP_PUBSUB_SUBSCRIPTION;

  if (!projectId) {
    throw new Error("GCP_PROJECT_ID é obrigatório quando PUBSUB_ENABLED=true");
  }

  if (!subscriptionName) {
    throw new Error(
      "GCP_PUBSUB_SUBSCRIPTION é obrigatório quando PUBSUB_ENABLED=true"
    );
  }

  // Carrega variáveis opcionais com valores padrão
  const keyFilename = process.env.GCP_KEY_FILENAME;
  const maxMessages = parseInt(process.env.PUBSUB_MAX_MESSAGES || "10", 10);
  const ackDeadlineSeconds = parseInt(
    process.env.PUBSUB_ACK_DEADLINE || "60",
    10
  );
  const maxRetries = parseInt(process.env.PUBSUB_MAX_RETRIES || "3", 10);

  const config: PubSubEnvironmentConfig = {
    projectId,
    subscriptionName,
    keyFilename,
    maxMessages: isNaN(maxMessages) ? 10 : maxMessages,
    ackDeadlineSeconds: isNaN(ackDeadlineSeconds) ? 60 : ackDeadlineSeconds,
    maxRetries: isNaN(maxRetries) ? 3 : maxRetries,
    enabled: true,
  };

  console.log("[PubSub Config] Configuração carregada:", {
    projectId: config.projectId,
    subscriptionName: config.subscriptionName,
    hasKeyFile: !!config.keyFilename,
    maxMessages: config.maxMessages,
    ackDeadlineSeconds: config.ackDeadlineSeconds,
    maxRetries: config.maxRetries,
  });

  return config;
}

/**
 * Valida se todas as configurações necessárias estão presentes
 * @param config - Configuração a ser validada
 * @returns true se válido, false caso contrário
 */
export function validatePubSubConfig(config: PubSubEnvironmentConfig): boolean {
  if (!config.enabled) {
    return true; // Configuração válida mesmo desabilitada
  }

  if (!config.projectId || !config.subscriptionName) {
    console.error(
      "[PubSub Config] Configuração inválida: projectId e subscriptionName são obrigatórios"
    );
    return false;
  }

  if (config.maxMessages < 1 || config.maxMessages > 1000) {
    console.error("[PubSub Config] maxMessages deve estar entre 1 e 1000");
    return false;
  }

  if (config.ackDeadlineSeconds < 10 || config.ackDeadlineSeconds > 600) {
    console.error(
      "[PubSub Config] ackDeadlineSeconds deve estar entre 10 e 600"
    );
    return false;
  }

  if (config.maxRetries < 1 || config.maxRetries > 10) {
    console.error("[PubSub Config] maxRetries deve estar entre 1 e 10");
    return false;
  }

  return true;
}
