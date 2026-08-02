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
