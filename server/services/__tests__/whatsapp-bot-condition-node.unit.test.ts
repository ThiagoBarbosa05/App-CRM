import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../ai-helpers", () => ({
  classifyMessageIntent: vi.fn(async () => null),
}));

import {
  evaluateConditionRule,
  evaluateConditionRules,
  matchesConditionBranch,
  pickAttributeBranch,
  resolveAttributeHandle,
  resolveConditionHandle,
} from "../whatsapp-bot-engine.service";
import { classifyMessageIntent } from "../../ai-helpers";
import type {
  Client,
  ConditionBranch,
  ConditionNodeData,
  ConditionRule,
  WhatsappBotNode,
} from "../../../shared/schema";

/**
 * Testes UNITÁRIOS do nó de Condição (modos "reply" e "attribute").
 * Sem banco, sem rede — só a fronteira de IA (`classifyMessageIntent`) é mockada.
 */

const classifyMock = vi.mocked(classifyMessageIntent);

beforeEach(() => {
  classifyMock.mockReset();
  classifyMock.mockResolvedValue(null);
});

function conditionNode(data: ConditionNodeData): WhatsappBotNode {
  return { data } as unknown as WhatsappBotNode;
}

function branch(
  handle: string,
  keywords: string[] = [],
  rule?: ConditionRule,
): ConditionBranch {
  return { handle, label: handle, keywords, rule };
}

function client(overrides: Partial<Client> = {}): Client {
  return {
    id: "client-1",
    name: "",
    phone: null,
    fixedPhone: null,
    cpf: null,
    email: null,
    birthday: null,
    cep: null,
    address: null,
    number: null,
    complement: null,
    neighborhood: null,
    city: null,
    ...overrides,
  } as unknown as Client;
}

describe("resolveConditionHandle — modo reply", () => {
  it("casa por substring da keyword na mensagem", async () => {
    const node = conditionNode({
      branches: [branch("h-sim", ["sim"])],
      defaultHandle: "h-default",
    });
    expect(
      await resolveConditionHandle(node, "quero dizer sim para tudo"),
    ).toBe("h-sim");
  });

  it("é case-insensitive (mensagem maiúscula, keyword minúscula e vice-versa)", async () => {
    const node = conditionNode({
      branches: [branch("h-sim", ["SIM"])],
      defaultHandle: "h-default",
    });
    expect(await resolveConditionHandle(node, "sim")).toBe("h-sim");

    const node2 = conditionNode({
      branches: [branch("h-sim", ["sim"])],
      defaultHandle: "h-default",
    });
    expect(await resolveConditionHandle(node2, "SIM")).toBe("h-sim");
  });

  it("ignora espaços nas pontas da mensagem", async () => {
    const node = conditionNode({
      branches: [branch("h-sim", ["sim"])],
      defaultHandle: "h-default",
    });
    expect(await resolveConditionHandle(node, "   sim   ")).toBe("h-sim");
  });

  it("ramo com múltiplas keywords casa em qualquer uma delas", async () => {
    const node = conditionNode({
      branches: [branch("h-sim", ["sim", "claro", "positivo"])],
      defaultHandle: "h-default",
    });
    expect(await resolveConditionHandle(node, "claro que sim")).toBe("h-sim");
  });

  it("quando mais de um ramo poderia casar, vence o primeiro na ordem do array", async () => {
    const node = conditionNode({
      branches: [
        branch("h-primeiro", ["oi"]),
        branch("h-segundo", ["oi", "tchau"]),
      ],
      defaultHandle: "h-default",
    });
    expect(await resolveConditionHandle(node, "oi")).toBe("h-primeiro");
  });

  it("nenhuma keyword casa → retorna defaultHandle", async () => {
    const node = conditionNode({
      branches: [branch("h-sim", ["sim"])],
      defaultHandle: "h-default",
    });
    expect(await resolveConditionHandle(node, "não sei")).toBe("h-default");
  });

  it("defaultHandle ausente → retorna a string literal 'default'", async () => {
    const node = conditionNode({
      branches: [branch("h-sim", ["sim"])],
      defaultHandle: undefined as unknown as string,
    });
    expect(await resolveConditionHandle(node, "não sei")).toBe("default");
  });

  it("branches vazio → retorna defaultHandle", async () => {
    const node = conditionNode({ branches: [], defaultHandle: "h-default" });
    expect(await resolveConditionHandle(node, "qualquer coisa")).toBe(
      "h-default",
    );
  });

  it("useAI true e classificação por IA resolve um handle → retorna direto, sem checar keywords", async () => {
    classifyMock.mockResolvedValue("h-ia");
    const node = conditionNode({
      branches: [branch("h-sim", ["sim"])],
      defaultHandle: "h-default",
      useAI: true,
    });
    expect(
      await resolveConditionHandle(
        node,
        "mensagem que não bate com nenhuma keyword",
      ),
    ).toBe("h-ia");
  });

  it("useAI true e classificação retorna null → cai para keyword matching", async () => {
    classifyMock.mockResolvedValue(null);
    const node = conditionNode({
      branches: [branch("h-sim", ["sim"])],
      defaultHandle: "h-default",
      useAI: true,
    });
    expect(await resolveConditionHandle(node, "sim")).toBe("h-sim");
  });

  it("useAI true e classificação lança erro → captura e cai para keyword matching", async () => {
    classifyMock.mockRejectedValue(new Error("falha na IA"));
    const node = conditionNode({
      branches: [branch("h-sim", ["sim"])],
      defaultHandle: "h-default",
      useAI: true,
    });
    expect(await resolveConditionHandle(node, "sim")).toBe("h-sim");
  });

  it("useAI true mas branches vazio → não chama a IA, cai direto pro defaultHandle", async () => {
    const node = conditionNode({
      branches: [],
      defaultHandle: "h-default",
      useAI: true,
    });
    expect(await resolveConditionHandle(node, "qualquer coisa")).toBe(
      "h-default",
    );
    expect(classifyMock).not.toHaveBeenCalled();
  });

  it("useAI ausente/false → a IA nunca é chamada", async () => {
    const node = conditionNode({
      branches: [branch("h-sim", ["sim"])],
      defaultHandle: "h-default",
    });
    await resolveConditionHandle(node, "sim");
    expect(classifyMock).toHaveBeenCalledTimes(0);
  });
});

describe("evaluateConditionRule — campo message_contains", () => {
  it("bate quando a mensagem contém uma das keywords em rule.values", () => {
    const rule: ConditionRule = { field: "message_contains", operator: "contains", values: ["teste"] };
    expect(evaluateConditionRule(rule, { messageText: "teste", tagIds: new Set() })).toBe(true);
  });

  it("é case-insensitive e por substring", () => {
    const rule: ConditionRule = { field: "message_contains", operator: "contains", values: ["TESTE"] };
    expect(evaluateConditionRule(rule, { messageText: "isso é um teste rápido", tagIds: new Set() })).toBe(true);
  });

  it("casa em qualquer uma das keywords de rule.values", () => {
    const rule: ConditionRule = { field: "message_contains", operator: "contains", values: ["sim", "claro"] };
    expect(evaluateConditionRule(rule, { messageText: "claro que sim", tagIds: new Set() })).toBe(true);
  });

  it("usa rule.value como fallback quando rule.values está ausente", () => {
    const rule: ConditionRule = { field: "message_contains", operator: "contains", value: "teste" };
    expect(evaluateConditionRule(rule, { messageText: "teste", tagIds: new Set() })).toBe(true);
  });

  it("não bate quando a mensagem não contém nenhuma keyword", () => {
    const rule: ConditionRule = { field: "message_contains", operator: "contains", values: ["teste"] };
    expect(evaluateConditionRule(rule, { messageText: "outra coisa", tagIds: new Set() })).toBe(false);
  });

  it("sem keywords configuradas (values e value ausentes) → nunca bate", () => {
    const rule: ConditionRule = { field: "message_contains", operator: "contains" };
    expect(evaluateConditionRule(rule, { messageText: "qualquer coisa", tagIds: new Set() })).toBe(false);
  });

  it("sem messageText no contexto → nunca bate", () => {
    const rule: ConditionRule = { field: "message_contains", operator: "contains", values: ["teste"] };
    expect(evaluateConditionRule(rule, { tagIds: new Set() })).toBe(false);
  });
});

describe("evaluateConditionRules — grupo AND (data.rules, estilo Umbler)", () => {
  it("lista vazia nunca bate", () => {
    expect(evaluateConditionRules([], { messageText: "teste", tagIds: new Set() })).toBe(false);
  });

  it("uma única regra que bate → true", () => {
    const rules: ConditionRule[] = [{ field: "message_contains", operator: "contains", values: ["teste"] }];
    expect(evaluateConditionRules(rules, { messageText: "teste", tagIds: new Set() })).toBe(true);
  });

  it("todas as regras precisam bater (AND)", () => {
    const rules: ConditionRule[] = [
      { field: "message_contains", operator: "contains", values: ["teste"] },
      { field: "tag", operator: "has", value: "tag-1" },
    ];
    expect(
      evaluateConditionRules(rules, { messageText: "teste", tagIds: new Set(["tag-1"]) }),
    ).toBe(true);
    expect(
      evaluateConditionRules(rules, { messageText: "teste", tagIds: new Set(["tag-2"]) }),
    ).toBe(false);
  });
});

describe("resolveConditionHandle — grupo data.rules (editor atual do bot)", () => {
  it("regra message_contains bate com a mensagem → retorna 'match'", async () => {
    const node = conditionNode({
      branches: [],
      defaultHandle: "no_match",
      groupLabel: "Editar etiquetas",
      rules: [{ field: "message_contains", operator: "contains", values: ["teste"] }],
    });
    expect(await resolveConditionHandle(node, "teste")).toBe("match");
  });

  it("regra message_contains não bate → retorna defaultHandle (no_match)", async () => {
    const node = conditionNode({
      branches: [],
      defaultHandle: "no_match",
      rules: [{ field: "message_contains", operator: "contains", values: ["teste"] }],
    });
    expect(await resolveConditionHandle(node, "outra coisa")).toBe("no_match");
  });

  it("defaultHandle ausente e regra não bate → retorna a string literal 'default'", async () => {
    const node = conditionNode({
      branches: [],
      defaultHandle: undefined as unknown as string,
      rules: [{ field: "message_contains", operator: "contains", values: ["teste"] }],
    });
    expect(await resolveConditionHandle(node, "outra coisa")).toBe("default");
  });

  it("rules presente tem prioridade sobre branches/useAI (modelo legado é ignorado)", async () => {
    const node = conditionNode({
      branches: [branch("h-legado", ["teste"])],
      defaultHandle: "no_match",
      useAI: true,
      rules: [{ field: "message_contains", operator: "contains", values: ["teste"] }],
    });
    expect(await resolveConditionHandle(node, "teste")).toBe("match");
    expect(classifyMock).not.toHaveBeenCalled();
  });

  it("regra de tag usa o ctx.tagIds passado por quem chama", async () => {
    const node = conditionNode({
      branches: [],
      defaultHandle: "no_match",
      rules: [{ field: "tag", operator: "has", value: "tag-1" }],
    });
    expect(await resolveConditionHandle(node, "qualquer coisa", { tagIds: new Set(["tag-1"]) })).toBe(
      "match",
    );
    expect(await resolveConditionHandle(node, "qualquer coisa", { tagIds: new Set(["tag-2"]) })).toBe(
      "no_match",
    );
  });

  it("regra de tag sem ctx (não fornecido pelo chamador) nunca bate", async () => {
    const node = conditionNode({
      branches: [],
      defaultHandle: "no_match",
      rules: [{ field: "tag", operator: "has", value: "tag-1" }],
    });
    expect(await resolveConditionHandle(node, "qualquer coisa")).toBe("no_match");
  });
});

describe("matchesConditionBranch — modo attribute, campo tag", () => {
  it("has: true quando a tag está presente", () => {
    const b = branch("h", [], {
      field: "tag",
      operator: "has",
      value: "tag-1",
    });
    expect(matchesConditionBranch(b, client(), new Set(["tag-1"]))).toBe(true);
  });

  it("has: false quando a tag está ausente", () => {
    const b = branch("h", [], {
      field: "tag",
      operator: "has",
      value: "tag-1",
    });
    expect(matchesConditionBranch(b, client(), new Set(["tag-2"]))).toBe(false);
  });

  it("not_has: false quando a tag está presente", () => {
    const b = branch("h", [], {
      field: "tag",
      operator: "not_has",
      value: "tag-1",
    });
    expect(matchesConditionBranch(b, client(), new Set(["tag-1"]))).toBe(false);
  });

  it("not_has: true quando a tag está ausente", () => {
    const b = branch("h", [], {
      field: "tag",
      operator: "not_has",
      value: "tag-1",
    });
    expect(matchesConditionBranch(b, client(), new Set(["tag-2"]))).toBe(true);
  });

  it("value vazio/ausente: has é sempre false; not_has é sempre true (caso de borda)", () => {
    const has = branch("h", [], { field: "tag", operator: "has" });
    const notHas = branch("h", [], { field: "tag", operator: "not_has" });
    expect(matchesConditionBranch(has, client(), new Set(["tag-1"]))).toBe(
      false,
    );
    expect(matchesConditionBranch(notHas, client(), new Set(["tag-1"]))).toBe(
      true,
    );
  });

  it("operador não reconhecido no campo tag (ex.: has_all) se comporta hoje igual a 'has'", () => {
    const b = branch("h", [], {
      field: "tag",
      operator: "has_all",
      value: "tag-1",
    });
    expect(matchesConditionBranch(b, client(), new Set(["tag-1"]))).toBe(true);
    expect(matchesConditionBranch(b, client(), new Set(["tag-2"]))).toBe(false);
  });
});

describe("matchesConditionBranch — modo attribute, campos não-tag", () => {
  it("equals: bate ignorando maiúsculas/minúsculas e espaços", () => {
    const b = branch("h", [], {
      field: "name",
      operator: "equals",
      value: "  Ana  ",
    });
    expect(matchesConditionBranch(b, client({ name: "ana" }), new Set())).toBe(
      true,
    );
  });

  it("equals: não bate em valor diferente", () => {
    const b = branch("h", [], {
      field: "name",
      operator: "equals",
      value: "Ana",
    });
    expect(
      matchesConditionBranch(b, client({ name: "Bruno" }), new Set()),
    ).toBe(false);
  });

  it("equals: campo null e target vazio → true (ambos normalizam para '')", () => {
    const b = branch("h", [], {
      field: "email",
      operator: "equals",
      value: "",
    });
    expect(matchesConditionBranch(b, client({ email: null }), new Set())).toBe(
      true,
    );
  });

  it("contains: bate por substring case-insensitive", () => {
    const b = branch("h", [], {
      field: "email",
      operator: "contains",
      value: "GMAIL",
    });
    expect(
      matchesConditionBranch(b, client({ email: "ana@gmail.com" }), new Set()),
    ).toBe(true);
  });

  it("contains: target vazio nunca bate, mesmo com campo preenchido", () => {
    const b = branch("h", [], {
      field: "email",
      operator: "contains",
      value: "",
    });
    expect(
      matchesConditionBranch(b, client({ email: "ana@gmail.com" }), new Set()),
    ).toBe(false);
  });

  it("is_empty: true quando o campo é string vazia ou só espaços", () => {
    const b = branch("h", [], { field: "name", operator: "is_empty" });
    expect(matchesConditionBranch(b, client({ name: "" }), new Set())).toBe(
      true,
    );
    expect(matchesConditionBranch(b, client({ name: "   " }), new Set())).toBe(
      true,
    );
  });

  it("is_empty: false quando o campo tem conteúdo", () => {
    const b = branch("h", [], { field: "name", operator: "is_empty" });
    expect(matchesConditionBranch(b, client({ name: "Ana" }), new Set())).toBe(
      false,
    );
  });

  it("rule ausente no branch → false", () => {
    const b = branch("h", []);
    expect(matchesConditionBranch(b, client({ name: "Ana" }), new Set())).toBe(
      false,
    );
  });

  // Operadores declarados em ConditionRuleOperator (shared/schema.ts) que ainda
  // não têm avaliação implementada em matchesConditionBranch. Documentam o gap
  // atual: mesmo em cenários onde o operador "deveria" bater, ele retorna false.
  // Se algum destes for implementado no futuro, este teste deve ser atualizado
  // (não é comportamento desejado a manter para sempre).
  it.each<[string, ConditionRule]>([
    ["not_equals", { field: "name", operator: "not_equals", value: "Bruno" }],
    ["not_contains", { field: "name", operator: "not_contains", value: "xyz" }],
    ["starts_with", { field: "name", operator: "starts_with", value: "An" }],
    ["ends_with", { field: "name", operator: "ends_with", value: "na" }],
    ["exists", { field: "name", operator: "exists" }],
    [
      "matches_regex",
      { field: "name", operator: "matches_regex", value: "^Ana$" },
    ],
    ["is_true", { field: "contact_active", operator: "is_true" }],
    ["is_false", { field: "contact_active", operator: "is_false" }],
    ["has_all", { field: "contact_field", operator: "has_all" }],
    ["has_none", { field: "contact_field", operator: "has_none" }],
    ["has_any", { field: "contact_field", operator: "has_any" }],
    ["has_exactly", { field: "contact_field", operator: "has_exactly" }],
    [
      "not_has_exactly",
      { field: "contact_field", operator: "not_has_exactly" },
    ],
    ["is_one_of", { field: "agent", operator: "is_one_of" }],
    ["is_none_of", { field: "agent", operator: "is_none_of" }],
    ["no_agent", { field: "agent", operator: "no_agent" }],
    ["is_online", { field: "agent_online", operator: "is_online" }],
    ["not_online", { field: "agent_online", operator: "not_online" }],
    ["is_attending", { field: "channel", operator: "is_attending" }],
    ["not_attending", { field: "channel", operator: "not_attending" }],
  ])("%s: gap conhecido — sempre retorna false hoje", (_label, rule) => {
    const b = branch("h", [], rule);
    expect(
      matchesConditionBranch(b, client({ name: "Ana", cpf: "1" }), new Set()),
    ).toBe(false);
  });
});

describe("pickAttributeBranch — resolução do ramo", () => {
  it("retorna null quando nenhum ramo casa", () => {
    const branches = [
      branch("h1", [], { field: "name", operator: "equals", value: "Bruno" }),
    ];
    expect(
      pickAttributeBranch(branches, client({ name: "Ana" }), new Set()),
    ).toBeNull();
  });

  it("primeiro ramo que casa vence, mesmo se um ramo posterior também casaria", () => {
    const branches = [
      branch("h1", [], { field: "name", operator: "contains", value: "a" }),
      branch("h2", [], { field: "name", operator: "equals", value: "ana" }),
    ];
    expect(
      pickAttributeBranch(branches, client({ name: "Ana" }), new Set()),
    ).toBe("h1");
  });

  it("lista de ramos vazia → null", () => {
    expect(pickAttributeBranch([], client(), new Set())).toBeNull();
  });
});

describe("resolveAttributeHandle — atalhos sem banco", () => {
  it("clientId null → retorna defaultHandle sem tocar o banco", async () => {
    const node = conditionNode({
      branches: [
        branch("h1", [], { field: "name", operator: "equals", value: "Ana" }),
      ],
      defaultHandle: "h-default",
      mode: "attribute",
    });
    expect(await resolveAttributeHandle(node, null)).toBe("h-default");
  });

  it("clientId null e defaultHandle ausente → retorna a string literal 'default'", async () => {
    const node = conditionNode({
      branches: [],
      defaultHandle: undefined as unknown as string,
      mode: "attribute",
    });
    expect(await resolveAttributeHandle(node, null)).toBe("default");
  });
});
