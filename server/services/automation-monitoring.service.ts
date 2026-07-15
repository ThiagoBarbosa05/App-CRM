import { db } from "server/db";
import {
  automationRules,
  automationExecutionLog,
  reengagementProgress,
  cashbackTransactions,
  clients,
  type AutomationRule,
} from "@shared/schema";
import { and, count, desc, eq, gte, ilike, inArray, sql } from "drizzle-orm";

const RECENT_WINDOW_DAYS = 30;

export interface RuleOverview {
  id: string;
  name: string;
  trigger: AutomationRule["trigger"];
  triggerParams: Record<string, unknown> | null;
  isActive: boolean;
  /** Clientes atualmente dentro do fluxo:
   *  - inactivity_reengagement → contagem em reengagement_progress (ciclo ativo)
   *  - cashback_* → clientes distintos alcançados com sucesso nos últimos 30 dias
   */
  activeClients: number;
  sentRecent: number;
  failedRecent: number;
  lastFailureAt: string | null;
  lastDispatchAt: string | null;
}

/**
 * Visão geral por regra:
 * - inactivity_reengagement → "no fluxo" = clientes em reengagement_progress
 *   (ciclo atual, zerado a cada nova compra do cliente).
 * - cashback_* → "no fluxo" = clientes distintos com disparo bem-sucedido
 *   nos últimos 30 dias (janela temporal alinhada ao ciclo do cashback).
 */
export async function getAutomationOverview(): Promise<RuleOverview[]> {
  const rules = await db
    .select()
    .from(automationRules)
    .orderBy(desc(automationRules.createdAt));

  if (rules.length === 0) return [];

  const ruleIds = rules.map((r) => r.id);
  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Para regras de inatividade: contar clientes em reengagement_progress agrupados
  // por attemptsSent. Clientes "no fluxo" da regra com attemptNumber=N são
  // aqueles onde attemptsSent = N-1 (já receberam N-1 tentativas, aguardam a N-ésima).
  const reengagementCountsRows = await db
    .select({
      attemptsSent: reengagementProgress.attemptsSent,
      total: count(),
    })
    .from(reengagementProgress)
    .groupBy(reengagementProgress.attemptsSent);

  const reengagementByAttemptsSent = new Map<number, number>();
  for (const row of reengagementCountsRows) {
    reengagementByAttemptsSent.set(row.attemptsSent, Number(row.total));
  }

  // Para cashback e outros triggers: clientes distintos com sucesso nos últimos 30 dias.
  const recentActiveClientsRows = await db
    .select({
      ruleId: automationExecutionLog.ruleId,
      activeClients: sql<number>`count(distinct ${automationExecutionLog.clientId})`,
      lastDispatchAt: sql<string | null>`max(${automationExecutionLog.createdAt})`,
    })
    .from(automationExecutionLog)
    .where(
      and(
        inArray(automationExecutionLog.ruleId, ruleIds),
        eq(automationExecutionLog.status, "success"),
        gte(automationExecutionLog.createdAt, since),
      ),
    )
    .groupBy(automationExecutionLog.ruleId);

  // lastDispatchAt geral (all-time) para exibição informativa
  const lastDispatchRows = await db
    .select({
      ruleId: automationExecutionLog.ruleId,
      lastDispatchAt: sql<string | null>`max(${automationExecutionLog.createdAt})`,
    })
    .from(automationExecutionLog)
    .where(
      and(
        inArray(automationExecutionLog.ruleId, ruleIds),
        eq(automationExecutionLog.status, "success"),
      ),
    )
    .groupBy(automationExecutionLog.ruleId);

  const recentActiveByRule = new Map<
    string,
    { activeClients: number; lastDispatchAt: string | null }
  >();
  for (const row of recentActiveClientsRows) {
    recentActiveByRule.set(row.ruleId, {
      activeClients: Number(row.activeClients),
      lastDispatchAt: row.lastDispatchAt,
    });
  }

  const lastDispatchByRule = new Map<string, string | null>();
  for (const row of lastDispatchRows) {
    lastDispatchByRule.set(row.ruleId, row.lastDispatchAt);
  }

  const recentStatsRows = await db
    .select({
      ruleId: automationExecutionLog.ruleId,
      status: automationExecutionLog.status,
      total: count(),
      lastFailureAt: sql<string | null>`max(${automationExecutionLog.createdAt})`,
    })
    .from(automationExecutionLog)
    .where(
      and(
        inArray(automationExecutionLog.ruleId, ruleIds),
        gte(automationExecutionLog.createdAt, since),
      ),
    )
    .groupBy(automationExecutionLog.ruleId, automationExecutionLog.status);

  const statsByRule = new Map<
    string,
    { sentRecent: number; failedRecent: number; lastFailureAt: string | null }
  >();
  for (const row of recentStatsRows) {
    const entry = statsByRule.get(row.ruleId) ?? {
      sentRecent: 0,
      failedRecent: 0,
      lastFailureAt: null,
    };
    if (row.status === "success") {
      entry.sentRecent += Number(row.total);
    } else {
      entry.failedRecent += Number(row.total);
      entry.lastFailureAt = row.lastFailureAt;
    }
    statsByRule.set(row.ruleId, entry);
  }

  return rules.map((rule) => {
    const stats = statsByRule.get(rule.id);
    const recentInfo = recentActiveByRule.get(rule.id);

    // activeClients:
    // - inactivity: clientes onde attemptsSent = attemptNumber - 1
    //   (já receberam N-1 tentativas e aguardam a N-ésima desta regra)
    // - cashback e outros: clientes distintos com sucesso nos últimos 30 dias
    let activeClients = 0;
    if (rule.trigger === "inactivity_reengagement") {
      const attemptNumber = (rule.triggerParams as Record<string, unknown> | null)?.attemptNumber;
      if (typeof attemptNumber === "number" && attemptNumber >= 1) {
        activeClients = reengagementByAttemptsSent.get(attemptNumber - 1) ?? 0;
      }
    } else {
      activeClients = recentInfo?.activeClients ?? 0;
    }

    return {
      id: rule.id,
      name: rule.name,
      trigger: rule.trigger,
      triggerParams: (rule.triggerParams as Record<string, unknown>) ?? null,
      isActive: rule.isActive,
      activeClients,
      sentRecent: stats?.sentRecent ?? 0,
      failedRecent: stats?.failedRecent ?? 0,
      lastFailureAt: stats?.lastFailureAt ?? null,
      lastDispatchAt: lastDispatchByRule.get(rule.id) ?? null,
    };
  });
}

export interface RuleClientRow {
  clientId: string;
  clientName: string;
  attemptsSent: number | null;
  lastDispatchAt: string | null;
  lastStatus: "success" | "failed";
  successCount: number;
  failedCount: number;
  /** Para fluxos de cashback: status atual do cashback do cliente */
  cashbackStatus: "active" | "expired" | "redeemed" | null;
  cashbackExpiresAt: string | null;
}

/**
 * Drill-down de clientes em uma regra:
 * - inactivity_reengagement → clientes em reengagement_progress (ciclo ativo real)
 *   enriquecidos com attemptsSent do log de execução.
 * - cashback_* → clientes com disparo bem-sucedido nos últimos 30 dias,
 *   enriquecidos com o status atual do cashback (ativo/expirado/resgatado).
 */
export async function getRuleClients(ruleId: string): Promise<RuleClientRow[]> {
  const [rule] = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.id, ruleId));
  if (!rule) return [];

  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Para inatividade: filtrar por attemptsSent = attemptNumber - 1
  // (clientes que já receberam N-1 tentativas e estão aguardando a N-ésima desta regra).
  if (rule.trigger === "inactivity_reengagement") {
    const attemptNumber = (rule.triggerParams as Record<string, unknown> | null)?.attemptNumber;
    const expectedAttemptsSent =
      typeof attemptNumber === "number" && attemptNumber >= 1 ? attemptNumber - 1 : null;

    const progressRows = await db
      .select({
        clientId: reengagementProgress.clientId,
        clientName: clients.name,
        attemptsSent: reengagementProgress.attemptsSent,
        lastAttemptAt: reengagementProgress.lastAttemptAt,
      })
      .from(reengagementProgress)
      .innerJoin(clients, eq(reengagementProgress.clientId, clients.id))
      .where(
        expectedAttemptsSent !== null
          ? eq(reengagementProgress.attemptsSent, expectedAttemptsSent)
          : undefined,
      )
      .orderBy(desc(reengagementProgress.lastAttemptAt));

    // Enriquecer com status do último disparo desta regra
    const clientIds = progressRows.map((r) => r.clientId);
    let lastStatusByClient = new Map<string, { lastStatus: "success" | "failed"; successCount: number; failedCount: number }>();
    if (clientIds.length > 0) {
      const logRows = await db
        .select({
          clientId: automationExecutionLog.clientId,
          status: automationExecutionLog.status,
        })
        .from(automationExecutionLog)
        .where(
          and(
            eq(automationExecutionLog.ruleId, ruleId),
            inArray(automationExecutionLog.clientId, clientIds),
          ),
        )
        .orderBy(desc(automationExecutionLog.createdAt));

      for (const row of logRows) {
        if (!row.clientId) continue;
        const entry = lastStatusByClient.get(row.clientId) ?? { lastStatus: row.status, successCount: 0, failedCount: 0 };
        if (row.status === "success") entry.successCount++;
        else entry.failedCount++;
        lastStatusByClient.set(row.clientId, entry);
      }
    }

    return progressRows.map((p) => {
      const logInfo = lastStatusByClient.get(p.clientId) ?? { lastStatus: "success" as const, successCount: 0, failedCount: 0 };
      return {
        clientId: p.clientId,
        clientName: p.clientName,
        attemptsSent: p.attemptsSent,
        lastDispatchAt: p.lastAttemptAt as unknown as string | null,
        lastStatus: logInfo.lastStatus,
        successCount: logInfo.successCount,
        failedCount: logInfo.failedCount,
        cashbackStatus: null,
        cashbackExpiresAt: null,
      };
    });
  }

  // Para cashback e outros: clientes com disparo bem-sucedido nos últimos 30 dias
  const rows = await db
    .select({
      clientId: automationExecutionLog.clientId,
      clientName: clients.name,
      status: automationExecutionLog.status,
      createdAt: automationExecutionLog.createdAt,
    })
    .from(automationExecutionLog)
    .innerJoin(clients, eq(automationExecutionLog.clientId, clients.id))
    .where(
      and(
        eq(automationExecutionLog.ruleId, ruleId),
        gte(automationExecutionLog.createdAt, since),
      ),
    )
    .orderBy(desc(automationExecutionLog.createdAt));

  const byClient = new Map<
    string,
    {
      clientName: string;
      lastDispatchAt: string;
      lastStatus: "success" | "failed";
      successCount: number;
      failedCount: number;
    }
  >();

  for (const row of rows) {
    if (!row.clientId) continue;
    const entry = byClient.get(row.clientId) ?? {
      clientName: row.clientName,
      lastDispatchAt: row.createdAt as unknown as string,
      lastStatus: row.status,
      successCount: 0,
      failedCount: 0,
    };
    if (row.status === "success") entry.successCount++;
    else entry.failedCount++;
    byClient.set(row.clientId, entry);
  }

  // Enriquecer cashback_earned / cashback_expiring com status atual do cashback
  let cashbackByClient: Map<string, { cashbackStatus: "active" | "expired" | "redeemed"; cashbackExpiresAt: string }> | null = null;

  if (rule.trigger === "cashback_earned" || rule.trigger === "cashback_expiring") {
    const clientIds = Array.from(byClient.keys());
    if (clientIds.length > 0) {
      const txRows = await db
        .select({
          clientId: cashbackTransactions.clientId,
          status: cashbackTransactions.status,
          expiresAt: cashbackTransactions.expiresAt,
          createdAt: cashbackTransactions.createdAt,
        })
        .from(cashbackTransactions)
        .where(inArray(cashbackTransactions.clientId, clientIds))
        .orderBy(desc(cashbackTransactions.createdAt));

      cashbackByClient = new Map();
      const now = new Date();
      for (const tx of txRows) {
        if (cashbackByClient.has(tx.clientId)) continue; // apenas o mais recente
        const isRedeemed = tx.status === "paid";
        const isExpired = !isRedeemed && new Date(tx.expiresAt as unknown as string) < now;
        cashbackByClient.set(tx.clientId, {
          cashbackStatus: isRedeemed ? "redeemed" : isExpired ? "expired" : "active",
          cashbackExpiresAt: tx.expiresAt as unknown as string,
        });
      }
    }
  }

  return Array.from(byClient.entries()).map(([clientId, info]) => ({
    clientId,
    clientName: info.clientName,
    attemptsSent: null,
    lastDispatchAt: info.lastDispatchAt,
    lastStatus: info.lastStatus,
    successCount: info.successCount,
    failedCount: info.failedCount,
    cashbackStatus: cashbackByClient?.get(clientId)?.cashbackStatus ?? null,
    cashbackExpiresAt: cashbackByClient?.get(clientId)?.cashbackExpiresAt ?? null,
  }));
}

export interface HistoryFilters {
  clientId?: string;
  clientName?: string;
  ruleId?: string;
  channel?: "sms" | "email";
  status?: "success" | "failed";
  page?: number;
  pageSize?: number;
}

export interface HistoryRow {
  id: string;
  ruleId: string;
  ruleName: string;
  clientId: string | null;
  clientName: string | null;
  channel: "sms" | "email";
  status: "success" | "failed";
  errorMessage: string | null;
  createdAt: string;
}

/** Histórico consultável do log de execução, com filtros e paginação. */
export async function getExecutionHistory(
  filters: HistoryFilters,
): Promise<{ data: HistoryRow[]; total: number; page: number; pageSize: number }> {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize =
    filters.pageSize && filters.pageSize > 0 ? Math.min(filters.pageSize, 200) : 20;

  const conditions = [];
  if (filters.clientId) conditions.push(eq(automationExecutionLog.clientId, filters.clientId));
  if (filters.ruleId) conditions.push(eq(automationExecutionLog.ruleId, filters.ruleId));
  if (filters.channel) conditions.push(eq(automationExecutionLog.channel, filters.channel));
  if (filters.status) conditions.push(eq(automationExecutionLog.status, filters.status));
  // clientName usa ILIKE no join com clients (filtro aplicado apenas em registros com cliente)
  if (filters.clientName) conditions.push(ilike(clients.name, `%${filters.clientName}%`));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(automationExecutionLog)
    .leftJoin(clients, eq(automationExecutionLog.clientId, clients.id))
    .where(where);

  const rows = await db
    .select({
      id: automationExecutionLog.id,
      ruleId: automationExecutionLog.ruleId,
      ruleName: automationRules.name,
      clientId: automationExecutionLog.clientId,
      clientName: clients.name,
      channel: automationExecutionLog.channel,
      status: automationExecutionLog.status,
      errorMessage: automationExecutionLog.errorMessage,
      createdAt: automationExecutionLog.createdAt,
    })
    .from(automationExecutionLog)
    .innerJoin(automationRules, eq(automationExecutionLog.ruleId, automationRules.id))
    .leftJoin(clients, eq(automationExecutionLog.clientId, clients.id))
    .where(where)
    .orderBy(desc(automationExecutionLog.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    data: rows as unknown as HistoryRow[],
    total: Number(total),
    page,
    pageSize,
  };
}
