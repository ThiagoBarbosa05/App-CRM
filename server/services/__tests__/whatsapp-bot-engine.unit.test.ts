import { describe, expect, it } from "vitest";

import {
  interpolate,
  isValidCpf,
  resolveMenuHandle,
  validateAnswer,
} from "../whatsapp-bot-engine.service";
import type { MenuNodeData, WhatsappBotNode } from "@shared/schema";

/**
 * Testes UNITÁRIOS da lógica pura de decisão do engine do bot.
 * Sem banco, sem rede, sem mocks — só entrada → saída.
 */

describe("interpolate", () => {
  it("substitui variáveis {{nome}} pelo valor", () => {
    expect(interpolate("Olá {{nome}}!", { nome: "Ana" })).toBe("Olá Ana!");
  });

  it("substitui múltiplas ocorrências", () => {
    expect(
      interpolate("{{a}}-{{b}}-{{a}}", { a: "1", b: "2" }),
    ).toBe("1-2-1");
  });

  it("mantém o placeholder quando a variável não existe", () => {
    expect(interpolate("Oi {{faltando}}", {})).toBe("Oi {{faltando}}");
  });

  it("não altera texto sem placeholders", () => {
    expect(interpolate("texto simples", { x: "y" })).toBe("texto simples");
  });
});

describe("isValidCpf", () => {
  it("aceita um CPF válido (com e sem máscara)", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("rejeita dígitos verificadores incorretos", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false);
  });

  it("rejeita tamanho inválido", () => {
    expect(isValidCpf("123")).toBe(false);
  });

  it("rejeita todos os dígitos iguais", () => {
    expect(isValidCpf("11111111111")).toBe(false);
  });
});

describe("validateAnswer", () => {
  it("aceita qualquer valor quando não há validação", () => {
    expect(validateAnswer("qualquer coisa", "none")).toBe(true);
    expect(validateAnswer("qualquer coisa", undefined)).toBe(true);
  });

  it("valida email", () => {
    expect(validateAnswer("a@b.com", "email")).toBe(true);
    expect(validateAnswer("sem-arroba", "email")).toBe(false);
  });

  it("valida cpf delegando para isValidCpf", () => {
    expect(validateAnswer("529.982.247-25", "cpf")).toBe(true);
    expect(validateAnswer("000.000.000-00", "cpf")).toBe(false);
  });

  it("valida telefone por quantidade mínima de dígitos", () => {
    expect(validateAnswer("(54) 99999-9999", "phone")).toBe(true);
    expect(validateAnswer("123", "phone")).toBe(false);
  });

  it("valida number (inteiro e decimal com , ou .)", () => {
    expect(validateAnswer("42", "number")).toBe(true);
    expect(validateAnswer("3,14", "number")).toBe(true);
    expect(validateAnswer("-7.5", "number")).toBe(true);
    expect(validateAnswer("abc", "number")).toBe(false);
  });

  it("valida date nos formatos ISO e BR", () => {
    expect(validateAnswer("2026-06-28", "date")).toBe(true);
    expect(validateAnswer("28/06/2026", "date")).toBe(true);
    expect(validateAnswer("28 de junho", "date")).toBe(false);
  });

  it("ignora espaços nas pontas", () => {
    expect(validateAnswer("  a@b.com  ", "email")).toBe(true);
  });
});

describe("resolveMenuHandle", () => {
  const menuNode = (options: MenuNodeData["options"]): WhatsappBotNode =>
    ({ data: { bodyText: "Escolha", options } } as unknown as WhatsappBotNode);

  const options: MenuNodeData["options"] = [
    { handle: "opt-sim", label: "Sim" },
    { handle: "opt-nao", label: "Não" },
  ];

  it("resolve pelo id do botão/linha (replyId)", () => {
    expect(resolveMenuHandle(menuNode(options), "texto qualquer", "opt-nao")).toBe(
      "opt-nao",
    );
  });

  it("resolve pelo label quando não há replyId", () => {
    expect(resolveMenuHandle(menuNode(options), "Sim")).toBe("opt-sim");
  });

  it("é case/space-insensitive no label", () => {
    expect(resolveMenuHandle(menuNode(options), "  não  ")).toBe("opt-nao");
  });

  it("retorna null quando a escolha não casa com nenhuma opção", () => {
    expect(resolveMenuHandle(menuNode(options), "talvez")).toBeNull();
  });
});
