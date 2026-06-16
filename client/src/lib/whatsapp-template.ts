import type { MetaTemplate } from "@/hooks/use-whatsapp";
import type { TemplateParamComponent } from "@shared/schema";

/**
 * Helpers para lidar com variáveis de templates do WhatsApp (Meta).
 * Extraído do bot-editor para ser reutilizado na criação de campanhas.
 */

type MetaComponent = { type: string; text?: string; format?: string };

export type TemplateVarGroup = {
  componentType: "body" | "header";
  vars: string[];
};

function getComponents(template: MetaTemplate): MetaComponent[] {
  return (template.components as MetaComponent[]) ?? [];
}

/** Extrai os grupos de variáveis ({{...}}) presentes no header/body do template. */
export function parseTemplateVars(template: MetaTemplate): TemplateVarGroup[] {
  return getComponents(template)
    .filter((c) => c.text && /\{\{/.test(c.text))
    .map((c) => ({
      componentType: c.type.toLowerCase() as "body" | "header",
      vars: (c.text!.match(/\{\{([^}]+)\}\}/g) ?? []).map((m) => m.slice(2, -2).trim()),
    }))
    .filter((c) => c.vars.length > 0);
}

/** Texto bruto do corpo (BODY) do template, se existir. */
export function getTemplateBodyText(template: MetaTemplate): string {
  const body = getComponents(template).find((c) => c.type.toLowerCase() === "body");
  return body?.text ?? "";
}

/** Texto bruto do cabeçalho (HEADER) de texto do template, se existir. */
export function getTemplateHeaderText(template: MetaTemplate): string {
  const header = getComponents(template).find(
    (c) => c.type.toLowerCase() === "header" && c.text,
  );
  return header?.text ?? "";
}

export function getParamValue(
  params: TemplateParamComponent[],
  compType: string,
  idx: number,
): string {
  return params.find((p) => p.type === compType)?.parameters[idx]?.text ?? "";
}

export function setParamValue(
  params: TemplateParamComponent[],
  compType: "body" | "header",
  idx: number,
  value: string,
): TemplateParamComponent[] {
  const next = params.map((p) => ({ ...p, parameters: [...p.parameters] }));
  let comp = next.find((p) => p.type === compType);
  if (!comp) {
    comp = { type: compType, parameters: [] };
    next.push(comp);
  }
  comp.parameters[idx] = { type: "text", text: value };
  return next;
}

/**
 * Renderiza um texto de template substituindo as variáveis {{...}} pelo valor
 * informado em `replacements` (por nome da variável) ou por um placeholder.
 */
export function renderTemplateText(
  text: string,
  replacements: Record<string, string> = {},
  fallback: (varName: string) => string = (v) => `{{${v}}}`,
): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_m, raw) => {
    const name = String(raw).trim();
    return replacements[name] ?? fallback(name);
  });
}
