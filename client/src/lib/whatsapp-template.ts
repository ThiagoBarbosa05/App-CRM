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
  format: "text" | "image" | "video" | "document";
};

function getComponents(template: MetaTemplate): MetaComponent[] {
  return (template.components as MetaComponent[]) ?? [];
}

/** Extrai os grupos de variáveis/mídia presentes no header/body do template. */
export function parseTemplateVars(template: MetaTemplate): TemplateVarGroup[] {
  const groups: TemplateVarGroup[] = [];
  for (const c of getComponents(template)) {
    const compType = c.type.toLowerCase() as "body" | "header";
    if (compType !== "body" && compType !== "header") continue;
    const fmt = (c.format as string | undefined)?.toLowerCase() ?? "text";
    if (fmt === "image" || fmt === "video" || fmt === "document") {
      groups.push({ componentType: compType, vars: ["media_url"], format: fmt });
    } else if (c.text && /\{\{/.test(c.text)) {
      groups.push({
        componentType: compType,
        vars: (c.text.match(/\{\{([^}]+)\}\}/g) ?? []).map((m) => m.slice(2, -2).trim()),
        format: "text",
      });
    }
  }
  return groups;
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
  const param = params.find((p) => p.type === compType)?.parameters[idx];
  if (!param) return "";
  if (param.type === "text") return param.text;
  if (param.type === "image") return param.image.link;
  if (param.type === "video") return param.video.link;
  if (param.type === "document") return param.document.link;
  return "";
}

export function setParamValue(
  params: TemplateParamComponent[],
  compType: "body" | "header",
  idx: number,
  value: string,
  mediaType: "text" | "image" | "video" | "document" = "text",
): TemplateParamComponent[] {
  const next = params.map((p) => ({ ...p, parameters: [...p.parameters] }));
  let comp = next.find((p) => p.type === compType);
  if (!comp) {
    comp = { type: compType, parameters: [] };
    next.push(comp);
  }
  if (mediaType === "image") {
    comp.parameters[idx] = { type: "image", image: { link: value } };
  } else if (mediaType === "video") {
    comp.parameters[idx] = { type: "video", video: { link: value } };
  } else if (mediaType === "document") {
    comp.parameters[idx] = { type: "document", document: { link: value } };
  } else {
    comp.parameters[idx] = { type: "text", text: value };
  }
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
