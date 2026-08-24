/**
 * Relatório de eventos por período.
 *
 * Alimenta o setor "Eventos do Mês" em Eventos → Análises e a geração de
 * relatório em PDF/Excel de um intervalo qualquer.
 *
 * Sobre datas: `events.event_date` é `timestamp` **sem** timezone e o processo
 * roda com `TZ=UTC` (`server/index.ts`), então o que está gravado é o horário
 * de parede em UTC. Por isso o filtro compara com um literal UTC explícito
 * (`::timestamp`) em vez de deixar o driver serializar um `Date` — assim o
 * recorte não depende do fuso do processo — e a exibição converte de volta
 * para São Paulo com `AT TIME ZONE`.
 */

import { sql } from "drizzle-orm";
import { db } from "../db";
import { saoPauloRange } from "@shared/sao-paulo-date";

export interface EventsReportRow {
  id: string;
  name: string;
  /** `YYYY-MM-DD` no calendário de São Paulo. */
  date: string;
  /** `HH:mm` em São Paulo. */
  time: string;
  location: string;
  category: string;
  status: string;
  statusLabel: string;
  pricingType: string;
  eventValue: number;
  maxCapacity: number | null;
  participantCount: number;
  attendedCount: number;
  /** `null` quando o evento não tem capacidade máxima definida. */
  occupancyPct: number | null;
  eventRevenue: number;
  wineRevenue: number;
  totalRevenue: number;
}

export interface EventsReportTotals {
  eventCount: number;
  cancelledCount: number;
  participantCount: number;
  attendedCount: number;
  eventRevenue: number;
  wineRevenue: number;
  totalRevenue: number;
  /** Média só dos eventos com capacidade máxima definida. */
  avgOccupancyPct: number | null;
}

export interface EventsReportData {
  from: string;
  to: string;
  events: EventsReportRow[];
  totals: EventsReportTotals;
}

export interface EventsReportScope {
  userId?: string;
  userRole?: string;
}

/**
 * Quem não é admin só enxerga os eventos que criou — a mesma regra de
 * `storage.getEvents`. Sem isto o relatório seria uma porta lateral para o
 * vendedor baixar a agenda inteira da empresa.
 */
function isRestrictedToOwnEvents(scope: EventsReportScope): boolean {
  return (
    scope.userRole !== "admin" &&
    scope.userRole !== "administrador" &&
    Boolean(scope.userId)
  );
}

export const EVENT_STATUS_LABELS: Record<string, string> = {
  planejado: "Planejado",
  ativo: "Ativo",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `true` se a string é uma data civil `YYYY-MM-DD` válida. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

/** Instante → literal `YYYY-MM-DD HH:mm:ss` em UTC, para casar com o gravado. */
function toUtcTimestampLiteral(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Converte as linhas cruas do Postgres em `EventsReportRow`.
 *
 * Separado da consulta porque toda a regra de arredondamento e de ocupação
 * mora aqui — é o que vale um teste unitário sem banco.
 */
export function normalizeEventsReportRows(
  rows: Record<string, unknown>[],
): EventsReportRow[] {
  return rows.map((raw) => {
    const status = String(raw.status ?? "");
    const participantCount = Math.round(toNumber(raw.participant_count));
    const maxCapacity =
      raw.max_capacity === null || raw.max_capacity === undefined
        ? null
        : Math.round(toNumber(raw.max_capacity));
    const eventRevenue = toNumber(raw.event_revenue);
    const wineRevenue = toNumber(raw.wine_revenue);

    return {
      id: String(raw.id ?? ""),
      name: String(raw.name ?? ""),
      date: String(raw.event_day ?? ""),
      time: String(raw.event_time ?? ""),
      location: String(raw.location ?? ""),
      category: String(raw.category ?? ""),
      status,
      statusLabel: EVENT_STATUS_LABELS[status] ?? status,
      pricingType: String(raw.pricing_type ?? "per_person"),
      eventValue: toNumber(raw.event_value),
      maxCapacity,
      participantCount,
      attendedCount: Math.round(toNumber(raw.attended_count)),
      occupancyPct:
        maxCapacity && maxCapacity > 0
          ? Math.round((participantCount / maxCapacity) * 1000) / 10
          : null,
      eventRevenue,
      wineRevenue,
      totalRevenue: eventRevenue + wineRevenue,
    };
  });
}

/**
 * Consolida os totais do período.
 *
 * Eventos cancelados aparecem na listagem (o usuário precisa saber que existiram)
 * mas não entram em nenhum total além de `cancelledCount` — a receita deles já
 * vem zerada da consulta.
 */
export function buildEventsReportTotals(
  rows: EventsReportRow[],
): EventsReportTotals {
  const active = rows.filter((r) => r.status !== "cancelado");
  const withCapacity = active.filter((r) => r.occupancyPct !== null);

  return {
    eventCount: active.length,
    cancelledCount: rows.length - active.length,
    participantCount: active.reduce((s, r) => s + r.participantCount, 0),
    attendedCount: active.reduce((s, r) => s + r.attendedCount, 0),
    eventRevenue: active.reduce((s, r) => s + r.eventRevenue, 0),
    wineRevenue: active.reduce((s, r) => s + r.wineRevenue, 0),
    totalRevenue: active.reduce((s, r) => s + r.totalRevenue, 0),
    avgOccupancyPct:
      withCapacity.length > 0
        ? Math.round(
            (withCapacity.reduce((s, r) => s + (r.occupancyPct ?? 0), 0) /
              withCapacity.length) *
              10,
          ) / 10
        : null,
  };
}

/**
 * Eventos do período `[from, to]` (datas civis de São Paulo, inclusive nas duas
 * pontas) com participantes e receita consolidados.
 */
export async function getEventsReport(
  from: string,
  to: string,
  scope: EventsReportScope = {},
): Promise<EventsReportData> {
  const range = saoPauloRange(from, to);
  const fromTs = toUtcTimestampLiteral(range.from);
  const toTs = toUtcTimestampLiteral(range.to);
  const ownerFilter = isRestrictedToOwnEvents(scope)
    ? sql`AND e.created_by = ${scope.userId}`
    : sql``;

  const result = await db.execute(sql`
    SELECT
      e.id,
      e.name,
      TO_CHAR(e.event_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS event_day,
      TO_CHAR(e.event_date AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') AS event_time,
      e.location,
      e.category,
      e.status,
      e.pricing_type,
      e.event_value::numeric AS event_value,
      e.max_capacity,
      CASE WHEN e.status = 'cancelado' THEN 0
           ELSE COALESCE(e.wine_revenue::numeric, 0) END AS wine_revenue,
      COALESCE(
        SUM(ep.number_of_participants) FILTER (WHERE ep.status <> 'cancelado'),
        0
      )::int AS participant_count,
      COALESCE(
        SUM(ep.number_of_participants)
          FILTER (WHERE ep.status <> 'cancelado' AND ep.attended IS TRUE),
        0
      )::int AS attended_count,
      CASE
        WHEN e.status = 'cancelado' THEN 0
        WHEN e.pricing_type = 'total' THEN e.event_value::numeric
        ELSE COALESCE(SUM(
          CASE WHEN ep.status IN ('pago', 'pagar_na_hora') THEN
            COALESCE(
              ep.custom_price::numeric,
              ep.number_of_participants::numeric * e.event_value::numeric
            )
          ELSE 0 END
        ), 0)
      END AS event_revenue
    FROM events e
    LEFT JOIN event_participants ep ON ep.event_id = e.id
    WHERE e.event_date >= ${fromTs}::timestamp
      AND e.event_date <= ${toTs}::timestamp
      ${ownerFilter}
    GROUP BY e.id
    ORDER BY e.event_date ASC
  `);

  const events = normalizeEventsReportRows(
    (result.rows ?? []) as Record<string, unknown>[],
  );

  return { from, to, events, totals: buildEventsReportTotals(events) };
}
