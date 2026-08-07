import type { Response } from "express";
import {
  WHATSAPP_ERRORS,
  type WhatsappErrorCode,
} from "@shared/whatsapp-error-codes";
import { WhatsAppApiError } from "../integrations/whatsapp";
import { BaileysGatewayError, type GatewayErrorCode } from "../integrations/baileys-gateway";
import {
  CampaignConfigError,
  CampaignRequeueBlockedError,
} from "./whatsapp-campaign-errors";
import { BotFlowValidationError } from "./whatsapp-bot.service";
import { BotCompatibilityLookupError } from "./whatsapp-bot-compatibility.service";

/**
 * Erro de domínio do fluxo de bots/disparos do WhatsApp.
 *
 * Mesmo desenho de `ClientOperationError` (clients.errors.ts): o que o usuário
 * vê fica em `userMessage`/`hint` e o detalhe técnico em `message`, que só vai
 * para o log. A diferença é o `code`, que também sai na resposta para o
 * frontend poder decidir o texto e o CTA sem depender da redação do servidor.
 */
export class WhatsappOperationError extends Error {
  readonly code: WhatsappErrorCode;
  readonly userMessage: string;
  readonly hint?: string;
  readonly httpStatus: number;
  /** Payload extra anexado à resposta (ex: `compatibility`, contadores). */
  readonly details?: Record<string, unknown>;
  /**
   * Falha estrutural: retentar no próximo tick não resolve. O dispatcher usa
   * isso para marcar a campanha como `failed` em vez de repetir para sempre.
   */
  readonly permanent: boolean;

  constructor(
    code: WhatsappErrorCode,
    options?: {
      httpStatus?: number;
      hint?: string;
      details?: Record<string, unknown>;
      technicalMessage?: string;
      messageOverride?: string;
      permanent?: boolean;
    },
  ) {
    const info = WHATSAPP_ERRORS[code];
    const userMessage = options?.messageOverride ?? info.message;
    super(options?.technicalMessage ?? userMessage);
    this.name = "WhatsappOperationError";
    this.code = code;
    this.userMessage = userMessage;
    this.hint = options?.hint ?? info.hint;
    this.httpStatus = options?.httpStatus ?? info.httpStatus;
    this.details = options?.details;
    this.permanent = options?.permanent ?? false;
  }
}

/** Açúcar para `new WhatsappOperationError(...)`. */
export function waError(
  code: WhatsappErrorCode,
  options?: ConstructorParameters<typeof WhatsappOperationError>[1],
): WhatsappOperationError {
  return new WhatsappOperationError(code, options);
}

const GATEWAY_CODE_MAP: Record<GatewayErrorCode, WhatsappErrorCode> = {
  not_configured: "SEND_CREDENTIALS_MISSING",
  unauthorized: "SEND_CREDENTIALS_MISSING",
  // `not_found` é o canal não existir no gateway — não adianta reagendar,
  // diferente de `channel_offline`, que é uma queda momentânea.
  not_found: "SEND_CHANNEL_NOT_REGISTERED",
  idempotency_conflict: "SEND_PROVIDER_REJECTED",
  payload_too_large: "SEND_PROVIDER_REJECTED",
  rate_limited: "SEND_RATE_LIMITED",
  overloaded: "SEND_PROVIDER_UNAVAILABLE",
  channel_offline: "SEND_CHANNEL_OFFLINE",
  unavailable: "SEND_PROVIDER_UNAVAILABLE",
  unexpected: "SEND_PROVIDER_REJECTED",
};

/**
 * Traduz um erro de envio em código + texto técnico.
 *
 * Complementa (não substitui) `classifySendError` de
 * `whatsapp-campaign-retry.ts`: lá se decide se vale retentar, aqui se decide
 * o que o usuário lê. Reaproveita a union de códigos que o
 * `BaileysGatewayError` já carrega e o status HTTP do `WhatsAppApiError`.
 */
export function describeSendError(err: unknown): {
  code: WhatsappErrorCode;
  detail: string;
} {
  const detail = err instanceof Error ? err.message : String(err);

  if (err instanceof WhatsappOperationError) {
    return { code: err.code, detail };
  }

  if (err instanceof BaileysGatewayError) {
    return { code: GATEWAY_CODE_MAP[err.code] ?? "SEND_PROVIDER_REJECTED", detail };
  }

  if (err instanceof WhatsAppApiError) {
    if (err.status === 429) return { code: "SEND_RATE_LIMITED", detail };
    if (err.status >= 500) return { code: "SEND_PROVIDER_UNAVAILABLE", detail };
    return { code: "SEND_PROVIDER_REJECTED", detail };
  }

  // Rede: mesma família que `classifySendError` considera retryable.
  if (err instanceof TypeError) {
    return { code: "SEND_PROVIDER_UNAVAILABLE", detail };
  }
  if (err && typeof err === "object") {
    const asRecord = err as Record<string, unknown>;
    const code = asRecord.code;
    if (
      typeof code === "string" &&
      (code.startsWith("UND_ERR_") ||
        ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "EAI_AGAIN"].includes(
          code,
        ))
    ) {
      return { code: "SEND_PROVIDER_UNAVAILABLE", detail };
    }
    if (asRecord.name === "AbortError" || asRecord.name === "TimeoutError") {
      return { code: "SEND_PROVIDER_UNAVAILABLE", detail };
    }
  }

  // `getConfig` lança Error puro quando faltam wa_phone_number_id/token.
  if (detail.includes("WhatsApp não configurado")) {
    return { code: "SEND_CREDENTIALS_MISSING", detail };
  }

  return { code: "UNEXPECTED", detail };
}

/**
 * Decide o que o dispatcher faz com uma exceção de `executeCampaign`.
 *
 * `permanent: true` significa que retentar no próximo tick não resolve — a
 * campanha deve ser encerrada como `failed` com este código. Qualquer outra
 * coisa (rede, banco, bug) é transitória e continua sendo retentada, que é o
 * comportamento correto para essas.
 */
export function classifyDispatchFailure(
  error: unknown,
): { permanent: true; code: WhatsappErrorCode } | { permanent: false } {
  if (error instanceof WhatsappOperationError && error.permanent) {
    return { permanent: true, code: error.code };
  }
  if (error instanceof CampaignConfigError) {
    return { permanent: true, code: "CAMPAIGN_NO_CONTENT" };
  }
  return { permanent: false };
}

export interface WhatsappErrorResponseBody {
  /** Mantido para compatibilidade com quem ainda lê só `message`. */
  message: string;
  code: WhatsappErrorCode;
  hint?: string;
  [key: string]: unknown;
}

/** Normaliza qualquer erro conhecido do domínio em código + status + payload. */
export function toWhatsappErrorResponse(error: unknown): {
  status: number;
  body: WhatsappErrorResponseBody;
} {
  if (error instanceof WhatsappOperationError) {
    return {
      status: error.httpStatus,
      body: {
        ...(error.details ?? {}),
        message: error.userMessage,
        code: error.code,
        ...(error.hint ? { hint: error.hint } : {}),
      },
    };
  }

  const asTyped = (
    code: WhatsappErrorCode,
    status: number,
    message: string,
  ): { status: number; body: WhatsappErrorResponseBody } => ({
    status,
    body: {
      message,
      code,
      ...(WHATSAPP_ERRORS[code].hint ? { hint: WHATSAPP_ERRORS[code].hint } : {}),
    },
  });

  // Erros de domínio que já existiam antes do vocabulário de códigos: a
  // mensagem deles é escrita para o usuário e costuma citar o problema
  // específico (qual nó, qual bot), então preservamos o texto e só anexamos o
  // código.
  if (error instanceof BotFlowValidationError) {
    return asTyped("BOT_FLOW_INVALID", error.statusCode, error.message);
  }
  if (error instanceof BotCompatibilityLookupError) {
    return asTyped(
      error.statusCode === 404 ? "BOT_NOT_FOUND" : "BOT_INCOMPATIBLE_CHANNEL",
      error.statusCode,
      error.message,
    );
  }
  if (error instanceof CampaignRequeueBlockedError) {
    return asTyped("CAMPAIGN_REQUEUE_BLOCKED", 409, error.message);
  }
  if (error instanceof CampaignConfigError) {
    return asTyped("CAMPAIGN_NO_CONTENT", 400, error.message);
  }

  return asTyped(
    "UNEXPECTED",
    500,
    WHATSAPP_ERRORS.UNEXPECTED.message,
  );
}

/**
 * Handler único das rotas de WhatsApp.
 *
 * Erro desconhecido vira 500 `UNEXPECTED` com frase genérica — o texto
 * original vai para o log, nunca para a resposta. Era exatamente o vazamento
 * do catch-all antigo, que devolvia `e.message` (texto de driver do Postgres,
 * corpo cru da Meta) direto na tela.
 */
export function respondWhatsappError(
  res: Response,
  error: unknown,
  logPrefix: string,
): Response {
  const { status, body } = toWhatsappErrorResponse(error);

  if (body.code === "UNEXPECTED") {
    console.error(`${logPrefix}:`, error);
  } else if (status >= 500) {
    console.error(`${logPrefix} [${body.code}]:`, error);
  } else {
    console.warn(
      `${logPrefix} [${body.code}]:`,
      error instanceof Error ? error.message : error,
    );
  }

  return res.status(status).json(body);
}
