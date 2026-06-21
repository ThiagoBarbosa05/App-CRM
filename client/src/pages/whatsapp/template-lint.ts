import { META_LIMITS, extractVars, type MetaTemplateForm } from "./template-schema";

export type LintLevel = "error" | "warning";

/** Campos lógicos usados para agrupar os avisos perto da seção correspondente. */
export type LintField = "name" | "header" | "body" | "footer" | "buttons" | "category";

export interface LintIssue {
  field: LintField;
  level: LintLevel;
  message: string;
}

// Detecta emojis sem usar \p{...} (que exige target ES2018+):
// surrogates do plano astral + faixas de símbolos/dingbats do BMP.
const EMOJI_RE = /[\uD800-\uDBFF]|[☀-➿]|[⬀-⯿]|[←-⇿]|™|ℹ/;

/** Palavras que sugerem conteúdo transacional (categoria UTILITY) e não MARKETING. */
const TRANSACTIONAL_HINTS = [
  "código",
  "verificação",
  "verificacao",
  "pedido",
  "entrega",
  "rastreio",
  "rastreamento",
  "agendamento",
  "confirmação",
  "confirmacao",
  "fatura",
  "boleto",
  "senha",
  "otp",
];

/** Palavras tipicamente promocionais (categoria MARKETING). */
const MARKETING_HINTS = [
  "promoção",
  "promocao",
  "desconto",
  "oferta",
  "cupom",
  "novidade",
  "lançamento",
  "lancamento",
  "imperdível",
  "imperdivel",
  "aproveite",
];

function lower(text: string): string {
  return text.toLowerCase();
}

/** Roda todas as regras de risco de rejeição da Meta sobre o formulário. */
export function lintTemplate(v: MetaTemplateForm): LintIssue[] {
  const issues: LintIssue[] = [];
  const isAuth = v.category === "AUTHENTICATION";

  // ── Nome ──
  if (v.name && !/^[a-z0-9_]+$/.test(v.name)) {
    issues.push({
      field: "name",
      level: "error",
      message: "Nome deve conter apenas letras minúsculas, números e underscore.",
    });
  }

  // ── Cabeçalho ──
  if (v.headerFormat === "TEXT") {
    const headerText = v.headerText ?? "";
    if (headerText.length > META_LIMITS.headerText) {
      issues.push({
        field: "header",
        level: "warning",
        message: `Cabeçalho com ${headerText.length} caracteres (máx. ${META_LIMITS.headerText}).`,
      });
    }
    const headerVars = extractVars(headerText);
    if (headerVars.length > 1) {
      issues.push({
        field: "header",
        level: "error",
        message: "O cabeçalho de texto aceita no máximo 1 variável.",
      });
    }
    const missingHeaderEx = v.headerTextExamples.filter((e) => !e.example.trim());
    if (headerVars.length && missingHeaderEx.length) {
      issues.push({
        field: "header",
        level: "error",
        message: "Preencha o exemplo da variável do cabeçalho — a Meta exige exemplos.",
      });
    }
  }
  if (
    (v.headerFormat === "IMAGE" || v.headerFormat === "VIDEO" || v.headerFormat === "DOCUMENT") &&
    !v.headerMediaHandle?.trim()
  ) {
    issues.push({
      field: "header",
      level: "error",
      message: "Carregue a mídia do cabeçalho — a Meta exige um exemplo (handle).",
    });
  }

  // ── Corpo ──
  const body = v.bodyText ?? "";
  if (!body.trim()) {
    issues.push({ field: "body", level: "error", message: "O corpo da mensagem é obrigatório." });
  }
  if (body.length > META_LIMITS.body) {
    issues.push({
      field: "body",
      level: "warning",
      message: `Corpo com ${body.length} caracteres (máx. ${META_LIMITS.body}).`,
    });
  }

  const bodyVars = extractVars(body);

  if (!isAuth && bodyVars.length) {
    // Exemplos preenchidos
    const missing = v.bodyExamples.filter((e) => !e.example.trim());
    if (missing.length) {
      issues.push({
        field: "body",
        level: "error",
        message: `Preencha o exemplo de ${missing.length === 1 ? "1 variável" : `${missing.length} variáveis`} do corpo — falta de exemplos é a causa de rejeição mais comum.`,
      });
    }

    // POSITIONAL: sequência 1..N sem buracos
    if (v.parameterFormat === "POSITIONAL") {
      const nums = bodyVars.map((x) => Number(x)).filter((n) => Number.isInteger(n));
      const allNumeric = nums.length === bodyVars.length;
      if (!allNumeric) {
        issues.push({
          field: "body",
          level: "error",
          message: "No formato posicional, use apenas {{1}}, {{2}}, … como variáveis.",
        });
      } else {
        const sorted = [...nums].sort((a, b) => a - b);
        const sequential = sorted.every((n, i) => n === i + 1);
        if (!sequential) {
          issues.push({
            field: "body",
            level: "error",
            message: "Variáveis posicionais devem ser sequenciais começando em {{1}}, sem pular números.",
          });
        }
      }
    }

    // Variáveis adjacentes
    if (/\}\}\s*\{\{/.test(body)) {
      issues.push({
        field: "body",
        level: "warning",
        message: "Há variáveis adjacentes ({{x}} {{y}}). A Meta costuma rejeitar — adicione texto entre elas.",
      });
    }

    // Começa ou termina com variável
    const trimmed = body.trim();
    if (/^\{\{[^}]+\}\}/.test(trimmed) || /\{\{[^}]+\}\}$/.test(trimmed)) {
      issues.push({
        field: "body",
        level: "warning",
        message: "O corpo começa ou termina com variável — a Meta frequentemente rejeita esse formato.",
      });
    }

    // Razão variáveis/palavras alta
    const words = trimmed.replace(/\{\{[^}]+\}\}/g, "").split(/\s+/).filter(Boolean).length;
    if (words < bodyVars.length * 3) {
      issues.push({
        field: "body",
        level: "warning",
        message: "Pouco texto em relação ao número de variáveis — risco de rejeição. Adicione mais conteúdo fixo.",
      });
    }
  }

  // ── Rodapé ──
  if (!isAuth && v.footerText?.trim()) {
    const footer = v.footerText;
    if (footer.length > META_LIMITS.footer) {
      issues.push({
        field: "footer",
        level: "warning",
        message: `Rodapé com ${footer.length} caracteres (máx. ${META_LIMITS.footer}).`,
      });
    }
    if (/\{\{/.test(footer)) {
      issues.push({
        field: "footer",
        level: "warning",
        message: "O rodapé não aceita variáveis — elas não serão substituídas.",
      });
    }
    if (EMOJI_RE.test(footer)) {
      issues.push({
        field: "footer",
        level: "warning",
        message: "O rodapé não aceita emojis.",
      });
    }
  }

  // ── Botões ──
  if (v.buttons.length) {
    if (v.buttons.length > META_LIMITS.maxButtons) {
      issues.push({
        field: "buttons",
        level: "error",
        message: `Máximo de ${META_LIMITS.maxButtons} botões (há ${v.buttons.length}).`,
      });
    }

    const urlCount = v.buttons.filter((b) => b.type === "URL").length;
    const phoneCount = v.buttons.filter((b) => b.type === "PHONE_NUMBER").length;
    if (urlCount > META_LIMITS.maxUrlButtons) {
      issues.push({
        field: "buttons",
        level: "error",
        message: `Máximo de ${META_LIMITS.maxUrlButtons} botões de URL (há ${urlCount}).`,
      });
    }
    if (phoneCount > META_LIMITS.maxPhoneButtons) {
      issues.push({
        field: "buttons",
        level: "error",
        message: `Máximo de ${META_LIMITS.maxPhoneButtons} botão de telefone (há ${phoneCount}).`,
      });
    }

    const hasQuickReply = v.buttons.some((b) => b.type === "QUICK_REPLY");
    const hasCta = v.buttons.some((b) => b.type === "URL" || b.type === "PHONE_NUMBER");
    if (hasQuickReply && hasCta) {
      issues.push({
        field: "buttons",
        level: "warning",
        message: "Misturar resposta rápida com botões de ação (URL/telefone) faz a Meta reagrupar e pode alterar a ordem.",
      });
    }

    v.buttons.forEach((btn, i) => {
      if ("text" in btn && btn.text && btn.text.length > META_LIMITS.buttonText) {
        issues.push({
          field: "buttons",
          level: "warning",
          message: `Botão ${i + 1}: texto com ${btn.text.length} caracteres (máx. ${META_LIMITS.buttonText}).`,
        });
      }
      if (btn.type === "URL" && /\{\{/.test(btn.url) && !btn.urlExample?.trim()) {
        issues.push({
          field: "buttons",
          level: "error",
          message: `Botão ${i + 1}: a URL tem variável — preencha o exemplo, exigido pela Meta.`,
        });
      }
    });
  }

  // ── Categoria (apenas dicas) ──
  if (body.trim()) {
    const lowBody = lower(body);
    if (v.category === "MARKETING" && TRANSACTIONAL_HINTS.some((w) => lowBody.includes(w))) {
      issues.push({
        field: "category",
        level: "warning",
        message: "O texto parece transacional. Considere a categoria UTILIDADE para evitar reprovação.",
      });
    }
    if (v.category === "UTILITY" && MARKETING_HINTS.some((w) => lowBody.includes(w))) {
      issues.push({
        field: "category",
        level: "warning",
        message: "O texto parece promocional. A Meta pode reclassificar como MARKETING.",
      });
    }
  }

  return issues;
}

export function hasBlockingErrors(issues: LintIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}
