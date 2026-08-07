import { isRetryableCode } from "@shared/whatsapp-error-codes";
import { describeSendError } from "./whatsapp-errors";

/**
 * Classifica um erro de envio como retryable ou permanent.
 *
 * A decisão vem do flag `retryable` da tabela de códigos: `describeSendError`
 * traduz a exceção em código e a tabela diz se vale reagendar. Antes esta
 * função tinha a própria lista de casos, paralela à de apresentação — as duas
 * podiam divergir, e o usuário via "nova tentativa agendada" em erro que
 * nunca seria retentado (ou o contrário).
 *
 * Continua valendo, agora derivado da tabela:
 * - Retryable: rate limit (429), erro 5xx do provedor, canal offline
 *   momentâneo, gateway sobrecarregado/indisponível, e erros de rede
 *   (TypeError do fetch, ECONNRESET/ETIMEDOUT/UND_ERR_*, AbortError...).
 * - Permanent: 4xx da Meta, canal inexistente no gateway, credencial
 *   ausente, payload grande demais, e qualquer erro desconhecido.
 */
export function classifySendError(err: unknown): "retryable" | "permanent" {
  return isRetryableCode(describeSendError(err).code) ? "retryable" : "permanent";
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
