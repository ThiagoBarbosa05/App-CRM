/**
 * "Hoje" e janelas de dia em America/Sao_Paulo.
 *
 * Vive em `shared/` porque a MESMA data precisa valer nos dois lados: o front
 * usa para preencher os filtros de período, e os controllers usam como default
 * quando a query não manda `date`/`from`/`to`. Derivar cada um por conta
 * própria é como o filtro abria num dia e a consulta rodava em outro.
 *
 * O bug que isto corrige: `new Date().toISOString().slice(0,10)` devolve a data
 * em **UTC**. Entre 21:00 e 23:59 em São Paulo o UTC já virou o dia seguinte,
 * então no pico do restaurante a tela abria em "amanhã" e mostrava R$ 0,00 com
 * o salão cheio.
 *
 * Usa `Intl` + locale `sv-SE` (que já formata como ISO) em vez de
 * `date-fns-tz`, que não é dependência do projeto — mesma técnica de
 * `convertUTCToLocalDatetime` em `client/src/lib/utils.ts`.
 */

import { format, parseISO, subDays } from "date-fns";

export const SAO_PAULO_TZ = "America/Sao_Paulo";

const isoDateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: SAO_PAULO_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data civil de hoje em São Paulo, `YYYY-MM-DD`. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return isoDateFormatter.format(now);
}

/** Instante correspondente a 00:00 do dia civil atual em São Paulo. */
export function startOfTodayInSaoPaulo(now: Date = new Date()): Date {
  return saoPauloDayRange(todayInSaoPaulo(now)).from;
}

/**
 * `days` dias atrás, contados no calendário de São Paulo.
 *
 * Subtrai em cima da data civil, não do instante: assim o resultado não depende
 * da premissa de offset fixo que o resto do módulo assume.
 */
export function daysAgoInSaoPaulo(days: number, now: Date = new Date()): string {
  return format(subDays(parseISO(todayInSaoPaulo(now)), days), "yyyy-MM-dd");
}

/**
 * Janela que cobre o dia inteiro em São Paulo.
 *
 * O `.999` no fim não é detalhe: sem ele, `lte(closedAt, to)` com `to` em
 * `00:00:00` descarta o dia inteiro de vendas.
 *
 * O offset é fixo em -03:00 — São Paulo não tem horário de verão desde 2019.
 * É a mesma premissa já documentada em `restaurant-reports.service.ts`.
 */
export function saoPauloDayRange(dateIso: string): { from: Date; to: Date } {
  return {
    from: new Date(`${dateIso}T00:00:00-03:00`),
    to: new Date(`${dateIso}T23:59:59.999-03:00`),
  };
}

/** Janela do começo de `fromIso` ao fim de `toIso`, em São Paulo. */
export function saoPauloRange(fromIso: string, toIso: string): { from: Date; to: Date } {
  return {
    from: saoPauloDayRange(fromIso).from,
    to: saoPauloDayRange(toIso).to,
  };
}
