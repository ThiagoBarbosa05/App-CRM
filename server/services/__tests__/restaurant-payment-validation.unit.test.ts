import { describe, expect, it } from "vitest";

import {
  calculateOrderTotals,
  fromCents,
  toCents,
  validatePaymentsAgainstTotal,
} from "../../../shared/restaurant-order-totals";
import { isOrderInUnit } from "../../../shared/restaurant-order-access";
import { splitEqualCents } from "../../../client/src/lib/split-bill";

describe("toCents — entrada monetária inválida", () => {
  it("converte decimal com ponto", () => {
    expect(toCents("33.34")).toBe(3334);
    expect(toCents("0.01")).toBe(1);
    expect(toCents(12.5)).toBe(1250);
  });

  it("aceita espaços em volta", () => {
    expect(toCents(" 10.00 ")).toBe(1000);
  });

  // O separador pt-BR é a vírgula, então este é o erro de digitação mais
  // provável do operador. Antes virava NaN e contaminava toda comparação.
  it("recusa vírgula como separador decimal", () => {
    expect(() => toCents("33,34")).toThrowError(/inválido/i);
  });

  it("recusa texto", () => {
    expect(() => toCents("abc")).toThrowError(/inválido/i);
  });

  // `Number("")` e `Number(null)` são 0 em JS — para dinheiro isso é ausência
  // de valor, não zero.
  it("recusa string vazia e nulo em vez de tratar como zero", () => {
    expect(() => toCents("")).toThrowError(/ausente/i);
    expect(() => toCents("   ")).toThrowError(/ausente/i);
    expect(() => toCents(null as unknown as string)).toThrowError(/ausente/i);
  });

  // O Postgres ACEITA 'NaN' numa coluna numeric, e 'NaN' > 0 é verdadeiro:
  // nenhum CHECK no banco barra esse valor. A defesa tem que estar aqui.
  it("recusa NaN e Infinity", () => {
    expect(() => toCents("NaN")).toThrowError(/inválido/i);
    expect(() => toCents(NaN)).toThrowError(/inválido/i);
    expect(() => toCents("Infinity")).toThrowError(/inválido/i);
  });

  it("marca o erro com código INVALID_AMOUNT", () => {
    expect(() => toCents("abc")).toThrowError(
      expect.objectContaining({ code: "INVALID_AMOUNT" }),
    );
  });
});

describe("validatePaymentsAgainstTotal", () => {
  it("aceita soma exata e devolve o método único", () => {
    const result = validatePaymentsAgainstTotal(
      [{ method: "pix", amount: "118.80" }],
      11880,
    );

    expect(result.paymentsTotalCents).toBe(11880);
    expect(result.finalPaymentMethod).toBe("pix");
  });

  it("devolve método nulo quando a conta foi dividida em formas diferentes", () => {
    const result = validatePaymentsAgainstTotal(
      [
        { method: "pix", amount: "60.00" },
        { method: "dinheiro", amount: "58.80" },
      ],
      11880,
    );

    expect(result.finalPaymentMethod).toBeNull();
  });

  it("mantém o método quando todas as pessoas pagaram do mesmo jeito", () => {
    const result = validatePaymentsAgainstTotal(
      [
        { method: "dinheiro", amount: "60.00" },
        { method: "dinheiro", amount: "58.80" },
      ],
      11880,
    );

    expect(result.finalPaymentMethod).toBe("dinheiro");
  });

  it("tolera 1 centavo — a sobra do rateio da divisão de conta", () => {
    expect(() =>
      validatePaymentsAgainstTotal([{ method: "pix", amount: "118.81" }], 11880),
    ).not.toThrow();
    expect(() =>
      validatePaymentsAgainstTotal([{ method: "pix", amount: "118.79" }], 11880),
    ).not.toThrow();
  });

  it("recusa divergência de 2 centavos", () => {
    expect(() =>
      validatePaymentsAgainstTotal([{ method: "pix", amount: "118.82" }], 11880),
    ).toThrowError(expect.objectContaining({ code: "PAYMENTS_MISMATCH" }));
  });

  // Regressão do defeito central: `toCents` devolvia NaN, e
  // `Math.abs(NaN - total) > 1` é `false` — a comparação que deveria barrar o
  // valor era justamente a que o deixava passar, fechando a comanda com
  // pagamento inválido.
  it("não deixa um valor inválido escapar pela comparação com NaN", () => {
    expect(() =>
      validatePaymentsAgainstTotal(
        [
          { method: "pix", amount: "60.00" },
          { method: "dinheiro", amount: "NaN" },
        ],
        11880,
      ),
    ).toThrowError(expect.objectContaining({ code: "INVALID_AMOUNT" }));

    expect(() =>
      validatePaymentsAgainstTotal([{ method: "pix", amount: "33,34" }], 11880),
    ).toThrowError(expect.objectContaining({ code: "INVALID_AMOUNT" }));
  });
});

describe("divisão de conta fecha com o total cobrado", () => {
  // Garante que o rateio nunca dispara PAYMENTS_MISMATCH por centavo perdido:
  // as duas funções são testadas separadamente, mas é a composição delas que
  // roda no fechamento.
  it("soma das partes bate com o total, para vários totais e nº de pessoas", () => {
    const unitPrices = ["10.00", "33.33", "0.07", "199.99", "1.01"];

    for (const unitPrice of unitPrices) {
      for (let quantity = 1; quantity <= 4; quantity++) {
        const { totalCents } = calculateOrderTotals({
          items: [{ unitPrice, quantity }],
          serviceFeePercent: "10.00",
        });

        for (let people = 2; people <= 13; people++) {
          const shares = splitEqualCents(totalCents, people);
          const rebuilt = shares.map((cents) => ({
            method: "dinheiro" as const,
            amount: fromCents(cents),
          }));

          expect(
            () => validatePaymentsAgainstTotal(rebuilt, totalCents),
            `${unitPrice} x${quantity} entre ${people} pessoas`,
          ).not.toThrow();
        }
      }
    }
  });
});

describe("isOrderInUnit — acesso por unidade", () => {
  it("permite a comanda da própria unidade", () => {
    expect(isOrderInUnit({ unitId: "unit-a" }, "unit-a")).toBe(true);
  });

  it("recusa a comanda de outra unidade", () => {
    expect(isOrderInUnit({ unitId: "unit-b" }, "unit-a")).toBe(false);
  });

  it("permite quando a requisição não tem contexto de unidade (painel admin)", () => {
    expect(isOrderInUnit({ unitId: "unit-b" }, undefined)).toBe(true);
    expect(isOrderInUnit({ unitId: "unit-b" }, null)).toBe(true);
  });

  it("permite comanda legada sem unidade, para não perder o histórico", () => {
    expect(isOrderInUnit({ unitId: null }, "unit-a")).toBe(true);
  });
});
