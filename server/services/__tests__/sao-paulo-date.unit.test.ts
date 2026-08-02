import { describe, expect, it } from "vitest";

import {
  daysAgoInSaoPaulo,
  saoPauloDayRange,
  saoPauloRange,
  todayInSaoPaulo,
} from "../../../shared/sao-paulo-date";

describe("todayInSaoPaulo", () => {
  /**
   * O caso que motivou o helper, com dado real do banco: uma comanda fechada
   * em 2026-08-03T00:11:48.950Z foi fechada às 21:11 de 02/08 em São Paulo.
   * `toISOString().slice(0,10)` devolvia "2026-08-03" e o relatório do dia
   * saía vazio no horário de pico.
   */
  it("21h em São Paulo ainda é o dia corrente, mesmo com o UTC já virado", () => {
    expect(todayInSaoPaulo(new Date("2026-08-03T00:11:48.950Z"))).toBe("2026-08-02");
  });

  it("um instante antes da virada em SP ainda é o dia anterior", () => {
    // 02:59:59Z = 23:59:59 de 01/08 em SP
    expect(todayInSaoPaulo(new Date("2026-08-02T02:59:59.000Z"))).toBe("2026-08-01");
  });

  it("03:00Z é exatamente a virada do dia em SP", () => {
    expect(todayInSaoPaulo(new Date("2026-08-02T03:00:00.000Z"))).toBe("2026-08-02");
  });

  it("meio-dia UTC cai no mesmo dia civil", () => {
    expect(todayInSaoPaulo(new Date("2026-08-02T12:00:00.000Z"))).toBe("2026-08-02");
  });
});

describe("daysAgoInSaoPaulo", () => {
  it("conta 6 dias para trás no calendário de São Paulo", () => {
    expect(daysAgoInSaoPaulo(6, new Date("2026-08-02T12:00:00.000Z"))).toBe("2026-07-27");
  });

  it("atravessa a virada de mês", () => {
    expect(daysAgoInSaoPaulo(3, new Date("2026-08-02T12:00:00.000Z"))).toBe("2026-07-30");
  });

  it("parte do dia de SP, não do dia UTC", () => {
    // Em UTC já é 03/08; em SP ainda é 02/08, então 1 dia atrás é 01/08.
    expect(daysAgoInSaoPaulo(1, new Date("2026-08-03T00:11:48.950Z"))).toBe("2026-08-01");
  });

  it("zero dias devolve o próprio dia", () => {
    expect(daysAgoInSaoPaulo(0, new Date("2026-08-02T12:00:00.000Z"))).toBe("2026-08-02");
  });
});

describe("saoPauloDayRange", () => {
  it("cobre o dia inteiro, do primeiro ao último milissegundo", () => {
    const { from, to } = saoPauloDayRange("2026-08-02");
    expect(from.toISOString()).toBe("2026-08-02T03:00:00.000Z");
    expect(to.toISOString()).toBe("2026-08-03T02:59:59.999Z");
  });

  /**
   * O fim-de-dia é o que faz a comanda das 21h entrar no relatório do dia.
   * Se `to` voltasse a ser 00:00, este é o teste que quebra.
   */
  it("inclui uma comanda fechada às 21h de São Paulo", () => {
    const { from, to } = saoPauloDayRange("2026-08-02");
    const closedAt = new Date("2026-08-03T00:11:48.950Z");
    expect(closedAt >= from && closedAt <= to).toBe(true);
  });
});

describe("saoPauloRange", () => {
  it("vai do começo do primeiro dia ao fim do último", () => {
    const { from, to } = saoPauloRange("2026-07-27", "2026-08-02");
    expect(from.toISOString()).toBe("2026-07-27T03:00:00.000Z");
    expect(to.toISOString()).toBe("2026-08-03T02:59:59.999Z");
  });

  it("mesmo dia nos dois extremos ainda cobre o dia inteiro", () => {
    const { from, to } = saoPauloRange("2026-08-02", "2026-08-02");
    expect(from.toISOString()).toBe("2026-08-02T03:00:00.000Z");
    expect(to.toISOString()).toBe("2026-08-03T02:59:59.999Z");
  });
});
