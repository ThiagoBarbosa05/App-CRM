import { describe, it, expect } from "vitest";
import {
  buildCancellationsReport,
  summarizeCancellations,
  type CancelledItemInput,
} from "../../../shared/restaurant-cancellations";

function item(over: Partial<CancelledItemInput> = {}): CancelledItemInput {
  return {
    itemId: "i1",
    itemName: "Picanha",
    unitPrice: "100.00",
    quantity: 1,
    orderNumber: 1,
    tableNumber: 5,
    cancelReason: "cliente desistiu",
    cancelledById: "u1",
    cancelledByName: "Ana",
    cancelledAt: "2026-07-21T20:00:00Z",
    ...over,
  };
}

describe("summarizeCancellations", () => {
  it("soma valor e quantidade considerando a quantidade do item", () => {
    const summary = summarizeCancellations([
      item({ itemId: "i1", unitPrice: "50.00", quantity: 3 }),
      item({ itemId: "i2", unitPrice: "25.50", quantity: 2 }),
    ]);

    expect(summary.itemCount).toBe(5);
    expect(summary.total).toBe("201.00");
  });

  it("agrupa por quem cancelou, do maior valor para o menor", () => {
    const summary = summarizeCancellations([
      item({ itemId: "i1", cancelledById: "u1", cancelledByName: "Ana", unitPrice: "10.00" }),
      item({ itemId: "i2", cancelledById: "u2", cancelledByName: "Bruno", unitPrice: "90.00" }),
      item({ itemId: "i3", cancelledById: "u1", cancelledByName: "Ana", unitPrice: "20.00" }),
    ]);

    expect(summary.byUser.map((u) => u.userName)).toEqual(["Bruno", "Ana"]);
    expect(summary.byUser[0].total).toBe("90.00");
    expect(summary.byUser[1].total).toBe("30.00");
    expect(summary.byUser[1].itemCount).toBe(2);
  });

  it("calcula a fatia de cada operador no valor cancelado", () => {
    const summary = summarizeCancellations([
      item({ itemId: "i1", cancelledById: "u1", unitPrice: "75.00" }),
      item({ itemId: "i2", cancelledById: "u2", unitPrice: "25.00" }),
    ]);

    expect(summary.byUser[0].sharePercent).toBe(75);
    expect(summary.byUser[1].sharePercent).toBe(25);
  });

  it("não divide por zero quando os itens cancelados valem zero", () => {
    const summary = summarizeCancellations([item({ unitPrice: "0.00" })]);

    expect(summary.total).toBe("0.00");
    expect(summary.byUser[0].sharePercent).toBe(0);
  });

  it("agrupa ator nulo em vez de descartar o valor cancelado", () => {
    const summary = summarizeCancellations([
      item({ itemId: "i1", cancelledById: null, cancelledByName: null, unitPrice: "40.00" }),
    ]);

    expect(summary.total).toBe("40.00");
    expect(summary.byUser[0].userId).toBe("desconhecido");
    expect(summary.byUser[0].userName).toBe("—");
  });

  it("conta motivos ignorando caixa e espaço, e descarta o vazio", () => {
    const summary = summarizeCancellations([
      item({ itemId: "i1", cancelReason: "Cliente desistiu" }),
      item({ itemId: "i2", cancelReason: "  cliente desistiu " }),
      item({ itemId: "i3", cancelReason: "erro cozinha" }),
      item({ itemId: "i4", cancelReason: "   " }),
      item({ itemId: "i5", cancelReason: null }),
    ]);

    expect(summary.topReasons).toEqual([
      { reason: "cliente desistiu", count: 2 },
      { reason: "erro cozinha", count: 1 },
    ]);
  });

  it("devolve zeros para período sem cancelamento", () => {
    const summary = summarizeCancellations([]);

    expect(summary.itemCount).toBe(0);
    expect(summary.total).toBe("0.00");
    expect(summary.byUser).toEqual([]);
    expect(summary.topReasons).toEqual([]);
  });
});

describe("buildCancellationsReport", () => {
  /**
   * A regressão que esta função existe para travar: o total precisa sair do
   * período INTEIRO, não do recorte de exibição. Antes o controller agregava
   * sobre o array que a query já tinha cortado em 200, e o card mostrava um
   * valor menor que o real sem nenhum aviso.
   */
  it("agrega sobre o conjunto completo e trunca só a lista de itens", () => {
    const items = Array.from({ length: 250 }, (_, i) =>
      item({ itemId: `i${i}`, unitPrice: "10.00", quantity: 1 }),
    );

    const report = buildCancellationsReport(items, 200);

    expect(report.items).toHaveLength(200);
    expect(report.truncated).toBe(true);
    expect(report.totalItemRows).toBe(250);
    // 250 × R$ 10,00 — e não 200 × R$ 10,00
    expect(report.total).toBe("2500.00");
    expect(report.itemCount).toBe(250);
  });

  it("o ranking por operador também considera as linhas truncadas", () => {
    const items = [
      ...Array.from({ length: 3 }, (_, i) =>
        item({ itemId: `recente${i}`, cancelledById: "u1", cancelledByName: "Ana", unitPrice: "10.00" }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        item({ itemId: `antigo${i}`, cancelledById: "u2", cancelledByName: "Bruno", unitPrice: "10.00" }),
      ),
    ];

    // Só os 3 primeiros (todos da Ana) entram no detalhe; o ranking não pode
    // concluir que a Ana é quem mais cancela.
    const report = buildCancellationsReport(items, 3);

    expect(report.items).toHaveLength(3);
    expect(report.byUser.map((u) => u.userName)).toEqual(["Bruno", "Ana"]);
    expect(report.byUser[0].total).toBe("50.00");
  });

  it("abaixo do limite não marca truncamento", () => {
    const items = Array.from({ length: 5 }, (_, i) => item({ itemId: `i${i}` }));

    const report = buildCancellationsReport(items, 200);

    expect(report.items).toHaveLength(5);
    expect(report.truncated).toBe(false);
    expect(report.totalItemRows).toBe(5);
  });

  it("exatamente no limite não é truncado", () => {
    const items = Array.from({ length: 200 }, (_, i) => item({ itemId: `i${i}` }));

    const report = buildCancellationsReport(items, 200);

    expect(report.truncated).toBe(false);
    expect(report.items).toHaveLength(200);
  });

  it("período sem cancelamento devolve relatório vazio consistente", () => {
    const report = buildCancellationsReport([], 200);

    expect(report.items).toEqual([]);
    expect(report.truncated).toBe(false);
    expect(report.totalItemRows).toBe(0);
    expect(report.total).toBe("0.00");
  });
});
