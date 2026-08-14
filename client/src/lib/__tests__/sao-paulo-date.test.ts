import { describe, expect, it } from "vitest";

import {
  startOfTodayInSaoPaulo,
  todayInSaoPaulo,
} from "@shared/sao-paulo-date";

describe("calendário de São Paulo", () => {
  it("mantém o dia de São Paulo quando UTC já virou para o dia seguinte", () => {
    const now = new Date("2026-08-15T01:30:00.000Z");

    expect(todayInSaoPaulo(now)).toBe("2026-08-14");
    expect(startOfTodayInSaoPaulo(now).toISOString()).toBe(
      "2026-08-14T03:00:00.000Z",
    );
  });

  it("avança o corte exatamente na meia-noite de São Paulo", () => {
    const now = new Date("2026-08-15T03:00:00.000Z");

    expect(todayInSaoPaulo(now)).toBe("2026-08-15");
    expect(startOfTodayInSaoPaulo(now).toISOString()).toBe(
      "2026-08-15T03:00:00.000Z",
    );
  });
});
