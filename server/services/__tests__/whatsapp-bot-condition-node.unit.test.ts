import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../ai-helpers", () => ({
  classifyMessageIntent: vi.fn(async () => null),
}));

import {
  conditionRulesNeedReply,
  evaluateConditionRule,
  evaluateConditionRules,
  matchesConditionBranch,
  pickAttributeBranch,
  resolveAttributeHandle,
  resolveConditionHandle,
  resolveTemplateReplyHandle,
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

  it("defaultHandle ausente → cai no handle 'no_match' (o que o editor renderiza)", async () => {
    const node = conditionNode({
      branches: [branch("h-sim", ["sim"])],
      defaultHandle: undefined as unknown as string,
    });
    expect(await resolveConditionHandle(node, "não sei")).toBe("no_match");
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

  it("defaultHandle ausente e regra não bate → cai no handle 'no_match'", async () => {
    const node = conditionNode({
      branches: [],
      defaultHandle: undefined as unknown as string,
      rules: [{ field: "message_contains", operator: "contains", values: ["teste"] }],
    });
    expect(await resolveConditionHandle(node, "outra coisa")).toBe("no_match");
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

  // Operadores de texto sobre coluna legada (rule.field = ContactFieldKey
  // direto, sem wrapper contact_field/subField) — agora todos implementados.
  it.each<[string, ConditionRule, boolean]>([
    ["not_equals", { field: "name", operator: "not_equals", value: "Bruno" }, true],
    ["not_contains", { field: "name", operator: "not_contains", value: "xyz" }, true],
    ["starts_with", { field: "name", operator: "starts_with", value: "An" }, true],
    ["ends_with", { field: "name", operator: "ends_with", value: "na" }, true],
    ["exists", { field: "name", operator: "exists" }, true],
    ["matches_regex", { field: "name", operator: "matches_regex", value: "^Ana$" }, true],
    ["matches_regex inválida", { field: "name", operator: "matches_regex", value: "([" }, false],
  ])("%s sobre coluna legada", (_label, rule, expected) => {
    const b = branch("h", [], rule);
    expect(
      matchesConditionBranch(b, client({ name: "Ana", cpf: "1" }), new Set()),
    ).toBe(expected);
  });
});

describe("evaluateConditionRule — etiquetas (values múltiplos, editor atual)", () => {
  const ctxWith = (...tags: string[]) => ({ tagIds: new Set<string | null>(tags) });
  const rule = (operator: ConditionRule["operator"], values: string[]): ConditionRule => ({
    field: "tag",
    operator,
    values,
  });

  it("has_all: todas as selecionadas presentes (pode haver outras)", () => {
    expect(evaluateConditionRule(rule("has_all", ["t1", "t2"]), ctxWith("t1", "t2", "t3"))).toBe(true);
    expect(evaluateConditionRule(rule("has_all", ["t1", "t2"]), ctxWith("t1"))).toBe(false);
  });

  it("has_any: pelo menos uma presente", () => {
    expect(evaluateConditionRule(rule("has_any", ["t1", "t9"]), ctxWith("t1"))).toBe(true);
    expect(evaluateConditionRule(rule("has_any", ["t8", "t9"]), ctxWith("t1"))).toBe(false);
  });

  it("has_none: nenhuma presente", () => {
    expect(evaluateConditionRule(rule("has_none", ["t8", "t9"]), ctxWith("t1"))).toBe(true);
    expect(evaluateConditionRule(rule("has_none", ["t1", "t9"]), ctxWith("t1"))).toBe(false);
  });

  it("has_exactly / not_has_exactly: igualdade de conjuntos com as etiquetas do contato", () => {
    expect(evaluateConditionRule(rule("has_exactly", ["t1", "t2"]), ctxWith("t2", "t1"))).toBe(true);
    expect(evaluateConditionRule(rule("has_exactly", ["t1"]), ctxWith("t1", "t2"))).toBe(false);
    expect(evaluateConditionRule(rule("not_has_exactly", ["t1"]), ctxWith("t1", "t2"))).toBe(true);
    expect(evaluateConditionRule(rule("not_has_exactly", ["t1", "t2"]), ctxWith("t2", "t1"))).toBe(false);
  });

  it("seleção vazia: has_all/has_any/has_exactly nunca batem; has_none sempre bate", () => {
    expect(evaluateConditionRule(rule("has_all", []), ctxWith("t1"))).toBe(false);
    expect(evaluateConditionRule(rule("has_any", []), ctxWith("t1"))).toBe(false);
    expect(evaluateConditionRule(rule("has_exactly", []), ctxWith("t1"))).toBe(false);
    expect(evaluateConditionRule(rule("has_none", []), ctxWith("t1"))).toBe(true);
  });

  it("retrocompat: has/not_has com value singular seguem funcionando", () => {
    expect(
      evaluateConditionRule({ field: "tag", operator: "has", value: "t1" }, ctxWith("t1")),
    ).toBe(true);
    expect(
      evaluateConditionRule({ field: "tag", operator: "not_has", value: "t1" }, ctxWith("t2")),
    ).toBe(true);
  });
});

describe("evaluateConditionRule — contact_field com subField (editor atual)", () => {
  const c = client({ name: "Ana Souza", email: "ana@gmail.com", city: null } as Partial<Client>);
  const rule = (
    operator: ConditionRule["operator"],
    subField: string,
    value?: string,
  ): ConditionRule => ({ field: "contact_field", operator, subField, value });

  it("lê a coluna indicada em subField, não rule.field", () => {
    expect(evaluateConditionRule(rule("equals", "name", "ana souza"), { client: c, tagIds: new Set() })).toBe(true);
    expect(evaluateConditionRule(rule("contains", "email", "GMAIL"), { client: c, tagIds: new Set() })).toBe(true);
  });

  it("starts_with/ends_with/not_contains/not_equals", () => {
    expect(evaluateConditionRule(rule("starts_with", "name", "ana"), { client: c, tagIds: new Set() })).toBe(true);
    expect(evaluateConditionRule(rule("ends_with", "name", "souza"), { client: c, tagIds: new Set() })).toBe(true);
    expect(evaluateConditionRule(rule("not_contains", "name", "xyz"), { client: c, tagIds: new Set() })).toBe(true);
    expect(evaluateConditionRule(rule("not_equals", "name", "bruno"), { client: c, tagIds: new Set() })).toBe(true);
  });

  it("exists/is_empty tratam null como vazio", () => {
    expect(evaluateConditionRule(rule("exists", "city"), { client: c, tagIds: new Set() })).toBe(false);
    expect(evaluateConditionRule(rule("is_empty", "city"), { client: c, tagIds: new Set() })).toBe(true);
    expect(evaluateConditionRule(rule("exists", "name"), { client: c, tagIds: new Set() })).toBe(true);
  });

  it("matches_regex (case-insensitive); regex inválida → false", () => {
    expect(evaluateConditionRule(rule("matches_regex", "name", "^ANA"), { client: c, tagIds: new Set() })).toBe(true);
    expect(evaluateConditionRule(rule("matches_regex", "name", "(["), { client: c, tagIds: new Set() })).toBe(false);
  });

  it("subField ausente → nunca bate (nem mesmo is_empty)", () => {
    expect(
      evaluateConditionRule({ field: "contact_field", operator: "is_empty" }, { client: c, tagIds: new Set() }),
    ).toBe(false);
  });

  it("sem client no ctx → is_empty bate (campo vazio), equals com valor não bate", () => {
    expect(evaluateConditionRule(rule("is_empty", "name"), { tagIds: new Set() })).toBe(true);
    expect(evaluateConditionRule(rule("equals", "name", "ana"), { tagIds: new Set() })).toBe(false);
  });
});

describe("evaluateConditionRule — campos booleanos e presença", () => {
  it("contact_active: client sem opt-out é ativo", () => {
    const active = client();
    const opted = client({ whatsappOptOut: true } as Partial<Client>);
    expect(evaluateConditionRule({ field: "contact_active", operator: "is_true" }, { client: active, tagIds: new Set() })).toBe(true);
    expect(evaluateConditionRule({ field: "contact_active", operator: "is_true" }, { client: opted, tagIds: new Set() })).toBe(false);
    expect(evaluateConditionRule({ field: "contact_active", operator: "is_false" }, { tagIds: new Set() })).toBe(true);
  });

  it("contact_is_group / first_conversation vêm do ctx", () => {
    expect(evaluateConditionRule({ field: "contact_is_group", operator: "is_true" }, { isGroup: true, tagIds: new Set() })).toBe(true);
    expect(evaluateConditionRule({ field: "contact_is_group", operator: "is_false" }, { tagIds: new Set() })).toBe(true);
    expect(evaluateConditionRule({ field: "first_conversation", operator: "is_true" }, { isFirstConversation: true, tagIds: new Set() })).toBe(true);
    expect(evaluateConditionRule({ field: "first_conversation", operator: "is_false" }, { isFirstConversation: true, tagIds: new Set() })).toBe(false);
  });

  const convWithAgent = {
    id: "c1",
    assignedAgentId: "agent-1",
    channelId: 7,
    sectorId: "sec-1",
    phone: "5521999999999",
  };

  it("agent_online: presença do atendente atribuído via agentOnlineIds", () => {
    expect(
      evaluateConditionRule(
        { field: "agent_online", operator: "is_true" },
        { conversation: convWithAgent, agentOnlineIds: new Set(["agent-1"]), tagIds: new Set() },
      ),
    ).toBe(true);
    expect(
      evaluateConditionRule(
        { field: "agent_online", operator: "is_true" },
        { conversation: convWithAgent, agentOnlineIds: new Set(), tagIds: new Set() },
      ),
    ).toBe(false);
    // Sem atendente atribuído: is_true=false, is_false=true.
    expect(
      evaluateConditionRule(
        { field: "agent_online", operator: "is_false" },
        { conversation: { ...convWithAgent, assignedAgentId: null }, tagIds: new Set() },
      ),
    ).toBe(true);
  });

  it("agent: is_one_of/is_none_of/no_agent/is_online/not_online", () => {
    const ctx = { conversation: convWithAgent, agentOnlineIds: new Set(["agent-1"]), tagIds: new Set<string | null>() };
    expect(evaluateConditionRule({ field: "agent", operator: "is_one_of", values: ["agent-1", "x"] }, ctx)).toBe(true);
    expect(evaluateConditionRule({ field: "agent", operator: "is_none_of", values: ["agent-1"] }, ctx)).toBe(false);
    expect(evaluateConditionRule({ field: "agent", operator: "no_agent" }, ctx)).toBe(false);
    expect(evaluateConditionRule({ field: "agent", operator: "is_online" }, ctx)).toBe(true);
    expect(evaluateConditionRule({ field: "agent", operator: "not_online" }, ctx)).toBe(false);
    const noAgentCtx = { conversation: { ...convWithAgent, assignedAgentId: null }, tagIds: new Set<string | null>() };
    expect(evaluateConditionRule({ field: "agent", operator: "no_agent" }, noAgentCtx)).toBe(true);
    expect(evaluateConditionRule({ field: "agent", operator: "is_none_of", values: ["agent-1"] }, noAgentCtx)).toBe(true);
    expect(evaluateConditionRule({ field: "agent", operator: "not_online" }, noAgentCtx)).toBe(true);
  });

  it("channel: is_one_of compara o id como string; is_attending usa channelHasAttendant", () => {
    const ctx = { conversation: convWithAgent, channelHasAttendant: true, tagIds: new Set<string | null>() };
    expect(evaluateConditionRule({ field: "channel", operator: "is_one_of", values: ["7", "9"] }, ctx)).toBe(true);
    expect(evaluateConditionRule({ field: "channel", operator: "is_none_of", values: ["7"] }, ctx)).toBe(false);
    expect(evaluateConditionRule({ field: "channel", operator: "is_attending" }, ctx)).toBe(true);
    expect(evaluateConditionRule({ field: "channel", operator: "not_attending" }, ctx)).toBe(false);
    expect(evaluateConditionRule({ field: "channel", operator: "is_one_of", values: ["7"] }, { tagIds: new Set() })).toBe(false);
    expect(evaluateConditionRule({ field: "channel", operator: "is_none_of", values: ["7"] }, { tagIds: new Set() })).toBe(true);
  });

  it("sector: equals/not_equals; sem value nunca bate", () => {
    const ctx = { conversation: convWithAgent, tagIds: new Set<string | null>() };
    expect(evaluateConditionRule({ field: "sector", operator: "equals", value: "sec-1" }, ctx)).toBe(true);
    expect(evaluateConditionRule({ field: "sector", operator: "not_equals", value: "sec-2" }, ctx)).toBe(true);
    expect(evaluateConditionRule({ field: "sector", operator: "equals" }, ctx)).toBe(false);
  });
});

describe("evaluateConditionRule — value (variáveis de sessão) e parallel_bot", () => {
  it("value lê sessionVariables[subField] com operadores de texto", () => {
    const ctx = { sessionVariables: { opcao: "Suporte Técnico" }, tagIds: new Set<string | null>() };
    expect(evaluateConditionRule({ field: "value", operator: "contains", subField: "opcao", value: "suporte" }, ctx)).toBe(true);
    expect(evaluateConditionRule({ field: "value", operator: "equals", subField: "opcao", value: "suporte técnico" }, ctx)).toBe(true);
    expect(evaluateConditionRule({ field: "value", operator: "exists", subField: "opcao" }, ctx)).toBe(true);
    expect(evaluateConditionRule({ field: "value", operator: "is_empty", subField: "inexistente" }, ctx)).toBe(true);
    expect(evaluateConditionRule({ field: "value", operator: "matches_regex", subField: "opcao", value: "^suporte" }, ctx)).toBe(true);
  });

  it("parallel_bot: sem filtro basta existir outra sessão; com filtro exige o botId", () => {
    const ctx = { parallelBotIds: new Set(["bot-2"]), tagIds: new Set<string | null>() };
    expect(evaluateConditionRule({ field: "parallel_bot", operator: "equals" }, ctx)).toBe(true);
    expect(evaluateConditionRule({ field: "parallel_bot", operator: "equals", value: "bot-2" }, ctx)).toBe(true);
    expect(evaluateConditionRule({ field: "parallel_bot", operator: "equals", value: "bot-9" }, ctx)).toBe(false);
    expect(evaluateConditionRule({ field: "parallel_bot", operator: "equals" }, { tagIds: new Set() })).toBe(false);
  });
});

describe("conditionRulesNeedReply — quando o nó de condição pausa", () => {
  it("regras só de atributo → não pausa", () => {
    expect(
      conditionRulesNeedReply({
        branches: [],
        defaultHandle: "no_match",
        rules: [{ field: "tag", operator: "has_all", values: ["t1"] }],
      }),
    ).toBe(false);
  });

  it("alguma regra 'Mensagem contém' → pausa", () => {
    expect(
      conditionRulesNeedReply({
        branches: [],
        defaultHandle: "no_match",
        rules: [
          { field: "tag", operator: "has_all", values: ["t1"] },
          { field: "message_contains", operator: "contains", values: ["sim"] },
        ],
      }),
    ).toBe(true);
  });

  it("modelo legado (branches, sem rules) → pausa; modo attribute → nunca pausa", () => {
    expect(
      conditionRulesNeedReply({ branches: [branch("h", ["sim"])], defaultHandle: "no_match" }),
    ).toBe(true);
    expect(
      conditionRulesNeedReply({
        branches: [branch("h", ["sim"])],
        defaultHandle: "no_match",
        mode: "attribute",
      }),
    ).toBe(false);
  });
});

describe("resolveTemplateReplyHandle — roteamento de resposta ao template", () => {
  it("botão casado vence sempre", () => {
    expect(
      resolveTemplateReplyHandle({ repliedHandle: true, invalidResponseHandle: true }, "btn-0"),
    ).toBe("btn-0");
  });

  it("sem botão: 'replied' tem prioridade sobre 'invalid_response'", () => {
    expect(
      resolveTemplateReplyHandle({ repliedHandle: true, invalidResponseHandle: true }, null),
    ).toBe("replied");
    expect(resolveTemplateReplyHandle({ invalidResponseHandle: true }, null)).toBe("invalid_response");
    expect(resolveTemplateReplyHandle({}, null)).toBeNull();
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

  it("clientId null e defaultHandle ausente → cai no handle 'no_match'", async () => {
    const node = conditionNode({
      branches: [],
      defaultHandle: undefined as unknown as string,
      mode: "attribute",
    });
    expect(await resolveAttributeHandle(node, null)).toBe("no_match");
  });
});
