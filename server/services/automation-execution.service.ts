/**
 * Service para gerenciamento de execuções de automação
 * Controla o ciclo de vida, cancelamento e monitoramento de execuções
 */

import { db } from "../db";
import {
  automationExecutions,
  messageAutomationSettings,
} from "@shared/schema";
import { eq, and, inArray, desc } from "drizzle-orm";

export interface CreateExecutionParams {
  automationId: string;
  executionType: "scheduled" | "manual" | "catchup";
  targetDate: string;
  scheduledTime: string;
  totalClients?: number;
  metadata?: Record<string, any>;
}

export interface UpdateExecutionParams {
  status?: "queued" | "running" | "completed" | "cancelled" | "failed";
  processedClients?: number;
  successfulMessages?: number;
  failedMessages?: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Mapa de controle de cancelamento em memória
 * Permite verificação rápida sem consultar o banco
 */
const cancellationFlags = new Map<string, boolean>();

/**
 * Controle de catch-up em execução
 */
let catchupRunning = false;
let catchupExecutionId: string | null = null;

export class AutomationExecutionService {
  /**
   * Cria uma nova execução
   */
  static async createExecution(params: CreateExecutionParams): Promise<string> {
    const [execution] = await db
      .insert(automationExecutions)
      .values({
        automationId: params.automationId,
        executionType: params.executionType,
        status: "queued",
        targetDate: params.targetDate,
        scheduledTime: params.scheduledTime,
        totalClients: params.totalClients || 0,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      })
      .returning();

    console.log(
      `[Execution Service] Execução criada: ${execution.id} (Automação: ${params.automationId}, Tipo: ${params.executionType})`
    );

    return execution.id;
  }

  /**
   * Atualiza uma execução
   */
  static async updateExecution(
    executionId: string,
    params: UpdateExecutionParams
  ): Promise<void> {
    await db
      .update(automationExecutions)
      .set({
        ...params,
        updatedAt: new Date(),
      })
      .where(eq(automationExecutions.id, executionId));
  }

  /**
   * Marca execução como iniciada
   */
  static async startExecution(executionId: string): Promise<void> {
    await this.updateExecution(executionId, {
      status: "running",
      startedAt: new Date(),
    });

    console.log(`[Execution Service] Execução iniciada: ${executionId}`);
  }

  /**
   * Marca execução como concluída
   */
  static async completeExecution(
    executionId: string,
    successful: number,
    failed: number
  ): Promise<void> {
    await this.updateExecution(executionId, {
      status: "completed",
      successfulMessages: successful,
      failedMessages: failed,
      completedAt: new Date(),
    });

    // Limpar flag de cancelamento
    cancellationFlags.delete(executionId);

    console.log(
      `[Execution Service] Execução concluída: ${executionId} (Sucesso: ${successful}, Falhas: ${failed})`
    );
  }

  /**
   * Marca execução como falha
   */
  static async failExecution(
    executionId: string,
    errorMessage: string
  ): Promise<void> {
    await this.updateExecution(executionId, {
      status: "failed",
      errorMessage,
      completedAt: new Date(),
    });

    // Limpar flag de cancelamento
    cancellationFlags.delete(executionId);

    console.error(
      `[Execution Service] Execução falhou: ${executionId} - ${errorMessage}`
    );
  }

  /**
   * Cancela uma execução específica
   */
  static async cancelExecution(
    executionId: string,
    cancelledBy?: string
  ): Promise<boolean> {
    // Buscar execução
    const [execution] = await db
      .select()
      .from(automationExecutions)
      .where(eq(automationExecutions.id, executionId));

    if (!execution) {
      console.warn(
        `[Execution Service] Execução não encontrada: ${executionId}`
      );
      return false;
    }

    // Verificar se pode ser cancelada
    if (["completed", "cancelled", "failed"].includes(execution.status)) {
      console.warn(
        `[Execution Service] Execução ${executionId} já está finalizada (${execution.status})`
      );
      return false;
    }

    // Marcar flag de cancelamento na memória (para verificação rápida)
    cancellationFlags.set(executionId, true);

    // Atualizar no banco
    await db
      .update(automationExecutions)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy,
        completedAt: new Date(),
      })
      .where(eq(automationExecutions.id, executionId));

    console.log(
      `[Execution Service] Execução cancelada: ${executionId}${
        cancelledBy ? ` por ${cancelledBy}` : ""
      }`
    );

    return true;
  }

  /**
   * Cancela todas as execuções em andamento
   */
  static async cancelAllRunningExecutions(
    cancelledBy?: string
  ): Promise<number> {
    // Buscar execuções em andamento
    const runningExecutions = await db
      .select()
      .from(automationExecutions)
      .where(inArray(automationExecutions.status, ["queued", "running"]));

    if (runningExecutions.length === 0) {
      console.log(
        "[Execution Service] Nenhuma execução em andamento para cancelar"
      );
      return 0;
    }

    // Marcar flags de cancelamento
    runningExecutions.forEach((exec) => {
      cancellationFlags.set(exec.id, true);
    });

    // Atualizar no banco
    const executionIds = runningExecutions.map((e) => e.id);
    await db
      .update(automationExecutions)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy,
        completedAt: new Date(),
      })
      .where(inArray(automationExecutions.id, executionIds));

    console.log(
      `[Execution Service] ${runningExecutions.length} execução(ões) cancelada(s)`
    );

    return runningExecutions.length;
  }

  /**
   * Verifica se uma execução foi cancelada
   * Usa cache em memória para performance
   */
  static isCancelled(executionId: string): boolean {
    return cancellationFlags.get(executionId) === true;
  }

  /**
   * Atualiza progresso de uma execução
   */
  static async updateProgress(
    executionId: string,
    processed: number,
    successful: number,
    failed: number
  ): Promise<void> {
    await this.updateExecution(executionId, {
      processedClients: processed,
      successfulMessages: successful,
      failedMessages: failed,
    });
  }

  /**
   * Busca execuções em andamento
   */
  static async getRunningExecutions(): Promise<
    Array<typeof automationExecutions.$inferSelect>
  > {
    return await db
      .select()
      .from(automationExecutions)
      .where(inArray(automationExecutions.status, ["queued", "running"]))
      .orderBy(desc(automationExecutions.createdAt));
  }

  /**
   * Busca histórico de execuções de uma automação
   */
  static async getExecutionHistory(
    automationId: string,
    limit: number = 50
  ): Promise<Array<typeof automationExecutions.$inferSelect>> {
    return await db
      .select()
      .from(automationExecutions)
      .where(eq(automationExecutions.automationId, automationId))
      .orderBy(desc(automationExecutions.createdAt))
      .limit(limit);
  }

  /**
   * Busca todas as execuções (com paginação)
   */
  static async getAllExecutions(
    page: number = 1,
    pageSize: number = 50
  ): Promise<{
    executions: Array<typeof automationExecutions.$inferSelect>;
    total: number;
  }> {
    const offset = (page - 1) * pageSize;

    const [executions, countResult] = await Promise.all([
      db
        .select()
        .from(automationExecutions)
        .orderBy(desc(automationExecutions.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: db.$count(automationExecutions) })
        .from(automationExecutions),
    ]);

    return {
      executions,
      total: countResult[0]?.count || 0,
    };
  }

  /**
   * Limpa execuções antigas (manter últimos 30 dias)
   */
  static async cleanOldExecutions(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await db.delete(automationExecutions).where(
      and(
        eq(automationExecutions.status, "completed")
        // TODO: Adicionar filtro de data quando disponível
      )
    );

    console.log(`[Execution Service] Execuções antigas limpas`);

    return 0; // TODO: Retornar contagem real quando disponível
  }

  /**
   * Controle de catch-up
   */
  static startCatchup(executionId: string): void {
    catchupRunning = true;
    catchupExecutionId = executionId;
    console.log(`[Execution Service] Catch-up iniciado: ${executionId}`);
  }

  static stopCatchup(): void {
    if (catchupExecutionId) {
      cancellationFlags.set(catchupExecutionId, true);
    }
    catchupRunning = false;
    console.log("[Execution Service] Catch-up parado");
  }

  static isCatchupRunning(): boolean {
    return catchupRunning;
  }

  static getCatchupExecutionId(): string | null {
    return catchupExecutionId;
  }

  static async finishCatchup(): Promise<void> {
    catchupRunning = false;
    if (catchupExecutionId) {
      cancellationFlags.delete(catchupExecutionId);
      catchupExecutionId = null;
    }
  }
}
