import OpenAI from "openai";

let lastCheckedAt: number | null = null;
let lastError: string | null = null;
let connected = false;

export function getOpenAIStatus() {
  const configured = !!process.env.OPENAI_API_KEY?.trim();

  return {
    configured,
    connected: configured && connected,
    lastCheckedAt: lastCheckedAt ? new Date(lastCheckedAt).toISOString() : null,
    lastError,
  };
}

export async function testOpenAIConnection() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    connected = false;
    lastError = "OPENAI_API_KEY não configurada.";
    lastCheckedAt = Date.now();
    return getOpenAIStatus();
  }

  try {
    const client = new OpenAI({ apiKey });
    await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    });

    connected = true;
    lastError = null;
  } catch (err: any) {
    connected = false;
    lastError = err?.error?.message ?? err?.message ?? "Erro desconhecido ao conectar com a OpenAI.";
  } finally {
    lastCheckedAt = Date.now();
  }

  return getOpenAIStatus();
}
