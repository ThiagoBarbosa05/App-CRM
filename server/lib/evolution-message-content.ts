function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function extractEvolutionSerializedConversation(value: unknown): string | null {
  const parsed = asRecord(value) ?? (typeof value === "string"
    ? (() => {
        try { return asRecord(JSON.parse(value)); } catch { return null; }
      })()
    : null);
  return typeof parsed?.conversation === "string" ? parsed.conversation : null;
}
