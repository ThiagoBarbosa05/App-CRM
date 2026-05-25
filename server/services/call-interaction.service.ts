import { db } from "server/db";
import {
  calls,
  clientInteractions,
  telemarketingGoals,
  telemarketingWeeklyResults,
  systemSettings,
} from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";

const CALL_OUTCOME_TO_RESULT: Record<
  string,
  "COM SUCESSO" | "NÃO ATENDIDA" | "SEM INTERESSE" | "EM OCUPADO" | "OUTROS"
> = {
  convertido: "COM SUCESSO",
  atendeu: "COM SUCESSO",
  nao_atendeu: "NÃO ATENDIDA",
  caixa_postal: "NÃO ATENDIDA",
  ocupado: "EM OCUPADO",
  numero_invalido: "OUTROS",
  reagendado: "OUTROS",
};

function getWeekOfMonth(date: Date): number {
  const dayOfMonth = date.getDate();
  return Math.min(4, Math.ceil(dayOfMonth / 7));
}

/**
 * Cria uma `client_interactions` a partir de uma `call` em estado terminal.
 * Idempotente: dedup via `subject` que contém o callId.
 */
export async function syncCallToInteraction(callId: string): Promise<void> {
  try {
    const [call] = await db.select().from(calls).where(eq(calls.id, callId));
    if (!call || !call.clientId || !call.operatorId) return;

    const subject = `Ligação · #${call.id.slice(0, 8)}`;

    // Dedup
    const [existing] = await db
      .select({ id: clientInteractions.id })
      .from(clientInteractions)
      .where(
        and(
          eq(clientInteractions.clientId, call.clientId),
          eq(clientInteractions.subject, subject),
        ),
      )
      .limit(1);
    if (existing) return;

    const description = [
      call.summary,
      call.notes,
      call.duration ? `Duração: ${call.duration}s` : null,
    ]
      .filter(Boolean)
      .join("\n\n") || "Ligação registrada pelo telemarketing.";

    const callResult = call.outcome
      ? CALL_OUTCOME_TO_RESULT[call.outcome] ?? "OUTROS"
      : null;

    await db.insert(clientInteractions).values({
      clientId: call.clientId,
      userId: call.operatorId,
      type: "telemarketing",
      subject,
      description,
      date: call.startedAt ?? new Date(),
      callResult: callResult ?? undefined,
      status: "completed",
    });
  } catch (e) {
    console.error("[call-interaction] syncCallToInteraction error:", e);
  }
}

/**
 * Incrementa o resultado semanal correspondente à meta de telemarketing do operador.
 * Não cria nova meta — apenas atualiza se já existir meta para userId/result/month/year.
 */
export async function incrementTelemarketingWeeklyResult(
  callId: string,
): Promise<void> {
  try {
    const [call] = await db.select().from(calls).where(eq(calls.id, callId));
    if (!call?.operatorId || !call.outcome) return;
    const result = CALL_OUTCOME_TO_RESULT[call.outcome];
    if (!result) return;

    const callDate = call.startedAt ?? call.createdAt ?? new Date();
    const month = callDate.getMonth() + 1;
    const year = callDate.getFullYear();
    const week = getWeekOfMonth(callDate);

    const [goal] = await db
      .select()
      .from(telemarketingGoals)
      .where(
        and(
          eq(telemarketingGoals.userId, call.operatorId),
          eq(telemarketingGoals.targetResult, result),
          eq(telemarketingGoals.month, month),
          eq(telemarketingGoals.year, year),
        ),
      );
    if (!goal) return;

    // Upsert atômico do resultado semanal
    const [existing] = await db
      .select()
      .from(telemarketingWeeklyResults)
      .where(
        and(
          eq(telemarketingWeeklyResults.telemarketingGoalId, goal.id),
          eq(telemarketingWeeklyResults.week, week),
        ),
      );

    if (existing) {
      await db
        .update(telemarketingWeeklyResults)
        .set({
          quantityAchieved: sql`${telemarketingWeeklyResults.quantityAchieved} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(telemarketingWeeklyResults.id, existing.id));
    } else {
      await db.insert(telemarketingWeeklyResults).values({
        telemarketingGoalId: goal.id,
        week,
        quantityAchieved: 1,
      });
    }
  } catch (e) {
    console.error("[call-interaction] incrementTelemarketingWeeklyResult error:", e);
  }
}

/**
 * Cria um deal no funil padrão de telemarketing quando outcome=convertido
 * ou aiDecision=sim. Funnel ID configurável em `system_settings.telemarketing_default_funnel_id`.
 */
export async function maybeCreateDealFromCall(callId: string): Promise<void> {
  try {
    const [call] = await db.select().from(calls).where(eq(calls.id, callId));
    if (!call?.clientId || !call.operatorId) return;
    const shouldCreate =
      call.outcome === "convertido" || call.aiDecision === "sim";
    if (!shouldCreate) return;

    const [funnelSetting] = await db
      .select()
      .from(systemSettings)
      .where(eq(systemSettings.key, "telemarketing_default_funnel_id"));
    const funnelId = funnelSetting?.value;
    if (!funnelId) {
      console.warn(
        "[call-interaction] telemarketing_default_funnel_id não configurado — skip deal",
      );
      return;
    }

    // Importação dinâmica para evitar ciclo de dependência via schema
    const { deals, funnelStages } = await import("@shared/schema");

    // Primeiro estágio do funil
    const [firstStage] = await db
      .select()
      .from(funnelStages)
      .where(eq(funnelStages.funnelId, funnelId))
      .orderBy(funnelStages.order)
      .limit(1);
    if (!firstStage) {
      console.warn(
        `[call-interaction] funil ${funnelId} sem estágios — skip deal`,
      );
      return;
    }

    const dealTitle = `Ligação convertida · #${call.id.slice(0, 8)}`;
    // Dedup: não criar 2 deals para a mesma call
    const existing = await db
      .select()
      .from(deals)
      .where(and(eq(deals.clientId, call.clientId), eq(deals.title, dealTitle)))
      .limit(1);
    if (existing.length > 0) return;

    await db.insert(deals).values({
      clientId: call.clientId,
      assignedTo: call.operatorId,
      createdBy: call.operatorId,
      funnelId,
      stageId: firstStage.id,
      title: dealTitle,
      value: "0",
    });
  } catch (e) {
    console.error("[call-interaction] maybeCreateDealFromCall error:", e);
  }
}

/**
 * Orquestrador chamado quando uma call entra em estado terminal.
 * Executa em paralelo as integrações com CRM.
 */
export async function onCallTerminal(callId: string): Promise<void> {
  await Promise.allSettled([
    syncCallToInteraction(callId),
    incrementTelemarketingWeeklyResult(callId),
    maybeCreateDealFromCall(callId),
  ]);
}
