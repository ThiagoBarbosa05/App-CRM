import { z } from "zod";

import { daysAgoInSaoPaulo, todayInSaoPaulo } from "../../../shared/sao-paulo-date";

/**
 * Validação do período dos relatórios do PDV.
 *
 * Regex e não `new Date(x)`: `new Date("2026-13-45")` é `Invalid Date`, que
 * antes chegava até o driver e virava um 500 genérico em vez de um 400 que
 * explica o problema. Mesmo motivo do enum validado em `list-orders`.
 */
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida — use o formato AAAA-MM-DD")
  // O formato passar não basta: "2026-13-45" e "2026-02-30" casam a regex.
  // O round-trip pega os dois — data inexistente ou vira `Invalid Date`, ou o
  // JS transborda para o mês seguinte e deixa de bater com a entrada.
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Data inexistente no calendário");

/**
 * Teto de janela. Não é cosmético: o relatório de cancelamentos agrega sobre o
 * período inteiro sem `LIMIT` para que o total não saia truncado, e é este
 * teto que mantém o volume lido sob controle.
 */
const MAX_RANGE_DAYS = 366;

const DAY_MS = 24 * 60 * 60 * 1000;

export const reportRangeSchema = z
  .object({
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .refine(
    ({ from, to }) => !from || !to || from <= to,
    { message: "O período inicial não pode ser posterior ao final." },
  )
  .refine(
    ({ from, to }) => {
      if (!from || !to) return true;
      const days = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS;
      return days <= MAX_RANGE_DAYS;
    },
    { message: `O período não pode passar de ${MAX_RANGE_DAYS} dias.` },
  );

export const reportDateSchema = z.object({ date: isoDate.optional() });

/** Período pedido, ou os últimos 7 dias em São Paulo. */
export function resolveReportRange(parsed: { from?: string; to?: string }): {
  fromIso: string;
  toIso: string;
} {
  return {
    fromIso: parsed.from ?? daysAgoInSaoPaulo(6),
    toIso: parsed.to ?? todayInSaoPaulo(),
  };
}
