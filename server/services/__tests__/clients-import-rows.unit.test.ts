import { describe, expect, it } from "vitest";
import { normalizeImportRows, type ImportRow } from "../clients-import-rows";

/**
 * Os casos vieram da planilha real que motivou a funcionalidade
 * (`clientes malbec.xlsx`): duas colunas, telefones em formatos misturados e
 * algumas linhas sem número.
 */
function row(name: string, phone: string, rowNumber = 2): ImportRow {
  return { name, phone, rowNumber };
}

describe("normalizeImportRows", () => {
  it("aceita telefone com e sem DDI, sempre gravando em E.164", () => {
    const { valid, rejected } = normalizeImportRows([
      row("Gabriela Vieira Carvalho", "+5521982621122", 2),
      row("Samuel Castro", "21986425210", 3),
    ]);

    expect(rejected).toEqual([]);
    expect(valid.map((r) => r.phoneE164)).toEqual([
      "+5521982621122",
      "+5521986425210",
    ]);
  });

  it("insere o 9º dígito em celular antigo de 10 dígitos", () => {
    const { valid } = normalizeImportRows([row("Ana", "2182621122")]);
    expect(valid[0].phoneE164).toBe("+5521982621122");
  });

  it("descarta linha sem telefone", () => {
    const { valid, rejected } = normalizeImportRows([
      row("Thiago Simao Miller", "", 4),
    ]);

    expect(valid).toEqual([]);
    expect(rejected).toEqual([
      { rowNumber: 4, name: "Thiago Simao Miller", phone: "", reason: "missingPhone" },
    ]);
  });

  it("descarta telefone que não é número brasileiro válido", () => {
    const { valid, rejected } = normalizeImportRows([row("Ana", "12345", 7)]);

    expect(valid).toEqual([]);
    expect(rejected[0].reason).toBe("invalidPhone");
  });

  it("descarta linha sem nome antes de olhar o telefone", () => {
    const { valid, rejected } = normalizeImportRows([row("  ", "21982621122", 9)]);

    expect(valid).toEqual([]);
    expect(rejected[0].reason).toBe("missingName");
  });

  it("trata como repetido o mesmo telefone escrito de formas diferentes", () => {
    // Sem isso, a segunda linha viraria um INSERT que estoura
    // `clients_phone_unique` — ou, pior, um cliente duplicado.
    const { valid, rejected } = normalizeImportRows([
      row("Hanna Leal", "21995652555", 2),
      row("Hanna L.", "+5521995652555", 3),
      row("Hanna", "2195652555", 4),
    ]);

    expect(valid).toHaveLength(1);
    expect(valid[0].rowNumber).toBe(2);
    expect(rejected.map((r) => r.reason)).toEqual([
      "duplicateInFile",
      "duplicateInFile",
    ]);
  });

  it("apara espaços do nome e do telefone", () => {
    const { valid } = normalizeImportRows([row("  Ana Lima  ", " 21982621122 ")]);

    expect(valid[0].name).toBe("Ana Lima");
    expect(valid[0].phoneE164).toBe("+5521982621122");
  });

  it("preserva a ordem da planilha e o número da linha", () => {
    const { valid } = normalizeImportRows([
      row("A", "21982621122", 2),
      row("B", "", 3),
      row("C", "21986425210", 4),
    ]);

    expect(valid.map((r) => [r.name, r.rowNumber])).toEqual([
      ["A", 2],
      ["C", 4],
    ]);
  });

  it("devolve listas vazias para planilha sem linhas", () => {
    expect(normalizeImportRows([])).toEqual({ valid: [], rejected: [] });
  });
});
