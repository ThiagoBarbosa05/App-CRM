import { db } from "server/db";
import { assertivaTokens } from "@shared/schema";
import { eq } from "drizzle-orm";

const TOKEN_URL = "https://api.assertivasolucoes.com.br/oauth2/v3/token";
const CPF_URL = "https://api.assertivasolucoes.com.br/localize/v3/cpf";

const PROACTIVE_REFRESH_WINDOW_MS = 5 * 60 * 1000;
const TOKEN_ROW_ID = "singleton";

// Deduplica chamadas concorrentes de refresh dentro do mesmo processo. Não precisa
// ser persistido: o token em si (fonte da verdade) vive na tabela `assertiva_tokens`.
let refreshInFlight: Promise<string> | null = null;

async function readTokenRow() {
  const [row] = await db
    .select()
    .from(assertivaTokens)
    .where(eq(assertivaTokens.id, TOKEN_ROW_ID))
    .limit(1);
  return row;
}

async function upsertTokenRow(patch: {
  accessToken?: string | null;
  expiresAt?: Date | null;
  lastRefreshAt?: Date | null;
  lastError?: string | null;
}) {
  await db
    .insert(assertivaTokens)
    .values({ id: TOKEN_ROW_ID, ...patch, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: assertivaTokens.id,
      set: { ...patch, updatedAt: new Date() },
    });
}

async function fetchNewToken(): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const clientId = process.env.ASSERTIVA_CLIENT_ID?.trim();
  const clientSecret = process.env.ASSERTIVA_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("ASSERTIVA_NOT_CONFIGURED");
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString(
    "base64",
  );

  const body = new URLSearchParams();
  body.append("grant_type", "client_credentials");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Assertiva auth failed: ${response.status} - ${responseText}`,
    );
  }

  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error(
      "A Assertiva retornou uma resposta de autenticação que não é um JSON válido.",
    );
  }

  if (!data.access_token) {
    throw new Error("A Assertiva não retornou access_token.");
  }

  return data;
}

async function refreshToken(): Promise<string> {
  try {
    const tokenData = await fetchNewToken();

    const expiresInSeconds =
      Number(tokenData.expires_in) > 0 ? Number(tokenData.expires_in) : 1800;
    const buffer = Math.min(60, Math.floor(expiresInSeconds / 2));
    const expiresAt = new Date(Date.now() + (expiresInSeconds - buffer) * 1000);

    await upsertTokenRow({
      accessToken: tokenData.access_token,
      expiresAt,
      lastRefreshAt: new Date(),
      lastError: null,
    });

    return tokenData.access_token;
  } catch (err: any) {
    const message =
      err?.message ?? "Erro desconhecido ao renovar token da Assertiva";
    await upsertTokenRow({ lastError: message }).catch(() => {});
    throw err;
  }
}

async function getToken(): Promise<string> {
  const row = await readTokenRow();
  const now = Date.now();

  if (row?.accessToken && row.expiresAt && row.expiresAt.getTime() > now) {
    return row.accessToken;
  }

  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = refreshToken().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function ensureFreshToken(): Promise<void> {
  const row = await readTokenRow();
  const now = Date.now();
  const needsRefresh =
    !row?.accessToken ||
    !row.expiresAt ||
    row.expiresAt.getTime() - now < PROACTIVE_REFRESH_WINDOW_MS;

  if (!needsRefresh) {
    return;
  }

  try {
    await getToken();
  } catch {
    // lastError já foi registrado em refreshToken(); o cron não deve derrubar o processo.
  }
}

export async function getAssertivaStatus() {
  const configured = !!(
    process.env.ASSERTIVA_CLIENT_ID?.trim() &&
    process.env.ASSERTIVA_CLIENT_SECRET?.trim()
  );

  const row = await readTokenRow();
  const now = Date.now();
  const connected = !!(row?.accessToken && row.expiresAt && row.expiresAt.getTime() > now);

  return {
    configured,
    connected,
    tokenExpiresAt: row?.expiresAt ? row.expiresAt.toISOString() : null,
    lastRefreshAt: row?.lastRefreshAt ? row.lastRefreshAt.toISOString() : null,
    lastError: row?.lastError ?? null,
  };
}

export async function forceRefreshAssertivaToken() {
  await refreshToken();
  return getAssertivaStatus();
}

function buildCpfUrl(cpf: string): string {
  const clean = cpf.replace(/\D/g, "");
  return `${CPF_URL}?cpf=${clean}&idFinalidade=1`;
}

async function doConsultarCPF(cpf: string, token: string) {
  const res = await fetch(buildCpfUrl(cpf), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  let data: any;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  return { status: res.status, data };
}

export async function testarCPF(cpf: string) {
  const token = await getToken();
  const url = buildCpfUrl(cpf);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await res.text();

  return {
    endpoint_cpf: {
      status: res.status,
      url,
      body: safeJson(text),
    },
  };
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

export async function consultarCPF(cpf: string) {
  if (
    !process.env.ASSERTIVA_CLIENT_ID ||
    !process.env.ASSERTIVA_CLIENT_SECRET
  ) {
    throw new Error("ASSERTIVA_NOT_CONFIGURED");
  }

  let token = await getToken();
  let { status, data } = await doConsultarCPF(cpf, token);

  if (status === 401) {
    token = await refreshToken();
    ({ status, data } = await doConsultarCPF(cpf, token));
  }

  if (status === 404) {
    throw new Error("CPF_NOT_FOUND");
  }

  if (status !== 200) {
    throw new Error(
      `Assertiva error: ${status} - ${JSON.stringify(data).slice(0, 200)}`,
    );
  }

  return data;
}

/**
 * Converte uma data em formato dd/MM/yyyy (comum em respostas de bureaus de dados) para
 * ISO (yyyy-MM-dd), que é o formato já usado em `client.birthday`. Se já vier em ISO, mantém.
 */
function normalizeBirthdayToIso(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;

  const brMatch = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month}-${day}`;
  }

  const isoMatch = value.match(/^\d{4}-\d{2}-\d{2}/);
  if (isoMatch) return isoMatch[0];

  return undefined;
}

/**
 * Mapeamento da resposta de `/localize/v3/cpf` (confirmado via chamada real — ver
 * `docs`/`swagger.json`) para os campos equivalentes do cliente. Os dados cadastrais
 * ficam em `resposta.dadosCadastrais`.
 */
export function mapAssertivaCpfResponse(raw: any): {
  name?: string;
  birthday?: string;
  sexo?: "M" | "F";
} {
  const dadosCadastrais = raw?.resposta?.dadosCadastrais;
  const nome = dadosCadastrais?.nome;
  const dataNascimento = dadosCadastrais?.dataNascimento;
  const sexoRaw = dadosCadastrais?.sexo;

  const mapped: { name?: string; birthday?: string; sexo?: "M" | "F" } = {};
  if (typeof nome === "string" && nome.trim()) mapped.name = nome.trim();

  const birthday = normalizeBirthdayToIso(dataNascimento);
  if (birthday) mapped.birthday = birthday;

  if (sexoRaw === "M" || sexoRaw === "F") mapped.sexo = sexoRaw;

  return mapped;
}
