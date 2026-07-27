import { describe, expect, it, vi } from "vitest";

vi.mock("../../integrations/bling", () => ({
  createBlingFinancialCategory: vi.fn(),
  getBlingFinancialCategories: vi.fn(),
  normalizeBlingCategoryStr: (value: string) =>
    value
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase(),
}));

vi.mock("../bling-connections.service", () => ({
  blingConnectionsService: {
    getById: vi.fn(),
    refreshConnection: vi.fn(),
  },
}));

import {
  buildFinancialCategoryPreview,
} from "../bling-financial-categories-migration.service";
import type { BlingFinancialCategory } from "../../integrations/bling";

function category(
  id: number,
  idCategoriaPai: number,
  descricao: string,
): BlingFinancialCategory {
  return { id, idCategoriaPai, descricao, tipo: 1 };
}

const baseParams = {
  sourceConnectionId: "11111111-1111-4111-8111-111111111111",
  sourceName: "Origem",
  targetConnectionId: "22222222-2222-4222-8222-222222222222",
  targetName: "Destino",
  generatedAt: "2026-07-27T12:00:00.000Z",
};

describe("buildFinancialCategoryPreview", () => {
  it("ordena uma árvore fora de ordem e preserva três níveis", () => {
    const preview = buildFinancialCategoryPreview({
      ...baseParams,
      sourceCategories: [
        category(30, 20, "Queijos"),
        category(10, 0, "CMV"),
        category(20, 10, "Insumos"),
      ],
      targetCategories: [category(100, 0, "CMV")],
    });

    expect(preview.canMigrate).toBe(true);
    expect(preview.totals).toMatchObject({
      total: 3,
      create: 2,
      reuse: 1,
      conflicts: 0,
      maxDepth: 2,
    });
    expect(preview.categories.map((item) => item.sourceId)).toEqual([
      10, 20, 30,
    ]);
    expect(preview.categories[2]?.path).toEqual(["CMV", "Insumos", "Queijos"]);
    expect(preview.tree[0]?.children[0]?.children[0]?.descricao).toBe("Queijos");
  });

  it("distingue nomes iguais quando os caminhos dos pais são diferentes", () => {
    const preview = buildFinancialCategoryPreview({
      ...baseParams,
      sourceCategories: [
        category(1, 0, "Operacional"),
        category(2, 1, "Taxas"),
        category(3, 0, "Administrativo"),
        category(4, 3, "Taxas"),
      ],
      targetCategories: [
        category(101, 0, "Operacional"),
        category(102, 101, "Taxas"),
        category(103, 0, "Administrativo"),
      ],
    });

    expect(
      preview.categories.find((item) => item.sourceId === 2)?.action,
    ).toBe("reuse");
    expect(
      preview.categories.find((item) => item.sourceId === 4)?.action,
    ).toBe("create");
  });

  it("bloqueia caminhos ambíguos no destino", () => {
    const preview = buildFinancialCategoryPreview({
      ...baseParams,
      sourceCategories: [category(1, 0, "Despesas")],
      targetCategories: [
        category(101, 0, "Despesas"),
        category(102, 0, " despesas "),
      ],
    });

    expect(preview.canMigrate).toBe(false);
    expect(preview.totals.conflicts).toBe(1);
    expect(preview.validations[0]).toContain("Mais de uma categoria");
  });

  it("detecta pai ausente e ciclo na origem", () => {
    const missingParent = buildFinancialCategoryPreview({
      ...baseParams,
      sourceCategories: [category(2, 999, "Órfã")],
      targetCategories: [],
    });
    expect(missingParent.canMigrate).toBe(false);
    expect(missingParent.validations.join(" ")).toContain("Pai 999");

    const cycle = buildFinancialCategoryPreview({
      ...baseParams,
      sourceCategories: [
        category(1, 2, "A"),
        category(2, 1, "B"),
      ],
      targetCategories: [],
    });
    expect(cycle.canMigrate).toBe(false);
    expect(cycle.validations.join(" ")).toContain("Ciclo detectado");
  });

  it("mantém fingerprint estável para a mesma árvore e muda com o destino", () => {
    const input = {
      ...baseParams,
      sourceCategories: [category(1, 0, "Despesas")],
      targetCategories: [],
    };
    const first = buildFinancialCategoryPreview(input);
    const second = buildFinancialCategoryPreview(input);
    const changed = buildFinancialCategoryPreview({
      ...input,
      targetCategories: [category(50, 0, "Despesas")],
    });

    expect(first.fingerprint).toBe(second.fingerprint);
    expect(changed.fingerprint).not.toBe(first.fingerprint);
  });

  it("não permite confirmar uma origem sem despesas", () => {
    const preview = buildFinancialCategoryPreview({
      ...baseParams,
      sourceCategories: [],
      targetCategories: [],
    });

    expect(preview.canMigrate).toBe(false);
    expect(preview.validations).toContain(
      "Nenhuma categoria de despesa foi encontrada na origem",
    );
  });
});
