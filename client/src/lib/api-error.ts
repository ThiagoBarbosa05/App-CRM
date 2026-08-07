import { whatsappErrorInfo } from "@shared/whatsapp-error-codes";

/**
 * Mensagem legível de um erro lançado por `apiRequest`.
 *
 * `throwIfResNotOk` lança `Error("400: {\"message\":\"...\"}")` — o corpo cru
 * da resposta grudado no status. Jogar isso na tela mostra JSON ao usuário;
 * esta função extrai o `message` quando ele existe e cai no texto original
 * quando não existe (resposta em HTML, erro de rede, timeout).
 */
export function extractApiMessage(
  error: unknown,
  fallback = "Não foi possível carregar os dados.",
): string {
  if (!(error instanceof Error) || !error.message) return fallback;

  const withoutStatus = error.message.replace(/^\d{3}:\s*/, "");
  if (!withoutStatus) return fallback;

  try {
    const parsed: unknown = JSON.parse(withoutStatus);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "message" in parsed &&
      typeof (parsed as { message: unknown }).message === "string"
    ) {
      return (parsed as { message: string }).message;
    }
  } catch {
    // Não era JSON — o texto cru já é a melhor mensagem disponível.
  }

  return withoutStatus;
}

export interface ApiFieldError {
  field: string;
  message: string;
}

interface ParsedApiError {
  /** Status HTTP quando `apiRequest` o prefixou na mensagem. */
  status: number | null;
  /** `message` do corpo JSON — `null` quando a resposta não trouxe um. */
  message: string | null;
  /** `code` do vocabulário compartilhado, quando o endpoint o envia. */
  code: string | null;
  /** `hint` do corpo: o que o usuário deve fazer para resolver. */
  hint: string | null;
  /** Falhas de validação campo a campo, quando o endpoint as envia. */
  fieldErrors: ApiFieldError[];
}

function parseApiError(error: unknown): ParsedApiError {
  const empty: ParsedApiError = {
    status: null,
    message: null,
    code: null,
    hint: null,
    fieldErrors: [],
  };
  if (!(error instanceof Error) || !error.message) return empty;

  const statusMatch = error.message.match(/^(\d{3}):\s*/);
  const status = statusMatch ? Number(statusMatch[1]) : null;
  const body = error.message.replace(/^\d{3}:\s*/, "");
  if (!body) return { ...empty, status };

  try {
    const parsed = JSON.parse(body) as {
      message?: unknown;
      code?: unknown;
      hint?: unknown;
      errors?: unknown;
    };
    if (typeof parsed !== "object" || parsed === null) return { ...empty, status };

    const message =
      typeof parsed.message === "string" && parsed.message.trim()
        ? parsed.message
        : null;

    const code =
      typeof parsed.code === "string" && parsed.code.trim() ? parsed.code : null;

    const hint =
      typeof parsed.hint === "string" && parsed.hint.trim() ? parsed.hint : null;

    const fieldErrors = Array.isArray(parsed.errors)
      ? parsed.errors.flatMap((item): ApiFieldError[] => {
          if (typeof item !== "object" || item === null) return [];
          const { field, message: fieldMessage } = item as Record<string, unknown>;
          if (typeof field !== "string" || typeof fieldMessage !== "string") {
            return [];
          }
          return [{ field, message: fieldMessage }];
        })
      : [];

    return { status, message, code, hint, fieldErrors };
  } catch {
    // Não era JSON (HTML de proxy, texto simples). Só o status é aproveitável.
    return { ...empty, status };
  }
}

/** Status HTTP do erro, quando `apiRequest` o prefixou. */
export function extractApiStatus(error: unknown): number | null {
  return parseApiError(error).status;
}

/** Código do vocabulário compartilhado, quando o endpoint o envia. */
export function extractApiErrorCode(error: unknown): string | null {
  return parseApiError(error).code;
}

/**
 * Falhas de validação por campo, no formato que o backend usa em `errors[]`.
 * Serve para chamar `form.setError` e destacar o campo no formulário em vez de
 * só mostrar um toast. Retorna lista vazia quando não há nada por campo.
 */
export function extractApiFieldErrors(error: unknown): ApiFieldError[] {
  return parseApiError(error).fieldErrors;
}

const STATUS_MESSAGES: Record<number, string> = {
  401: "Sua sessão expirou. Entre novamente para continuar.",
  403: "Você não tem permissão para realizar esta ação.",
  404: "Registro não encontrado. Ele pode ter sido excluído.",
  408: "A operação demorou demais. Tente novamente.",
  413: "O arquivo enviado é grande demais.",
  429: "Muitas tentativas seguidas. Aguarde alguns instantes.",
};

/**
 * Mensagem pronta para exibir ao usuário.
 *
 * Diferente de `extractApiMessage`, nunca cai no corpo cru da resposta: quando
 * o servidor não manda um `message` utilizável (erro de proxy, HTML, falha de
 * rede), a frase vem do status HTTP. Assim o usuário nunca vê JSON, stack ou
 * "Bad Gateway" na tela.
 */
export function getClientErrorMessage(
  error: unknown,
  fallback = "Não foi possível concluir a operação. Tente novamente.",
): string {
  const { status, message } = parseApiError(error);

  if (message) return message;
  if (status !== null && STATUS_MESSAGES[status]) return STATUS_MESSAGES[status];
  if (status !== null && status >= 500) {
    return "O servidor não conseguiu concluir a operação. Tente novamente em instantes.";
  }
  if (status === null) {
    return "Sem conexão com o servidor. Verifique sua internet e tente novamente.";
  }

  return fallback;
}

export interface ErrorPresentation {
  /** Título do toast: o que aconteceu. */
  title: string;
  /** Descrição do toast: como resolver. Ausente quando não há orientação. */
  description?: string;
}

/**
 * Converte um erro das rotas de WhatsApp em título + descrição prontos.
 *
 * Ordem de resolução:
 * 1. `code` do vocabulário compartilhado — texto controlado pelo frontend,
 *    imune a mudanças de redação no servidor;
 * 2. `message` (+ `hint`) do corpo da resposta — cobre rotas ainda não
 *    migradas e mensagens específicas que citam o item com problema;
 * 3. `getClientErrorMessage` — status HTTP / falha de rede.
 *
 * É a única função que as telas de WhatsApp precisam chamar: nunca devolve
 * JSON cru nem `"409: {...}"` na tela, que é o que acontecia ao jogar
 * `error.message` direto no toast.
 */
export function getWhatsappErrorPresentation(
  error: unknown,
  fallbackTitle = "Não foi possível concluir a operação.",
): ErrorPresentation {
  const { code, message, hint } = parseApiError(error);

  const info = whatsappErrorInfo(code);
  if (info) {
    // A mensagem do servidor ganha do texto da tabela quando existe: rotas
    // como validação de fluxo citam qual nó ou qual bot está com problema.
    return {
      title: message ?? info.message,
      description: hint ?? info.hint,
    };
  }

  if (message) {
    return { title: message, description: hint ?? undefined };
  }

  return { title: getClientErrorMessage(error, fallbackTitle) };
}
