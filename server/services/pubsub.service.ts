import { PubSub, Message, Subscription } from "@google-cloud/pubsub";
import { db } from "../db";
import {
  pubsubProcessingLogs,
  type InsertPubsubProcessingLog,
} from "../../shared/schema";
import type { BlingControlPubSubMessage } from "../types/bling-orders-message";
import { isBlingControlMessage } from "../types/bling-orders-message";
import { blingOrdersService } from "./bling-orders.service";
import { eq } from "drizzle-orm";
import "dotenv/config";

/**
 * Interface para configuração do Pub/Sub
 */
export interface PubSubConfig {
  projectId: string;
  subscriptionName: string;
  keyFilename?: string;
  maxMessages?: number;
  ackDeadlineSeconds?: number;
  maxRetries?: number;
}

/**
 * Interface para resultado do processamento
 */
export interface ProcessingResult {
  success: boolean;
  messageId: string;
  error?: string;
}

/**
 * Service responsável por consumir e processar mensagens do Google Cloud Pub/Sub
 *
 * Esta classe implementa as melhores práticas para consumo de mensagens:
 * - Processamento idempotente com registro de mensagens processadas
 * - Tratamento robusto de erros com retry automático
 * - Logging detalhado para auditoria
 * - Graceful shutdown
 * - Dead Letter Queue simulation (marcação de falhas após múltiplas tentativas)
 */
export class PubSubService {
  private pubSubClient: PubSub;
  private subscription: Subscription | null = null;
  private config: PubSubConfig;
  private isShuttingDown = false;
  private activeMessages = 0;

  constructor(config: PubSubConfig) {
    this.config = {
      maxMessages: 10,
      ackDeadlineSeconds: 60,
      maxRetries: 3,
      ...config,
    };

    // Inicializa o cliente Pub/Sub
    this.pubSubClient = new PubSub({
      projectId: this.config.projectId,
      keyFilename: this.config.keyFilename,
    });
  }

  /**
   * Inicia o consumo de mensagens do Pub/Sub
   */
  async start(): Promise<void> {
    try {
      console.log(
        `[PubSub] Iniciando consumo da subscription: ${this.config.subscriptionName}`
      );

      this.subscription = this.pubSubClient.subscription(
        this.config.subscriptionName
      );

      // Configura flow control usando type assertion para compatibilidade
      (this.subscription as any).flowControl = {
        maxMessages: this.config.maxMessages,
      };

      // Listener para mensagens
      this.subscription.on("message", async (message: Message) => {
        await this.handleMessage(message);
      });

      // Listener para erros
      this.subscription.on("error", (error) => {
        console.error("[PubSub] Erro no subscription:", error);
      });

      console.log("[PubSub] Consumo de mensagens iniciado com sucesso");
    } catch (error) {
      console.error("[PubSub] Erro ao iniciar consumo:", error);
      throw error;
    }
  }

  /**
   * Para o consumo de mensagens (graceful shutdown)
   */
  async stop(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    console.log("[PubSub] Iniciando graceful shutdown...");

    // Aguarda todas as mensagens ativas serem processadas
    const timeout = 30000; // 30 segundos
    const startTime = Date.now();

    while (this.activeMessages > 0 && Date.now() - startTime < timeout) {
      console.log(
        `[PubSub] Aguardando ${this.activeMessages} mensagens serem processadas...`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (this.subscription) {
      await this.subscription.close();
      console.log("[PubSub] Subscription fechada");
    }

    console.log("[PubSub] Graceful shutdown concluído");
  }

  /**
   * Processa uma mensagem recebida do Pub/Sub
   * @param message - Mensagem do Pub/Sub
   */
  private async handleMessage(message: Message): Promise<void> {
    this.activeMessages++;
    const messageId = message.id;

    try {
      console.log(`[PubSub] Processando mensagem: ${messageId}`);

      // Verifica se a mensagem já foi processada (idempotência)
      // IMPORTANTE: Fazer isso ANTES de qualquer outra operação
      const alreadyProcessed = await this.isMessageProcessed(messageId);
      if (alreadyProcessed) {
        console.log(
          `[PubSub] Mensagem ${messageId} já foi processada. Pulando.`
        );
        message.ack();
        this.activeMessages--;
        return;
      }

      // Parse dos dados da mensagem
      let messageData: BlingControlPubSubMessage;
      try {
        const dataString = message.data.toString();
        messageData = JSON.parse(dataString);
      } catch (parseError) {
        console.error(
          `[PubSub] Erro ao fazer parse da mensagem ${messageId}:`,
          parseError
        );
        await this.logProcessingError(
          messageId,
          message.data.toString(),
          "Erro ao fazer parse do JSON",
          parseError
        );
        message.ack(); // ACK para evitar reprocessamento infinito
        this.activeMessages--;
        return;
      }

      // Valida se é uma mensagem do Bling Control
      if (!isBlingControlMessage(messageData)) {
        console.warn(
          `[PubSub] Mensagem ${messageId} não é uma mensagem válida do Bling Control`
        );
        await this.logProcessingError(
          messageId,
          JSON.stringify(messageData),
          "Mensagem inválida do Bling Control"
        );
        message.ack(); // ACK para evitar reprocessamento infinito
        this.activeMessages--;
        return;
      }

      // Registra início do processamento (após todas as validações)
      await this.createProcessingLog(messageId, messageData);

      // Processa a mensagem baseado no tipo de evento
      const result = await this.processMessage(messageData);

      if (result.success) {
        // Marca como processada com sucesso
        await this.updateProcessingLog(messageId, "success");
        message.ack();
        console.log(`[PubSub] Mensagem ${messageId} processada com sucesso`);
      } else {
        throw new Error(
          result.error || "Erro desconhecido ao processar mensagem"
        );
      }
    } catch (error) {
      console.error(`[PubSub] Erro ao processar mensagem ${messageId}:`, error);

      // Incrementa tentativas e verifica retry
      const shouldRetry = await this.handleProcessingError(
        messageId,
        message.data.toString(),
        error
      );

      if (shouldRetry) {
        console.log(`[PubSub] Mensagem ${messageId} será reprocessada`);
        message.nack(); // NACK para reprocessamento
      } else {
        console.log(
          `[PubSub] Mensagem ${messageId} excedeu limite de tentativas. Marcando como falha.`
        );
        message.ack(); // ACK para evitar reprocessamento infinito
      }
    } finally {
      this.activeMessages--;
    }
  }

  /**
   * Processa a mensagem baseado no tipo de evento
   * @param message - Mensagem validada do Bling Control
   * @returns Promise<ProcessingResult>
   */
  private async processMessage(
    message: BlingControlPubSubMessage
  ): Promise<ProcessingResult> {
    try {
      switch (message.eventType) {
        case "created":
          await blingOrdersService.createOrder({ message });
          return {
            success: true,
            messageId: message.metadata.eventId,
          };

        case "updated":
          await blingOrdersService.updateOrder({ message });
          return {
            success: true,
            messageId: message.metadata.eventId,
          };

        case "deleted":
          await blingOrdersService.deleteOrder({ message });
          return {
            success: true,
            messageId: message.metadata.eventId,
          };

        default:
          return {
            success: false,
            messageId: message.metadata.eventId,
            error: `Tipo de evento não suportado: ${message.eventType}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        messageId: message.metadata.eventId,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Verifica se uma mensagem já foi processada
   * @param messageId - ID da mensagem
   * @returns Promise<boolean>
   */
  private async isMessageProcessed(messageId: string): Promise<boolean> {
    try {
      const [log] = await db
        .select()
        .from(pubsubProcessingLogs)
        .where(eq(pubsubProcessingLogs.messageId, messageId))
        .limit(1);

      return log?.status === "success";
    } catch (error) {
      console.error(
        `[PubSub] Erro ao verificar se mensagem ${messageId} foi processada:`,
        error
      );
      return false;
    }
  }

  /**
   * Cria um log de processamento
   * @param messageId - ID da mensagem
   * @param message - Dados da mensagem
   */
  private async createProcessingLog(
    messageId: string,
    message: BlingControlPubSubMessage
  ): Promise<void> {
    try {
      const logData: InsertPubsubProcessingLog = {
        messageId,
        eventType: message.eventType,
        blingOrderId: String(message.order.id),
        status: "processing",
        attempts: 1,
        rawMessage: JSON.stringify(message),
        accountId: message.metadata.accountId,
        userId: message.metadata.userId,
      };

      await db
        .insert(pubsubProcessingLogs)
        .values(logData)
        .onConflictDoNothing();
    } catch (error) {
      console.error("[PubSub] Erro ao criar log de processamento:", error);
      // Não propaga erro para não bloquear processamento
    }
  }

  /**
   * Atualiza o log de processamento
   * @param messageId - ID da mensagem
   * @param status - Novo status
   */
  private async updateProcessingLog(
    messageId: string,
    status: "success" | "failed" | "retrying"
  ): Promise<void> {
    try {
      await db
        .update(pubsubProcessingLogs)
        .set({
          status,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(pubsubProcessingLogs.messageId, messageId));
    } catch (error) {
      console.error("[PubSub] Erro ao atualizar log de processamento:", error);
      // Não propaga erro para não bloquear processamento
    }
  }

  /**
   * Registra erro de processamento
   * @param messageId - ID da mensagem
   * @param rawMessage - Mensagem bruta
   * @param errorMessage - Mensagem de erro
   * @param error - Erro original
   */
  private async logProcessingError(
    messageId: string,
    rawMessage: string,
    errorMessage: string,
    error?: any
  ): Promise<void> {
    try {
      const logData: InsertPubsubProcessingLog = {
        messageId,
        eventType: "created", // Default, pode não ser válido
        status: "failed",
        attempts: 1,
        errorMessage,
        errorStack: error?.stack || null,
        rawMessage,
      };

      await db
        .insert(pubsubProcessingLogs)
        .values(logData)
        .onConflictDoNothing();
    } catch (error) {
      console.error("[PubSub] Erro ao registrar erro de processamento:", error);
      // Não propaga erro
    }
  }

  /**
   * Trata erro de processamento e decide sobre retry
   * @param messageId - ID da mensagem
   * @param rawMessage - Mensagem bruta
   * @param error - Erro ocorrido
   * @returns Promise<boolean> - true se deve fazer retry, false caso contrário
   */
  private async handleProcessingError(
    messageId: string,
    rawMessage: string,
    error: any
  ): Promise<boolean> {
    try {
      const [log] = await db
        .select()
        .from(pubsubProcessingLogs)
        .where(eq(pubsubProcessingLogs.messageId, messageId))
        .limit(1);

      const attempts = (log?.attempts || 0) + 1;
      const shouldRetry = attempts < (this.config.maxRetries || 3);

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : null;

      if (log) {
        // Atualiza log existente
        await db
          .update(pubsubProcessingLogs)
          .set({
            attempts,
            status: shouldRetry ? "retrying" : "failed",
            errorMessage,
            errorStack,
            updatedAt: new Date(),
          })
          .where(eq(pubsubProcessingLogs.messageId, messageId));
      } else {
        // Cria novo log
        const logData: InsertPubsubProcessingLog = {
          messageId,
          eventType: "created", // Default
          status: shouldRetry ? "retrying" : "failed",
          attempts,
          errorMessage,
          errorStack,
          rawMessage,
        };
        await db.insert(pubsubProcessingLogs).values(logData);
      }

      return shouldRetry;
    } catch (error) {
      console.error("[PubSub] Erro ao tratar erro de processamento:", error);
      return false; // Em caso de erro, não retenta
    }
  }

  /**
   * Retorna estatísticas de processamento
   */
  async getProcessingStats(): Promise<{
    total: number;
    success: number;
    failed: number;
    processing: number;
    retrying: number;
  }> {
    try {
      const logs = await db.select().from(pubsubProcessingLogs);

      return {
        total: logs.length,
        success: logs.filter((l) => l.status === "success").length,
        failed: logs.filter((l) => l.status === "failed").length,
        processing: logs.filter((l) => l.status === "processing").length,
        retrying: logs.filter((l) => l.status === "retrying").length,
      };
    } catch (error) {
      console.error("[PubSub] Erro ao buscar estatísticas:", error);
      return {
        total: 0,
        success: 0,
        failed: 0,
        processing: 0,
        retrying: 0,
      };
    }
  }
}

// Factory function para criar instância do serviço
export function createPubSubService(config: PubSubConfig): PubSubService {
  return new PubSubService(config);
}
