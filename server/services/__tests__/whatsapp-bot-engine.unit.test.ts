import { describe, expect, it } from "vitest";

import {
  interpolate,
  isValidCpf,
  pickDistributeHandle,
  resolveMenuHandle,
  resolveTransferAgent,
  resolveTransferSector,
  validateAnswer,
} from "../whatsapp-bot-engine.service";
import type { DistributeFlowOutput, MenuNodeData, TransferAgentNodeData, TransferSectorNodeData, WhatsappBotNode } from "@shared/schema";

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

describe("pickDistributeHandle", () => {
  const outputs: DistributeFlowOutput[] = [
    { handle: "a", percentage: 50 },
    { handle: "b", percentage: 50 },
  ];

  it("rng=0 cai no primeiro bucket", () => {
    expect(pickDistributeHandle(outputs, () => 0)).toBe("a");
  });

  it("rng=0.5 (exatamente no limite) cai no segundo bucket", () => {
    expect(pickDistributeHandle(outputs, () => 0.5)).toBe("b");
  });

  it("rng=0.99 cai no último bucket", () => {
    expect(pickDistributeHandle(outputs, () => 0.99)).toBe("b");
  });

  it("normaliza percentuais quando a soma não é 100", () => {
    const uneven: DistributeFlowOutput[] = [
      { handle: "x", percentage: 1 },
      { handle: "y", percentage: 3 },
    ];
    // total=4; x ocupa 0-0.25, y ocupa 0.25-1.0
    expect(pickDistributeHandle(uneven, () => 0)).toBe("x");
    expect(pickDistributeHandle(uneven, () => 0.25)).toBe("y");
    expect(pickDistributeHandle(uneven, () => 0.99)).toBe("y");
  });

  it("lista vazia retorna null", () => {
    expect(pickDistributeHandle([], () => 0.5)).toBeNull();
  });
});

describe("resolveTransferAgent", () => {
  const ctx = {
    currentConversationAgentId: "agent-current",
    clientPreviousAgentId: "agent-previous",
    attendantIds: ["att-1", "att-2", "att-3"],
    rng: () => 0,
  };

  it("specific: retorna o agentId configurado", () => {
    const data: TransferAgentNodeData = { rule: "specific", agentId: "agent-x" };
    expect(resolveTransferAgent(data, ctx)).toBe("agent-x");
  });

  it("specific: retorna null quando agentId não está configurado", () => {
    const data: TransferAgentNodeData = { rule: "specific" };
    expect(resolveTransferAgent(data, ctx)).toBeNull();
  });

  it("previous_same_conversation: retorna o agente da conversa atual", () => {
    const data: TransferAgentNodeData = { rule: "previous_same_conversation" };
    expect(resolveTransferAgent(data, ctx)).toBe("agent-current");
  });

  it("previous_same_conversation: retorna null quando conversa não tem agente", () => {
    const data: TransferAgentNodeData = { rule: "previous_same_conversation" };
    expect(resolveTransferAgent(data, { ...ctx, currentConversationAgentId: null })).toBeNull();
  });

  it("previous_conversation: retorna o agente da conversa anterior do cliente", () => {
    const data: TransferAgentNodeData = { rule: "previous_conversation" };
    expect(resolveTransferAgent(data, ctx)).toBe("agent-previous");
  });

  it("random: usa rng para escolher entre os atendentes", () => {
    const data: TransferAgentNodeData = { rule: "random" };
    expect(resolveTransferAgent(data, { ...ctx, rng: () => 0 })).toBe("att-1");
    expect(resolveTransferAgent(data, { ...ctx, rng: () => 0.99 })).toBe("att-3");
  });

  it("any_available: comportamento idêntico ao random", () => {
    const data: TransferAgentNodeData = { rule: "any_available" };
    expect(resolveTransferAgent(data, { ...ctx, rng: () => 0 })).toBe("att-1");
  });

  it("any_available: retorna null quando não há atendentes", () => {
    const data: TransferAgentNodeData = { rule: "any_available" };
    expect(resolveTransferAgent(data, { ...ctx, attendantIds: [] })).toBeNull();
  });
});

describe("resolveTransferSector", () => {
  const ctx = {
    currentConversationSectorId: "sector-current",
    clientPreviousSectorId: "sector-previous",
  };

  it("specific: retorna o sectorId configurado", () => {
    const data: TransferSectorNodeData = { rule: "specific", sectorId: "sector-x" };
    expect(resolveTransferSector(data, ctx)).toBe("sector-x");
  });

  it("specific: retorna null quando sectorId não está configurado", () => {
    const data: TransferSectorNodeData = { rule: "specific" };
    expect(resolveTransferSector(data, ctx)).toBeNull();
  });

  it("previous_same_conversation: retorna o setor da conversa atual", () => {
    const data: TransferSectorNodeData = { rule: "previous_same_conversation" };
    expect(resolveTransferSector(data, ctx)).toBe("sector-current");
  });

  it("previous_same_conversation: retorna null quando conversa não tem setor", () => {
    const data: TransferSectorNodeData = { rule: "previous_same_conversation" };
    expect(resolveTransferSector(data, { ...ctx, currentConversationSectorId: null })).toBeNull();
  });

  it("previous_conversation: retorna o setor da conversa anterior do cliente", () => {
    const data: TransferSectorNodeData = { rule: "previous_conversation" };
    expect(resolveTransferSector(data, ctx)).toBe("sector-previous");
  });
});
