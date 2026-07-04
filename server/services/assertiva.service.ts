const TOKEN_URL = "https://api.assertivasolucoes.com.br/oauth2/v3/token";
const CPF_URL = "https://integracao.assertivasolucoes.com.br/v3/cpf";
const CPF_LOCALIZE_URL = "https://integracao.assertivasolucoes.com.br/v3/localize/pf";

const PROACTIVE_REFRESH_WINDOW_MS = 5 * 60 * 1000;

let cachedToken: string | null = null;
let tokenExpiresAt = 0;
let lastRefreshAt: number | null = null;
let lastError: string | null = null;
let refreshInFlight: Promise<string> | null = null;

async function fetchNewToken(): Promise<{ access_token: string; expires_in: number }> {
  const clientId = process.env.ASSERTIVA_CLIENT_ID?.trim();
  const clientSecret = process.env.ASSERTIVA_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("ASSERTIVA_NOT_CONFIGURED");
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");

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
    throw new Error(`Assertiva auth failed: ${response.status} - ${responseText}`);
  }

  let data: any;
  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error("A Assertiva retornou uma resposta de autenticação que não é um JSON válido.");
  }

  if (!data.access_token) {
    throw new Error("A Assertiva não retornou access_token.");
  }

  return data;
}

async function refreshToken(): Promise<string> {
  try {
    const tokenData = await fetchNewToken();

    cachedToken = tokenData.access_token;

    const expiresInSeconds = Number(tokenData.expires_in) > 0 ? Number(tokenData.expires_in) : 1800;
    const buffer = Math.min(60, Math.floor(expiresInSeconds / 2));
    tokenExpiresAt = Date.now() + (expiresInSeconds - buffer) * 1000;

    lastRefreshAt = Date.now();
    lastError = null;

    return cachedToken;
  } catch (err: any) {
    lastError = err?.message ?? "Erro desconhecido ao renovar token da Assertiva";
    throw err;
  }
}

async function getToken(): Promise<string> {
  const now = Date.now();

  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
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
  const now = Date.now();
  const needsRefresh =
    !cachedToken || tokenExpiresAt - now < PROACTIVE_REFRESH_WINDOW_MS;

  if (!needsRefresh) {
    return;
  }

  try {
    await getToken();
  } catch {
    // lastError já foi registrado em refreshToken(); o cron não deve derrubar o processo.
  }
}

export function getAssertivaStatus() {
  const configured = !!(
    process.env.ASSERTIVA_CLIENT_ID?.trim() && process.env.ASSERTIVA_CLIENT_SECRET?.trim()
  );

  return {
    configured,
    connected: !!cachedToken && Date.now() < tokenExpiresAt,
    tokenExpiresAt: cachedToken ? new Date(tokenExpiresAt).toISOString() : null,
    lastRefreshAt: lastRefreshAt ? new Date(lastRefreshAt).toISOString() : null,
    lastError,
  };
}

export async function forceRefreshAssertivaToken() {
  cachedToken = null;
  tokenExpiresAt = 0;
  await getToken();
  return getAssertivaStatus();
}

async function doConsultarCPF(cpf: string, token: string) {
  const clean = cpf.replace(/\D/g, "");
  const res = await fetch(`${CPF_URL}/${clean}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  let data: any;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data };
}

export async function testarCPF(cpf: string) {
  const token = await getToken();
  const clean = cpf.replace(/\D/g, "");

  const [r1, r2] = await Promise.all([
    fetch(`${CPF_URL}/${clean}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }),
    fetch(`${CPF_LOCALIZE_URL}/${clean}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }),
  ]);

  const [t1, t2] = await Promise.all([r1.text(), r2.text()]);

  return {
    endpoint_cpf: { status: r1.status, url: `${CPF_URL}/${clean}`, body: safeJson(t1) },
    endpoint_localize: { status: r2.status, url: `${CPF_LOCALIZE_URL}/${clean}`, body: safeJson(t2) },
  };
}

function safeJson(text: string) {
  try { return JSON.parse(text); } catch { return { raw: text.slice(0, 500) }; }
}

export async function consultarCPF(cpf: string) {
  if (!process.env.ASSERTIVA_CLIENT_ID || !process.env.ASSERTIVA_CLIENT_SECRET) {
    throw new Error("ASSERTIVA_NOT_CONFIGURED");
  }

  let token = await getToken();
  let { status, data } = await doConsultarCPF(cpf, token);

  if (status === 401) {
    cachedToken = null;
    tokenExpiresAt = 0;
    token = await getToken();
    ({ status, data } = await doConsultarCPF(cpf, token));
  }

  if (status === 404) {
    throw new Error("CPF_NOT_FOUND");
  }

  if (status !== 200) {
    throw new Error(`Assertiva error: ${status} - ${JSON.stringify(data).slice(0, 200)}`);
  }

  return data;
}
