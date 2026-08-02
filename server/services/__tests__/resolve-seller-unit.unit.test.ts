import { describe, expect, it } from "vitest";

import { resolveSellerUnitId } from "../../middleware/resolve-seller-unit";

describe("resolveSellerUnitId", () => {
  it("sem mapeamento Bling nenhum retorna 'none'", () => {
    expect(resolveSellerUnitId([])).toEqual({ type: "none" });
  });

  it("um único mapeamento resolve para a unidade", () => {
    expect(resolveSellerUnitId(["unit-a"])).toEqual({ type: "unit", unitId: "unit-a" });
  });

  it("mapeamentos duplicados para a mesma unidade não são ambíguos", () => {
    expect(resolveSellerUnitId(["unit-a", "unit-a"])).toEqual({
      type: "unit",
      unitId: "unit-a",
    });
  });

  it("mapeamentos para unidades diferentes retornam 'ambiguous'", () => {
    expect(resolveSellerUnitId(["unit-a", "unit-b"])).toEqual({ type: "ambiguous" });
  });
});
