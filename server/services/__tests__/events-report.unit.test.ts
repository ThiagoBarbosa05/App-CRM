import { describe, expect, it, vi } from "vitest";

// O serviço importa `../db` no topo só para a consulta; o que se testa aqui é a
// normalização e a consolidação, que são puras.
vi.mock("../../db", () => ({ db: { execute: vi.fn() } }));

import {
  buildEventsReportTotals,
  isIsoDate,
  normalizeEventsReportRows,
} from "../events-report.service";

function rawRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-1",
    name: "Degustação de Bordeaux",
    event_day: "2026-08-14",
    event_time: "19:30",
    location: "Loja Jardins",
    category: "Geral",
    status: "finalizado",
    pricing_type: "per_person",
    event_value: "150.00",
    max_capacity: 20,
    wine_revenue: "800.00",
    participant_count: 15,
    attended_count: 13,
    event_revenue: "2250.00",
    ...overrides,
  };
}

describe("normalizeEventsReportRows", () => {
  it("converte os numéricos que o Postgres devolve como string", () => {
    const [row] = normalizeEventsReportRows([rawRow()]);

    expect(row.eventValue).toBe(150);
    expect(row.wineRevenue).toBe(800);
    expect(row.eventRevenue).toBe(2250);
    expect(row.totalRevenue).toBe(3050);
    expect(row.statusLabel).toBe("Finalizado");
  });

  it("calcula ocupação com uma casa decimal", () => {
    const [row] = normalizeEventsReportRows([
      rawRow({ participant_count: 7, max_capacity: 30 }),
    ]);

    expect(row.occupancyPct).toBe(23.3);
  });

  it("deixa a ocupação nula quando o evento não tem capacidade máxima", () => {
    const [row] = normalizeEventsReportRows([rawRow({ max_capacity: null })]);

    expect(row.occupancyPct).toBeNull();
    expect(row.maxCapacity).toBeNull();
  });

  it("não divide por zero quando a capacidade é 0", () => {
    const [row] = normalizeEventsReportRows([rawRow({ max_capacity: 0 })]);

    expect(row.occupancyPct).toBeNull();
  });
});

describe("buildEventsReportTotals", () => {
  it("soma participantes e receita dos eventos ativos", () => {
    const rows = normalizeEventsReportRows([
      rawRow(),
      rawRow({
        id: "evt-2",
        participant_count: 10,
        attended_count: 10,
        max_capacity: 10,
        event_revenue: "1000.00",
        wine_revenue: "200.00",
      }),
    ]);

    const totals = buildEventsReportTotals(rows);

    expect(totals.eventCount).toBe(2);
    expect(totals.participantCount).toBe(25);
    expect(totals.attendedCount).toBe(23);
    expect(totals.eventRevenue).toBe(3250);
    expect(totals.wineRevenue).toBe(1000);
    expect(totals.totalRevenue).toBe(4250);
    // (75% + 100%) / 2
    expect(totals.avgOccupancyPct).toBe(87.5);
  });

  it("conta eventos cancelados à parte e os mantém fora dos totais", () => {
    const rows = normalizeEventsReportRows([
      rawRow(),
      rawRow({
        id: "evt-cancelado",
        status: "cancelado",
        participant_count: 40,
        attended_count: 0,
        event_revenue: "0",
        wine_revenue: "0",
      }),
    ]);

    const totals = buildEventsReportTotals(rows);

    expect(totals.eventCount).toBe(1);
    expect(totals.cancelledCount).toBe(1);
    expect(totals.participantCount).toBe(15);
    expect(totals.totalRevenue).toBe(3050);
  });

  it("devolve ocupação média nula quando nenhum evento tem capacidade", () => {
    const rows = normalizeEventsReportRows([rawRow({ max_capacity: null })]);

    expect(buildEventsReportTotals(rows).avgOccupancyPct).toBeNull();
  });

  it("zera tudo num período sem eventos", () => {
    const totals = buildEventsReportTotals([]);

    expect(totals.eventCount).toBe(0);
    expect(totals.totalRevenue).toBe(0);
    expect(totals.avgOccupancyPct).toBeNull();
  });
});

describe("isIsoDate", () => {
  it("aceita apenas datas civis YYYY-MM-DD", () => {
    expect(isIsoDate("2026-08-01")).toBe(true);
    expect(isIsoDate("2026-8-1")).toBe(false);
    expect(isIsoDate("01/08/2026")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});
