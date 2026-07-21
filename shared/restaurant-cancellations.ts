/**
 * Cancelamento de itens do PDV Restaurante — agregação pura, em centavos.
 *
 * O item cancelado é o vetor de desvio clássico do salão: lança, serve,
 * cancela antes de fechar a conta e fica com o dinheiro. Um cancelamento
 * isolado é rotina (cliente desistiu, cozinha errou); o que denuncia é o
 * **padrão** — sempre o mesmo operador, sempre o mesmo motivo.
 *
 * Por isso a agregação é por quem cancelou, não pelo total: o número que
 * importa não é "quanto se cancelou", é "quem cancela fora da curva".
 */

import { toCents, fromCents } from "./restaurant-order-totals";

export interface CancelledItemInput {
  itemId: string;
  itemName: string;
  unitPrice: string | number;
  quantity: number;
  orderNumber: number;
  tableNumber: number;
  cancelReason: string | null;
  cancelledById: string | null;
  cancelledByName: string | null;
  cancelledAt: string | Date | null;
}

export interface CancellationsByUser {
  userId: string;
  userName: string;
  itemCount: number;
  total: string;
  /** Fatia do valor cancelado no período. 0–100, uma casa. */
  sharePercent: number;
}

export interface CancellationsSummary {
  itemCount: number;
  total: string;
  byUser: CancellationsByUser[];
  /** Motivos mais repetidos — motivo vago em série é sinal por si só. */
  topReasons: { reason: string; count: number }[];
}

export function summarizeCancellations(
  items: CancelledItemInput[],
): CancellationsSummary {
  const totalCents = items.reduce(
    (sum, i) => sum + toCents(i.unitPrice) * i.quantity,
    0,
  );

  const byUser = new Map<string, { name: string; itemCount: number; cents: number }>();
  for (const item of items) {
    // Ator nulo só acontece em dado legado (antes de `cancelled_by` existir).
    // Agrupar como "—" é melhor que descartar: o valor cancelado continua real.
    const id = item.cancelledById ?? "desconhecido";
    const entry = byUser.get(id) ?? {
      name: item.cancelledByName ?? "—",
      itemCount: 0,
      cents: 0,
    };
    entry.itemCount += item.quantity;
    entry.cents += toCents(item.unitPrice) * item.quantity;
    byUser.set(id, entry);
  }

  const reasons = new Map<string, number>();
  for (const item of items) {
    const reason = (item.cancelReason ?? "").trim().toLowerCase();
    if (!reason) continue;
    reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }

  return {
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    total: fromCents(totalCents),
    byUser: Array.from(byUser.entries())
      .map(([userId, entry]) => ({
        userId,
        userName: entry.name,
        itemCount: entry.itemCount,
        total: fromCents(entry.cents),
        sharePercent:
          totalCents === 0 ? 0 : Math.round((entry.cents / totalCents) * 1000) / 10,
      }))
      .sort((a, b) => Number(b.total) - Number(a.total)),
    topReasons: Array.from(reasons.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}
