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
  /** Falhas de validação campo a campo, quando o endpoint as envia. */
  fieldErrors: ApiFieldError[];
}

function parseApiError(error: unknown): ParsedApiError {
  const empty: ParsedApiError = { status: null, message: null, fieldErrors: [] };
  if (!(error instanceof Error) || !error.message) return empty;

  const statusMatch = error.message.match(/^(\d{3}):\s*/);
  const status = statusMatch ? Number(statusMatch[1]) : null;
  const body = error.message.replace(/^\d{3}:\s*/, "");
  if (!body) return { ...empty, status };

  try {
    const parsed = JSON.parse(body) as {
      message?: unknown;
      errors?: unknown;
    };
    if (typeof parsed !== "object" || parsed === null) return { ...empty, status };

    const message =
      typeof parsed.message === "string" && parsed.message.trim()
        ? parsed.message
        : null;

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

    return { status, message, fieldErrors };
  } catch {
    // Não era JSON (HTML de proxy, texto simples). Só o status é aproveitável.
    return { ...empty, status };
  }
}

/** Status HTTP do erro, quando `apiRequest` o prefixou. */
export function extractApiStatus(error: unknown): number | null {
  return parseApiError(error).status;
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
