/**
 * Extração dos nomes das variáveis de um template da Meta a partir dos
 * `components` crus devolvidos pela Graph API.
 *
 * Vive no shared porque a mesma regra é usada no client (pré-visualização e
 * campos do formulário, em `client/src/lib/whatsapp-template.ts`) e no servidor
 * (para montar `parameter_name` em templates com `parameter_format: "NAMED"`).
 */

export type TemplateVarNames = {
  header: string[];
  body: string[];
};

type RawComponent = {
  type?: unknown;
  text?: unknown;
  format?: unknown;
};

const MEDIA_FORMATS = new Set(["image", "video", "document"]);

/** Nomes das variáveis `{{...}}` de um texto, na ordem em que aparecem. */
function varsInText(text: string): string[] {
  return (text.match(/\{\{([^}]+)\}\}/g) ?? []).map((m) => m.slice(2, -2).trim());
}

/**
 * Separa os nomes das variáveis do header e do body. Header de mídia
 * (image/video/document) não tem variável de texto e por isso fica vazio.
 */
export function extractTemplateVarNames(components: unknown[] | undefined): TemplateVarNames {
  const result: TemplateVarNames = { header: [], body: [] };

  for (const raw of components ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const c = raw as RawComponent;
    if (typeof c.type !== "string") continue;

    const compType = c.type.toLowerCase();
    if (compType !== "header" && compType !== "body") continue;

    const format = typeof c.format === "string" ? c.format.toLowerCase() : "text";
    if (MEDIA_FORMATS.has(format)) continue;

    if (typeof c.text === "string") {
      result[compType] = varsInText(c.text);
    }
  }

  return result;
}
