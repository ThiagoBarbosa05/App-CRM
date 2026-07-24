import { describe, expect, it } from "vitest";
import { canonicalPhone, phoneVariants, isSameChannelPhone } from "../../lib/phone";

describe("canonicalPhone", () => {
  it("acrescenta o DDI 55 quando falta", () => {
    expect(canonicalPhone("21988887777")).toBe("5521988887777");
  });

  it("preserva o número quando já vem com DDI e formatação", () => {
    expect(canonicalPhone("+55 (21) 98888-7777")).toBe("5521988887777");
  });

  it("insere o 9º dígito em celular no formato antigo (DDD + 8 dígitos)", () => {
    expect(canonicalPhone("2188887777")).toBe("5521988887777");
    expect(canonicalPhone("552188887777")).toBe("5521988887777");
  });

  it("NÃO insere o 9 em telefone fixo", () => {
    expect(canonicalPhone("2133334444")).toBe("552133334444");
  });

  it("cai para os dígitos crus quando o número não é BR reconhecível", () => {
    expect(canonicalPhone("+1 202 555")).toBe("1202555");
  });

  it("retorna string vazia para entrada vazia", () => {
    expect(canonicalPhone(null)).toBe("");
    expect(canonicalPhone(undefined)).toBe("");
    expect(canonicalPhone("")).toBe("");
  });
});

describe("phoneVariants", () => {
  it("cobre as quatro formas do mesmo celular (com/sem 55, com/sem o 9)", () => {
    const variants = phoneVariants("5521988887777");
    expect(variants).toEqual(
      expect.arrayContaining(["5521988887777", "21988887777", "552188887777", "2188887777"]),
    );
  });

  it("gera o mesmo conjunto partindo da forma antiga sem o 9", () => {
    const fromLegacy = new Set(phoneVariants("2188887777"));
    for (const v of phoneVariants("5521988887777")) {
      expect(fromLegacy.has(v)).toBe(true);
    }
  });

  it("sempre inclui os dígitos crus da entrada", () => {
    expect(phoneVariants("+55 (21) 98888-7777")).toContain("5521988887777");
  });

  it("retorna lista vazia para entrada sem dígitos", () => {
    expect(phoneVariants("abc")).toEqual([]);
    expect(phoneVariants(null)).toEqual([]);
  });
});

describe("isSameChannelPhone — variação do 9º dígito", () => {
  it("casa canal cadastrado sem o 9 com o JID que chega com o 9", () => {
    expect(isSameChannelPhone("2188887777", "5521988887777")).toBe(true);
  });

  it("continua não casando números realmente diferentes", () => {
    expect(isSameChannelPhone("2188887777", "5521999996666")).toBe(false);
  });
});
