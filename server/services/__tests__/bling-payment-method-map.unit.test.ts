import { describe, expect, it } from "vitest";
import { mapBlingTipoPagamentoToLocalMethod } from "../../../shared/bling-payment-method-map";

describe("mapBlingTipoPagamentoToLocalMethod", () => {
  it("mapeia os tipos conhecidos do Bling para o método local", () => {
    expect(mapBlingTipoPagamentoToLocalMethod(1)).toBe("dinheiro");
    expect(mapBlingTipoPagamentoToLocalMethod(3)).toBe("cartao_credito");
    expect(mapBlingTipoPagamentoToLocalMethod(4)).toBe("cartao_debito");
    expect(mapBlingTipoPagamentoToLocalMethod(17)).toBe("pix");
    expect(mapBlingTipoPagamentoToLocalMethod(20)).toBe("pix");
  });

  it("tipos não mapeados caem em outros", () => {
    for (const tipo of [2, 5, 10, 14, 15, 16, 18, 19, 21, 22, 90, 99, 0, -1]) {
      expect(mapBlingTipoPagamentoToLocalMethod(tipo)).toBe("outros");
    }
  });
});
