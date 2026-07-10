import { db } from "../db";
import { clients, reengagementProgress, type Client } from "@shared/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { differenceInCalendarDays, format } from "date-fns";
import { listActiveAutomationRulesByTrigger } from "./automation-rules.service";
import {
  dispatchAutomationRule,
  hasSuccessfulDispatch,
} from "./automation-send.service";

interface InactiveClientRow {
  client_id: string;
  last_purchase_date: string;
  attempts_sent: number;
}

/**
 * Zera o progresso da régua de reengajamento de um cliente. Deve ser chamado
 * sempre que uma nova compra é registrada para o cliente (Bling ou Connect),
 * garantindo que ele volte a receber a sequência completa caso fique inativo
 * novamente no futuro.
 */
export async function resetReengagementProgress(clientId: string): Promise<void> {
  try {
    await db
      .insert(reengagementProgress)
      .values({ clientId, attemptsSent: 0, lastAttemptAt: null })
      .onConflictDoUpdate({
        target: reengagementProgress.clientId,
        set: { attemptsSent: 0, lastAttemptAt: null, updatedAt: new Date() },
      });
  } catch (error) {
    console.error(
      "[ReengagementAutomation] Erro ao zerar progresso de reengajamento:",
      error,
    );
  }
}

/** Busca, para cada cliente com histórico de compras, a data da última compra e o progresso atual da régua. */
async function getInactiveClients(): Promise<InactiveClientRow[]> {
  const result = await db.execute(sql`
    SELECT p.client_id AS client_id,
           MAX(p.sale_date)::text AS last_purchase_date,
           COALESCE(rp.attempts_sent, 0) AS attempts_sent
    FROM (
      SELECT app_client_id AS client_id, sale_date::date AS sale_date
      FROM bling_orders
      WHERE deleted_at IS NULL AND app_client_id IS NOT NULL
      UNION ALL
      SELECT app_client_id AS client_id, sale_date::date AS sale_date
      FROM connect_orders
      WHERE app_client_id IS NOT NULL
    ) p
    LEFT JOIN reengagement_progress rp ON rp.client_id = p.client_id
    GROUP BY p.client_id, rp.attempts_sent
  `);
  return result.rows as unknown as InactiveClientRow[];
}

function formatDate(date: Date | string | null): string {
  if (!date) return "";
  const parsed = typeof date === "string" ? new Date(date) : date;
  return format(parsed, "dd/MM/yyyy");
}

/**
 * Job diário: para cada cliente com compras registradas, verifica se ele já
 * está inativo o suficiente para receber a próxima tentativa da régua de
 * reengajamento (conforme regras ativas com gatilho "inactivity_reengagement",
 * cada uma representando uma etapa/tentativa com seu próprio intervalo de
 * dias e template). Respeita o número máximo de tentativas (maior
 * attemptNumber configurado com regra ativa) e nunca avança o progresso do
 * cliente além do que as regras configuradas permitem.
 */
export async function runInactivityReengagement(
  referenceDate: Date = new Date(),
): Promise<{ clientsChecked: number; sent: number }> {
  const rules = await listActiveAutomationRulesByTrigger("inactivity_reengagement");
  if (rules.length === 0) {
    return { clientsChecked: 0, sent: 0 };
  }

  const rulesByAttempt = new Map<number, (typeof rules)[number]>();
  for (const rule of rules) {
    const attemptNumber = Number(
      (rule.triggerParams as Record<string, unknown> | null)?.attemptNumber,
    );
    if (Number.isFinite(attemptNumber) && attemptNumber > 0) {
      rulesByAttempt.set(attemptNumber, rule);
    }
  }
  if (rulesByAttempt.size === 0) {
    return { clientsChecked: 0, sent: 0 };
  }

  const inactiveClients = await getInactiveClients();
  let sent = 0;

  for (const row of inactiveClients) {
    const nextAttempt = row.attempts_sent + 1;
    const rule = rulesByAttempt.get(nextAttempt);
    if (!rule) continue; // sem regra configurada para a próxima etapa: já atingiu o limite ou etapa desativada

    const inactivityDaysThreshold = Number(
      (rule.triggerParams as Record<string, unknown> | null)?.inactivityDays,
    );
    if (!Number.isFinite(inactivityDaysThreshold) || inactivityDaysThreshold < 0) {
      console.warn(
        `[ReengagementAutomation] Regra ${rule.id} sem inactivityDays válido em triggerParams. Pulando.`,
      );
      continue;
    }

    const daysSincePurchase = differenceInCalendarDays(
      referenceDate,
      new Date(`${row.last_purchase_date}T00:00:00`),
    );
    if (daysSincePurchase < inactivityDaysThreshold) continue;

    const dedupeKey = `inactivity_reengagement:${rule.id}:${row.client_id}:${row.last_purchase_date}`;
    if (await hasSuccessfulDispatch(dedupeKey)) continue;

    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, row.client_id));
    if (!client) continue;

    const variables = {
      nome: client.name,
      dias: String(daysSincePurchase),
      data_ultima_compra: formatDate(row.last_purchase_date),
    };

    await dispatchAutomationRule({
      rule,
      clientId: client.id,
      to: { phone: client.phone, email: client.email },
      variables,
      dedupeKey,
    });

    await db
      .insert(reengagementProgress)
      .values({
        clientId: client.id,
        attemptsSent: nextAttempt,
        lastAttemptAt: referenceDate,
      })
      .onConflictDoUpdate({
        target: reengagementProgress.clientId,
        set: {
          attemptsSent: nextAttempt,
          lastAttemptAt: referenceDate,
          updatedAt: new Date(),
        },
      });

    sent++;
  }

  return { clientsChecked: inactiveClients.length, sent };
}
