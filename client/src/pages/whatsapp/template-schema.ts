import { z } from "zod";
import type { MetaTemplateCreatePayload } from "@/hooks/use-whatsapp";

// ── Limites da Meta (usados em validações e contadores) ─────────────────────────

export const META_LIMITS = {
  body: 1024,
  headerText: 60,
  footer: 60,
  buttonText: 25,
  maxButtons: 10,
  maxUrlButtons: 2,
  maxPhoneButtons: 1,
} as const;

// ── Zod schema ──────────────────────────────────────────────────────────────────

export const varExampleSchema = z.object({
  paramName: z.string(),
  example: z.string(),
});

export const buttonSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("QUICK_REPLY"), text: z.string().min(1, "Texto obrigatório") }),
  z.object({
    type: z.literal("URL"),
    text: z.string().min(1, "Texto obrigatório"),
    url: z.string().min(1, "URL obrigatória"),
    urlExample: z.string().optional(),
  }),
  z.object({
    type: z.literal("PHONE_NUMBER"),
    text: z.string().min(1, "Texto obrigatório"),
    phoneNumber: z.string().min(1, "Telefone obrigatório"),
  }),
  z.object({ type: z.literal("COPY_CODE"), text: z.string().min(1, "Texto obrigatório") }),
  z.object({
    type: z.literal("OTP"),
    otpType: z.enum(["COPY_CODE", "ONE_TAP", "ZERO_TAP"]).default("COPY_CODE"),
  }),
]);

export const metaTemplateSchema = z.object({
  name: z
    .string()
    .min(1, "Nome é obrigatório")
    .regex(/^[a-z0-9_]+$/, "Apenas letras minúsculas, números e _"),
  language: z.string().min(2, "Idioma obrigatório"),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  parameterFormat: z.enum(["NAMED", "POSITIONAL"]).default("NAMED"),
  // Header
  headerFormat: z.enum(["NONE", "TEXT", "IMAGE", "VIDEO", "DOCUMENT", "LOCATION"]).default("NONE"),
  headerText: z.string().optional(),
  headerMediaHandle: z.string().optional(),
  headerMediaPreviewUrl: z.string().optional(),
  headerTextExamples: z.array(varExampleSchema).default([]),
  // Body
  bodyText: z.string().min(1, "Texto do corpo é obrigatório"),
  bodyExamples: z.array(varExampleSchema).default([]),
  addSecurityRecommendation: z.boolean().default(false),
  // Footer
  footerText: z.string().optional(),
  codeExpirationMinutes: z.coerce.number().optional(),
  // Buttons
  buttons: z.array(buttonSchema).default([]),
});

export type MetaTemplateForm = z.infer<typeof metaTemplateSchema>;
export type TemplateButton = z.infer<typeof buttonSchema>;

export const EMPTY_TEMPLATE: MetaTemplateForm = {
  name: "",
  language: "pt_BR",
  category: "MARKETING",
  parameterFormat: "NAMED",
  headerFormat: "NONE",
  headerText: "",
  headerMediaHandle: "",
  headerMediaPreviewUrl: "",
  headerTextExamples: [],
  bodyText: "",
  bodyExamples: [],
  addSecurityRecommendation: false,
  footerText: "",
  codeExpirationMinutes: undefined,
  buttons: [],
};

// ── Helpers compartilhados ────────────────────────────────────────────────────

/** Extrai os nomes de variáveis ({{x}}) de um texto, na ordem e sem duplicatas. */
export function extractVars(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g) ?? [];
  const vars = matches.map((m) => m.slice(2, -2).trim());
  return vars.filter((v, i) => vars.indexOf(v) === i);
}

/** Substitui {{var}} pelos exemplos correspondentes (para o preview). */
export function applyExamples(
  text: string,
  examples: { paramName: string; example: string }[],
): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_match, name: string) => {
    const key = name.trim();
    const found = examples.find((e) => e.paramName === key);
    return found?.example?.trim() ? found.example : `{{${key}}}`;
  });
}

// ── Montagem do payload da Meta ───────────────────────────────────────────────

export function buildMetaPayload(v: MetaTemplateForm): MetaTemplateCreatePayload {
  const components: Record<string, unknown>[] = [];

  // Header
  if (v.headerFormat !== "NONE") {
    if (v.headerFormat === "TEXT" && v.headerText) {
      const hasVars = /\{\{/.test(v.headerText);
      const example =
        hasVars && v.headerTextExamples.length
          ? v.parameterFormat === "NAMED"
            ? {
                header_text_named_params: v.headerTextExamples.map((e) => ({
                  param_name: e.paramName,
                  example: e.example,
                })),
              }
            : { header_text: [v.headerTextExamples.map((e) => e.example)] }
          : undefined;
      components.push({
        type: "HEADER",
        format: "TEXT",
        text: v.headerText,
        ...(example ? { example } : {}),
      });
    } else if (v.headerFormat === "LOCATION") {
      components.push({ type: "HEADER", format: "LOCATION" });
    } else {
      components.push({
        type: "HEADER",
        format: v.headerFormat,
        ...(v.headerMediaHandle ? { example: { header_handle: [v.headerMediaHandle] } } : {}),
      });
    }
  }

  // Body
  if (v.category === "AUTHENTICATION") {
    components.push({
      type: "BODY",
      text: v.bodyText,
      add_security_recommendation: v.addSecurityRecommendation,
    });
  } else {
    const hasVars = /\{\{/.test(v.bodyText);
    const example =
      hasVars && v.bodyExamples.length
        ? v.parameterFormat === "NAMED"
          ? {
              body_text_named_params: v.bodyExamples.map((e) => ({
                param_name: e.paramName,
                example: e.example,
              })),
            }
          : { body_text: [v.bodyExamples.map((e) => e.example)] }
        : undefined;
    components.push({ type: "BODY", text: v.bodyText, ...(example ? { example } : {}) });
  }

  // Footer
  if (v.category === "AUTHENTICATION") {
    if (v.codeExpirationMinutes) {
      components.push({ type: "FOOTER", code_expiration_minutes: v.codeExpirationMinutes });
    }
  } else if (v.footerText?.trim()) {
    components.push({ type: "FOOTER", text: v.footerText });
  }

  // Buttons
  if (v.buttons.length) {
    const buttons = v.buttons.map((btn) => {
      if (btn.type === "QUICK_REPLY") return { type: "QUICK_REPLY", text: btn.text };
      if (btn.type === "URL")
        return {
          type: "URL",
          text: btn.text,
          url: btn.url,
          ...(btn.urlExample ? { example: [btn.urlExample] } : {}),
        };
      if (btn.type === "PHONE_NUMBER")
        return { type: "PHONE_NUMBER", text: btn.text, phone_number: btn.phoneNumber };
      if (btn.type === "COPY_CODE") return { type: "COPY_CODE", text: btn.text };
      if (btn.type === "OTP") return { type: "OTP", otp_type: btn.otpType };
      return btn;
    });
    components.push({ type: "BUTTONS", buttons });
  }

  return {
    name: v.name,
    language: v.language,
    category: v.category,
    parameter_format: v.parameterFormat,
    components,
  };
}
