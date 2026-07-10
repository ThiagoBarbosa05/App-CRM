import { db } from "../db";
import {
  cashbackTransactions,
  clients,
  type CashbackTransaction,
} from "@shared/schema";
import { eq, and, gte, lt } from "drizzle-orm";
import { addDays, startOfDay, format } from "date-fns";
import {
  listActiveAutomationRulesByTrigger,
} from "./automation-rules.service";
import {
  dispatchAutomationRule,
  hasSuccessfulDispatch,
} from "./automation-send.service";

function formatCurrency(value: string | number): string {
  const numeric = typeof value === "string" ? parseFloat(value) : value;
  return numeric.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(date: Date | string | null): string {
  if (!date) return "";
  const parsed = typeof date === "string" ? new Date(date) : date;
  return format(parsed, "dd/MM/yyyy");
}

/**
 * Dispara as regras de automação ativas com gatilho "cashback_earned" para o
 * cliente da transação de cashback recém-criada, notificando-o do valor
 * ganho por SMS e/ou e-mail conforme configurado em cada regra.
 */
export async function dispatchCashbackEarnedAutomation(
  transaction: CashbackTransaction,
): Promise<void> {
  try {
    const rules = await listActiveAutomationRulesByTrigger("cashback_earned");
    if (rules.length === 0) return;

    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, transaction.clientId));
    if (!client) return;

    const variables = {
      nome: client.name,
      valor: formatCurrency(transaction.cashbackAmount),
      data: formatDate(transaction.expiresAt),
    };

    for (const rule of rules) {
      const dedupeKey = `cashback_earned:${rule.id}:${transaction.id}`;
      if (await hasSuccessfulDispatch(dedupeKey)) continue;

      await dispatchAutomationRule({
        rule,
        clientId: client.id,
        to: { phone: client.phone, email: client.email },
        variables,
        dedupeKey,
      });
    }
  } catch (error) {
    console.error(
      "[CashbackAutomation] Erro ao disparar automação de cashback ganho:",
      error,
    );
  }
}

/**
 * Job diário: para cada regra ativa com gatilho "cashback_expiring", verifica
 * quais transações de cashback aprovadas vencem exatamente em
 * `triggerParams.daysBeforeExpiry` dias a partir de hoje e dispara o lembrete
 * correspondente, evitando reenvio via dedupeKey (regra + transação).
 */
export async function runCashbackExpiringReminders(
  referenceDate: Date = new Date(),
): Promise<{ rulesChecked: number; transactionsChecked: number; sent: number }> {
  const rules = await listActiveAutomationRulesByTrigger("cashback_expiring");
  let transactionsChecked = 0;
  let sent = 0;

  for (const rule of rules) {
    const daysBeforeExpiry = Number(
      (rule.triggerParams as Record<string, unknown> | null)?.daysBeforeExpiry,
    );
    if (!Number.isFinite(daysBeforeExpiry) || daysBeforeExpiry < 0) {
      console.warn(
        `[CashbackAutomation] Regra ${rule.id} sem daysBeforeExpiry válido em triggerParams. Pulando.`,
      );
      continue;
    }

    const targetDayStart = addDays(startOfDay(referenceDate), daysBeforeExpiry);
    const targetDayEnd = addDays(targetDayStart, 1);

    const rows = await db
      .select({
        transaction: cashbackTransactions,
        client: clients,
      })
      .from(cashbackTransactions)
      .innerJoin(clients, eq(cashbackTransactions.clientId, clients.id))
      .where(
        and(
          eq(cashbackTransactions.status, "approved"),
          gte(cashbackTransactions.expiresAt, targetDayStart),
          lt(cashbackTransactions.expiresAt, targetDayEnd),
        ),
      );

    transactionsChecked += rows.length;

    for (const { transaction, client } of rows) {
      const dedupeKey = `cashback_expiring:${rule.id}:${transaction.id}`;
      if (await hasSuccessfulDispatch(dedupeKey)) continue;

      const variables = {
        nome: client.name,
        valor: formatCurrency(transaction.cashbackAmount),
        data: formatDate(transaction.expiresAt),
      };

      await dispatchAutomationRule({
        rule,
        clientId: client.id,
        to: { phone: client.phone, email: client.email },
        variables,
        dedupeKey,
      });
      sent++;
    }
  }

  return { rulesChecked: rules.length, transactionsChecked, sent };
}
