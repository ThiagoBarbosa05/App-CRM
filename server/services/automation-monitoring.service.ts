import { db } from "server/db";
import {
  automationRules,
  automationExecutionLog,
  reengagementProgress,
  clients,
  type AutomationRule,
} from "@shared/schema";
import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";

const RECENT_WINDOW_DAYS = 30;

export interface RuleOverview {
  id: string;
  name: string;
  trigger: AutomationRule["trigger"];
  triggerParams: Record<string, unknown> | null;
  isActive: boolean;
  activeClients: number;
  sentRecent: number;
  failedRecent: number;
  lastFailureAt: string | null;
  lastDispatchAt: string | null;
}

/**
 * Visão geral por regra: quantos clientes estão atualmente dentro do fluxo
 * (ao menos um disparo bem-sucedido registrado para a regra), quantos
 * disparos ocorreram nos últimos 30 dias e quantas falhas recentes existem.
 */
export async function getAutomationOverview(): Promise<RuleOverview[]> {
  const rules = await db
    .select()
    .from(automationRules)
    .orderBy(desc(automationRules.createdAt));

  if (rules.length === 0) return [];

  const ruleIds = rules.map((r) => r.id);
  const since = new Date(Date.now() - RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const activeClientsRows = await db
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
      ),
    )
    .groupBy(automationExecutionLog.ruleId);

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

  const activeClientsByRule = new Map<
    string,
    { activeClients: number; lastDispatchAt: string | null }
  >();
  for (const row of activeClientsRows) {
    activeClientsByRule.set(row.ruleId, {
      activeClients: Number(row.activeClients),
      lastDispatchAt: row.lastDispatchAt,
    });
  }

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
    const activeInfo = activeClientsByRule.get(rule.id);
    const stats = statsByRule.get(rule.id);
    return {
      id: rule.id,
      name: rule.name,
      trigger: rule.trigger,
      triggerParams: (rule.triggerParams as Record<string, unknown>) ?? null,
      isActive: rule.isActive,
      activeClients: activeInfo?.activeClients ?? 0,
      sentRecent: stats?.sentRecent ?? 0,
      failedRecent: stats?.failedRecent ?? 0,
      lastFailureAt: stats?.lastFailureAt ?? null,
      lastDispatchAt: activeInfo?.lastDispatchAt ?? null,
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
}

/**
 * Drill-down de clientes atualmente dentro de uma regra específica: para
 * cada cliente que já recebeu ao menos um disparo desta regra, mostra a
 * data do último disparo e (para reengajamento) a etapa atual da régua.
 */
export async function getRuleClients(ruleId: string): Promise<RuleClientRow[]> {
  const [rule] = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.id, ruleId));
  if (!rule) return [];

  const rows = await db
    .select({
      clientId: automationExecutionLog.clientId,
      clientName: clients.name,
      status: automationExecutionLog.status,
      createdAt: automationExecutionLog.createdAt,
    })
    .from(automationExecutionLog)
    .innerJoin(clients, eq(automationExecutionLog.clientId, clients.id))
    .where(eq(automationExecutionLog.ruleId, ruleId))
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

  let attemptsByClient: Map<string, number> | null = null;
  if (rule.trigger === "inactivity_reengagement") {
    const clientIds = Array.from(byClient.keys());
    if (clientIds.length > 0) {
      const progressRows = await db
        .select()
        .from(reengagementProgress)
        .where(inArray(reengagementProgress.clientId, clientIds));
      attemptsByClient = new Map(
        progressRows.map((p) => [p.clientId, p.attemptsSent]),
      );
    }
  }

  return Array.from(byClient.entries()).map(([clientId, info]) => ({
    clientId,
    clientName: info.clientName,
    attemptsSent: attemptsByClient?.get(clientId) ?? null,
    lastDispatchAt: info.lastDispatchAt,
    lastStatus: info.lastStatus,
    successCount: info.successCount,
    failedCount: info.failedCount,
  }));
}

export interface HistoryFilters {
  clientId?: string;
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
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(automationExecutionLog)
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
