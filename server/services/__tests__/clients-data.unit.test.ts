import { describe, expect, it } from "vitest";

import {
  normalizeClientCreateData,
  normalizeClientUpdateData,
} from "../clients-data";

describe("normalizeClientCreateData", () => {
  it("aplica os defaults de categoria e origem quando não vêm no payload", () => {
    const result = normalizeClientCreateData({ name: "ana lima" });

    expect(result.categoria).toBe("Geral");
    expect(result.origem).toBe("Website");
  });

  it("normaliza nome e telefone", () => {
    const result = normalizeClientCreateData({
      name: "  JOÃO da SILVA ",
      phone: "(11) 98765-4321",
    });

    expect(result.name).toBe("João Da Silva");
    expect(result.phone).toBe("+5511987654321");
  });

  it("mantém o telefone original quando não dá para normalizar, para o Zod recusar", () => {
    const result = normalizeClientCreateData({ name: "Ana", phone: "123" });

    expect(result.phone).toBe("123");
  });

  it("atribui o cliente a quem está criando quando o usuário não é admin", () => {
    const result = normalizeClientCreateData(
      { name: "Ana" },
      "user-1",
      "vendedor",
    );

    expect(result.responsavelId).toBe("user-1");
  });
});

describe("normalizeClientUpdateData", () => {
  it("não reatribui o responsável numa edição feita por vendedor", () => {
    // Regressão: qualquer edição parcial de um vendedor transferia a carteira
    // do cliente para ele, mesmo sem o campo aparecer no formulário.
    const result = normalizeClientUpdateData(
      { name: "Ana", responsavelId: "vendedor-que-editou" },
      "vendedor",
    );

    expect(result).not.toHaveProperty("responsavelId");
  });

  it("não reatribui o responsável quando o campo nem veio no payload", () => {
    const result = normalizeClientUpdateData({ email: "a@b.com" }, "admin");

    expect(result).not.toHaveProperty("responsavelId");
  });

  it("permite que admin e gerente troquem o responsável", () => {
    for (const role of ["admin", "gerente"]) {
      const result = normalizeClientUpdateData(
        { responsavelId: "outro-vendedor" },
        role,
      );

      expect(result.responsavelId).toBe("outro-vendedor");
    }
  });

  it("converte responsável vazio em null quando quem edita pode reatribuir", () => {
    const result = normalizeClientUpdateData({ responsavelId: "" }, "admin");

    expect(result.responsavelId).toBeNull();
  });

  it("descarta categoria e origem vazias em vez de sobrescrever o valor atual", () => {
    // Ambas são NOT NULL no banco e o schema de update é parcial: gravar ""
    // apagaria a informação boa do cliente.
    const result = normalizeClientUpdateData(
      { name: "Ana", categoria: "", origem: "" },
      "admin",
    );

    expect(result).not.toHaveProperty("categoria");
    expect(result).not.toHaveProperty("origem");
  });

  it("preserva categoria e origem quando preenchidas", () => {
    const result = normalizeClientUpdateData(
      { categoria: "VIP", origem: "Indicação" },
      "admin",
    );

    expect(result.categoria).toBe("VIP");
    expect(result.origem).toBe("Indicação");
  });

  it("converte strings vazias em null para cpf, email e telefones", () => {
    const result = normalizeClientUpdateData(
      { cpf: "", email: "", phone: "", fixedPhone: "" },
      "admin",
    );

    expect(result.cpf).toBeNull();
    expect(result.email).toBeNull();
    expect(result.phone).toBeNull();
    expect(result.fixedPhone).toBeNull();
  });
});
