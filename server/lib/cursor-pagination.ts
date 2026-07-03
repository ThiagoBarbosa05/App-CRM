/**
 * Cursor opaco para paginação por conjunto de chaves (keyset pagination).
 * `at` é o timestamp (ISO) do item de fronteira; `id` desempata quando dois
 * itens têm exatamente o mesmo timestamp (ex.: sincronizações em lote). `at`
 * só é `null` no bucket "sem timestamp" da lista de conversas (conversas sem
 * nenhuma mensagem ainda).
 */
export interface Cursor {
  at: string | null;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf-8").toString("base64url");
}

/** Cursor inválido/malformado vira `null` (tratado como "primeira página"), nunca lança. */
export function decodeCursor(raw: unknown): Cursor | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf-8"),
    );
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "id" in parsed &&
      typeof (parsed as { id: unknown }).id === "string" &&
      "at" in parsed &&
      ((parsed as { at: unknown }).at === null ||
        typeof (parsed as { at: unknown }).at === "string")
    ) {
      return parsed as Cursor;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Trava um `limit` dentro de [1, max], usando `fallback` quando ausente/inválido.
 * Aceita tanto `string` (query param cru, ex.: rotas) quanto `number` (já
 * parseado, ex.: quando um service recebe `pagination.limit` de um caller
 * interno) — os dois layers (rota e service) chamam `clampLimit`, então
 * precisa aceitar ambos os formatos.
 */
export function clampLimit(
  raw: unknown,
  options: { fallback: number; max: number },
): number {
  const parsed =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : NaN;
  if (!Number.isFinite(parsed) || parsed < 1) return options.fallback;
  return Math.min(parsed, options.max);
}
