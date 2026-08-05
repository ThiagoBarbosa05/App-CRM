import { WhatsAppApiError } from "../integrations/whatsapp";
import { BaileysGatewayError } from "../integrations/baileys-gateway";

/**
 * Classifica um erro como retryable ou permanent.
 *
 * Retryable:
 * - WhatsAppApiError com status 429 (rate limit) ou >= 500 (server errors)
 * - BaileysGatewayError transitório: canal offline, gateway sobrecarregado,
 *   rate limit ou gateway indisponível
 * - Erros de rede: TypeError (fetch/undici), code em {ECONNRESET, ECONNREFUSED,
 *   ETIMEDOUT, EPIPE, EAI_AGAIN, UND_ERR_*}, AbortError, TimeoutError
 *
 * Permanent:
 * - WhatsAppApiError com outros status (4xx)
 * - BaileysGatewayError de configuração/contrato (canal inexistente, chave
 *   inválida, payload grande demais)
 * - Todos os outros erros (genéricos, etc)
 */
export function classifySendError(err: unknown): "retryable" | "permanent" {
  // Verifica WhatsAppApiError
  if (err instanceof WhatsAppApiError) {
    // Status 429 (rate limit) ou >= 500 (server errors) são retryable
    if (err.status === 429 || err.status >= 500) {
      return "retryable";
    }
    // Outros status (ex: 4xx) são permanent
    return "permanent";
  }

  // Canais QR: um canal caído reconecta sozinho em segundos (backoff do
  // gateway). Antes esses erros caíam no `default: permanent` — a mensagem da
  // campanha era marcada como falha definitiva por uma queda transitória, sem
  // nenhuma retentativa. A checagem vem antes da de `code` porque
  // BaileysGatewayError TEM um campo `code`, mas com outro vocabulário.
  if (err instanceof BaileysGatewayError) {
    const retryableGatewayCodes = [
      "channel_offline",
      "overloaded",
      "rate_limited",
      "unavailable",
    ];
    return retryableGatewayCodes.includes(err.code) ? "retryable" : "permanent";
  }

  // Verifica se é um TypeError (erros de fetch/undici)
  if (err instanceof TypeError) {
    return "retryable";
  }

  // Verifica se tem propriedade 'code' (erros de rede do Node.js)
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as Record<string, unknown>).code;
    if (typeof code === "string") {
      // Lista de erros de rede retryable
      const retryableNetworkCodes = [
        "ECONNRESET",
        "ECONNREFUSED",
        "ETIMEDOUT",
        "EPIPE",
        "EAI_AGAIN",
      ];
      if (
        retryableNetworkCodes.includes(code) ||
        code.startsWith("UND_ERR_")
      ) {
        return "retryable";
      }
    }
  }

  // Verifica se é AbortError ou TimeoutError por nome
  if (err && typeof err === "object" && "name" in err) {
    const name = (err as Record<string, unknown>).name;
    if (name === "AbortError" || name === "TimeoutError") {
      return "retryable";
    }
  }

  // Default: permanent
  return "permanent";
}

/**
 * Calcula o backoff exponencial para retry.
 *
 * Padrão: 5s, 10s, 20s, 40s, 80s, ... (5 * 2^attempts segundos),
 * com teto de 300 segundos (5 minutos).
 *
 * Retorna o valor em milissegundos.
 */
export function computeBackoffMs(attemptNumber: number): number {
  const backoffSeconds = Math.min(5 * Math.pow(2, attemptNumber), 300);
  return backoffSeconds * 1000;
}
