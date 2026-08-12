import { extractTemplateVarNames, type TemplateVarNames } from "@shared/whatsapp-template-vars";
import { fetchMetaTemplates } from "./whatsapp-templates.service";

/**
 * Resolve o `parameter_format` de um template aprovado na Meta e normaliza os
 * `components` do envio para o formato que a API espera.
 *
 * Templates criados com `parameter_format: "NAMED"` (variáveis `{{nome}}`) só
 * aceitam parâmetros com `parameter_name`. Enviar parâmetros posicionais para
 * eles faz a Meta responder:
 *
 *   (#100) Invalid parameter — "Parameter name is missing or empty"
 *
 * A tela de conversas já monta `parameter_name` no client, mas campanhas, bots,
 * aniversário e pós-atendimento montam os `components` no servidor sem essa
 * informação — o formato é resolvido aqui, no momento do envio.
 */

export type TemplateParamMeta = {
  parameterFormat: "NAMED" | "POSITIONAL";
  vars: TemplateVarNames;
};

// Uma chamada à Graph API traz todos os templates da WABA, então o cache é
// populado de uma vez. Sem ele haveria uma chamada por mensagem de campanha.
const CACHE_TTL_MS = 5 * 60 * 1000;
// Se a Graph API falhar, segura a próxima tentativa por um tempo curto para não
// disparar uma chamada por mensagem durante uma campanha inteira.
const CACHE_ERROR_TTL_MS = 60 * 1000;

const cache = new Map<string, TemplateParamMeta>();
let cacheExpiresAt = 0;

function cacheKey(name: string, language: string): string {
  return `${name}::${language}`;
}

async function refreshCache(): Promise<void> {
  let templates: Awaited<ReturnType<typeof fetchMetaTemplates>>;
  try {
    templates = await fetchMetaTemplates();
  } catch (err) {
    cacheExpiresAt = Date.now() + CACHE_ERROR_TTL_MS;
    throw err;
  }
  cache.clear();
  for (const t of templates) {
    cache.set(cacheKey(t.name, t.language), {
      parameterFormat: t.parameter_format ?? "POSITIONAL",
      vars: extractTemplateVarNames(t.components),
    });
  }
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
}

/** Somente para testes — descarta o cache entre casos. */
export function clearTemplateParamMetaCache(): void {
  cache.clear();
  cacheExpiresAt = 0;
}

/**
 * Metadados de parâmetros do template (formato + nomes das variáveis).
 * Devolve `null` quando o template não existe na WABA — nesse caso o envio
 * segue com os `components` como vieram.
 */
export async function getTemplateParamMeta(
  name: string,
  language: string,
): Promise<TemplateParamMeta | null> {
  if (Date.now() >= cacheExpiresAt) {
    await refreshCache();
  }
  return cache.get(cacheKey(name, language)) ?? null;
}

type TextParameter = { type: "text"; text?: string; parameter_name?: string };

function isTextParameter(param: unknown): param is TextParameter {
  return (
    !!param &&
    typeof param === "object" &&
    (param as { type?: unknown }).type === "text"
  );
}

/**
 * Anexa `parameter_name` aos parâmetros de texto de header/body quando o
 * template usa formato NAMED. Puro — não toca em rede nem banco.
 *
 * Preserva `parameter_name` já presente (caminho de conversas, que resolve o
 * nome no client) e ignora parâmetros de mídia e nomes puramente posicionais
 * (`{{1}}`), que a Meta rejeita como nome.
 */
export function applyNamedParameters(
  components: object[] | undefined,
  meta: TemplateParamMeta | null,
): object[] | undefined {
  if (!components?.length) return components;
  if (!meta || meta.parameterFormat !== "NAMED") return components;

  return components.map((component) => {
    const c = component as { type?: unknown; parameters?: unknown };
    if (typeof c.type !== "string" || !Array.isArray(c.parameters)) return component;

    const compType = c.type.toLowerCase();
    if (compType !== "header" && compType !== "body") return component;

    const names = meta.vars[compType];
    if (!names.length) return component;

    return {
      ...c,
      parameters: c.parameters.map((param, index) => {
        if (!isTextParameter(param) || param.parameter_name) return param;
        const name = names[index];
        // Nome ausente ou posicional (`{{1}}`) não é um `parameter_name` válido.
        if (!name || /^\d+$/.test(name)) return param;
        return { ...param, parameter_name: name };
      }),
    };
  });
}
