import { describe, it, expect } from "vitest";
import { parseBRL } from "@/lib/utils";

describe("parseBRL", () => {
  it("lê o formato pt-BR completo, com milhar e decimal", () => {
    expect(parseBRL("1.234,56")).toBe(1234.56);
    expect(parseBRL("1.234.567,89")).toBe(1234567.89);
  });

  /**
   * A regressão que motivou a função: `.replace(",", ".")` troca só a primeira
   * vírgula, então "1.234,56" virava "1.234.56" → NaN. O NaN passava por
   * `toCents` (NaN < 0 é falso) e só explodia no insert, como erro 500 sem
   * explicação para o operador.
   */
  it("não devolve NaN para valor com separador de milhar", () => {
    expect(parseBRL("1.234,56")).not.toBeNaN();
    expect(Number("1.234,56".replace(",", "."))).toBeNaN();
  });

  it("aceita vírgula decimal sem separador de milhar", () => {
    expect(parseBRL("1234,56")).toBe(1234.56);
    expect(parseBRL("0,05")).toBe(0.05);
  });

  it("trata ponto com 1–2 decimais como separador decimal", () => {
    expect(parseBRL("12.5")).toBe(12.5);
    expect(parseBRL("12.50")).toBe(12.5);
  });

  /**
   * O outro lado da ambiguidade: quem digita "1.234" num campo de dinheiro
   * quer mil duzentos e trinta e quatro, não um e pouco. Antes isso passava
   * como 1.234 e aplicava um desconto mil vezes menor sem avisar ninguém.
   */
  it("trata ponto com 3 decimais como separador de milhar", () => {
    expect(parseBRL("1.234")).toBe(1234);
    expect(parseBRL("1.234.567")).toBe(1234567);
  });

  it("aceita número inteiro simples", () => {
    expect(parseBRL("1234")).toBe(1234);
    expect(parseBRL("0")).toBe(0);
  });

  it("ignora prefixo de moeda e espaços", () => {
    expect(parseBRL("R$ 1.234,56")).toBe(1234.56);
    expect(parseBRL("  99,90  ")).toBe(99.9);
  });

  it("devolve null para entrada vazia ou não numérica", () => {
    expect(parseBRL("")).toBeNull();
    expect(parseBRL("   ")).toBeNull();
    expect(parseBRL("abc")).toBeNull();
    expect(parseBRL("12abc")).toBeNull();
    expect(parseBRL("R$")).toBeNull();
  });

  it("devolve null para mais de uma vírgula", () => {
    expect(parseBRL("1,2,3")).toBeNull();
    expect(parseBRL("1.234,56,78")).toBeNull();
  });

  it("preserva o sinal negativo para o chamador decidir", () => {
    expect(parseBRL("-50,00")).toBe(-50);
  });

  /**
   * Separador solto não é número. Sem o guard de "ao menos um dígito", "."
   * sobrevivia à remoção de separadores e virava `Number("")` = 0 — uma
   * entrada vazia de conteúdo passando como valor zero válido.
   */
  it("devolve null para separador sem nenhum dígito", () => {
    expect(parseBRL(".")).toBeNull();
    expect(parseBRL(",")).toBeNull();
    expect(parseBRL("-")).toBeNull();
    expect(parseBRL("..,")).toBeNull();
    expect(parseBRL("R$ ,")).toBeNull();
  });

  it("nunca devolve NaN — entrada inválida vira null", () => {
    for (const input of ["", "abc", ".", ",", "-", "1,2,3", "R$ ,", "12abc"]) {
      const result = parseBRL(input);
      expect(result === null || Number.isFinite(result)).toBe(true);
    }
  });
});
