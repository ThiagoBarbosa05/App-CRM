/**
 * Mascara PII antes de qualquer log (stdout/observability). Usada pelo middleware de
 * log de requisições em server/index.ts — que antes serializava o corpo completo da
 * resposta (CPF, telefone, email, tokens) no stdout a cada requisição /api.
 */
const SENSITIVE_KEY_PATTERN =
  /cpf|cnpj|phone|telefone|celular|whatsapp|email|birthday|nascimento|endereco|address|cep|transcription|recordingurl|accesstoken|refreshtoken|password|senha|secret|token/i;

const MAX_DEPTH = 6;

function redactValue(key: string, value: unknown, depth: number): unknown {
  if (value === null || value === undefined) return value;

  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return "[REDACTED]";
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_DEPTH) return "[array]";
    return value.map((item) => redactPii(item, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= MAX_DEPTH) return "[object]";
    return redactPii(value, depth + 1);
  }

  return value;
}

/** Retorna uma cópia de `value` com campos sensíveis substituídos por "[REDACTED]". */
export function redactPii(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_DEPTH) return Array.isArray(value) ? "[array]" : "[object]";

  if (Array.isArray(value)) {
    return value.map((item) => redactPii(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = redactValue(key, val, depth);
  }
  return result;
}
