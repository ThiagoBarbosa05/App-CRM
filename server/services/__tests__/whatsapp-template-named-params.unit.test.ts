import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractTemplateVarNames } from "@shared/whatsapp-template-vars";

// whatsapp-templates.service importa `server/db` no topo — mockado para manter
// este teste puro (o cache é exercido através dele).
const { fetchMetaTemplates } = vi.hoisted(() => ({ fetchMetaTemplates: vi.fn() }));
vi.mock("../whatsapp-templates.service", () => ({ fetchMetaTemplates }));

import {
  applyNamedParameters,
  clearTemplateParamMetaCache,
  getTemplateParamMeta,
} from "../whatsapp-template-format.service";

type Meta = Awaited<ReturnType<typeof getTemplateParamMeta>>;

const namedMeta = {
  parameterFormat: "NAMED" as const,
  vars: { header: [], body: ["nome", "cidade"] },
};

describe("extractTemplateVarNames", () => {
  it("separa as variáveis de header e body", () => {
    expect(
      extractTemplateVarNames([
        { type: "HEADER", format: "TEXT", text: "Oi {{nome}}" },
        { type: "BODY", text: "Seu pedido {{pedido}} sai de {{cidade}}" },
        { type: "FOOTER", text: "Equipe {{ignorado}}" },
      ]),
    ).toEqual({ header: ["nome"], body: ["pedido", "cidade"] });
  });

  it("ignora header de mídia, que não tem variável de texto", () => {
    expect(
      extractTemplateVarNames([
        { type: "HEADER", format: "IMAGE" },
        { type: "BODY", text: "Olá {{nome}}" },
      ]),
    ).toEqual({ header: [], body: ["nome"] });
  });

  it("tolera components ausentes ou malformados", () => {
    expect(extractTemplateVarNames(undefined)).toEqual({ header: [], body: [] });
    expect(extractTemplateVarNames([null, 42, { text: "{{x}}" }])).toEqual({
      header: [],
      body: [],
    });
  });
});

describe("applyNamedParameters", () => {
  it("anexa parameter_name na ordem das variáveis quando o template é NAMED", () => {
    const components = [
      { type: "body", parameters: [{ type: "text", text: "Thiago" }, { type: "text", text: "Macaé" }] },
    ];

    expect(applyNamedParameters(components, namedMeta)).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", text: "Thiago", parameter_name: "nome" },
          { type: "text", text: "Macaé", parameter_name: "cidade" },
        ],
      },
    ]);
  });

  it("não altera o payload quando o template é POSITIONAL", () => {
    const components = [{ type: "body", parameters: [{ type: "text", text: "Thiago" }] }];
    const meta = { parameterFormat: "POSITIONAL" as const, vars: { header: [], body: ["1"] } };

    expect(applyNamedParameters(components, meta)).toBe(components);
  });

  it("não altera o payload quando o template não foi encontrado na Meta", () => {
    const components = [{ type: "body", parameters: [{ type: "text", text: "Thiago" }] }];

    expect(applyNamedParameters(components, null)).toBe(components);
  });

  it("preserva parameter_name já resolvido pelo client (tela de conversas)", () => {
    const components = [
      {
        type: "body",
        parameters: [
          { type: "text", text: "Thiago", parameter_name: "primeiro_nome" },
          { type: "text", text: "Macaé" },
        ],
      },
    ];

    expect(applyNamedParameters(components, namedMeta)).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", text: "Thiago", parameter_name: "primeiro_nome" },
          { type: "text", text: "Macaé", parameter_name: "cidade" },
        ],
      },
    ]);
  });

  it("não toca em parâmetros de mídia do header", () => {
    const components = [
      { type: "header", parameters: [{ type: "image", image: { link: "https://cdn/x.png" } }] },
      { type: "body", parameters: [{ type: "text", text: "Thiago" }] },
    ];

    expect(applyNamedParameters(components, namedMeta)).toEqual([
      { type: "header", parameters: [{ type: "image", image: { link: "https://cdn/x.png" } }] },
      { type: "body", parameters: [{ type: "text", text: "Thiago", parameter_name: "nome" }] },
    ]);
  });

  it("não anexa nome posicional ({{1}}) mesmo se o template vier marcado NAMED", () => {
    const components = [{ type: "body", parameters: [{ type: "text", text: "Thiago" }] }];
    const meta = { parameterFormat: "NAMED" as const, vars: { header: [], body: ["1"] } };

    expect(applyNamedParameters(components, meta)).toEqual([
      { type: "body", parameters: [{ type: "text", text: "Thiago" }] },
    ]);
  });

  it("devolve components vazio/ausente sem alteração", () => {
    expect(applyNamedParameters(undefined, namedMeta)).toBeUndefined();
    expect(applyNamedParameters([], namedMeta)).toEqual([]);
  });
});

describe("getTemplateParamMeta", () => {
  beforeEach(() => {
    clearTemplateParamMetaCache();
    fetchMetaTemplates.mockReset();
  });

  it("resolve formato e nomes a partir do template da Meta", async () => {
    fetchMetaTemplates.mockResolvedValue([
      {
        name: "boas_vindas",
        language: "pt_BR",
        parameter_format: "NAMED",
        components: [{ type: "BODY", text: "Olá {{nome}}, tudo bem?" }],
      },
    ]);

    const meta: Meta = await getTemplateParamMeta("boas_vindas", "pt_BR");
    expect(meta).toEqual({ parameterFormat: "NAMED", vars: { header: [], body: ["nome"] } });
  });

  it("assume POSITIONAL quando a Meta não informa parameter_format", async () => {
    fetchMetaTemplates.mockResolvedValue([
      { name: "antigo", language: "pt_BR", components: [{ type: "BODY", text: "Olá {{1}}" }] },
    ]);

    expect((await getTemplateParamMeta("antigo", "pt_BR"))?.parameterFormat).toBe("POSITIONAL");
  });

  it("devolve null para template inexistente sem refazer a chamada (cache)", async () => {
    fetchMetaTemplates.mockResolvedValue([
      { name: "boas_vindas", language: "pt_BR", parameter_format: "NAMED", components: [] },
    ]);

    expect(await getTemplateParamMeta("inexistente", "pt_BR")).toBeNull();
    expect(await getTemplateParamMeta("boas_vindas", "pt_BR")).not.toBeNull();
    expect(fetchMetaTemplates).toHaveBeenCalledTimes(1);
  });

  it("propaga a falha da Graph API para quem chama decidir o fallback", async () => {
    fetchMetaTemplates.mockRejectedValue(new Error("graph down"));

    await expect(getTemplateParamMeta("boas_vindas", "pt_BR")).rejects.toThrow("graph down");
  });
});
