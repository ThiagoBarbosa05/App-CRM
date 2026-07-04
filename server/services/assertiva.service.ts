const TOKEN_URL = "https://api.assertivasolucoes.com.br/oauth2/v3/token";
const CPF_URL = "https://integracao.assertivasolucoes.com.br/v3/cpf";

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

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

async function getToken(): Promise<string> {
  const now = Date.now();

  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const tokenData = await fetchNewToken();

  cachedToken = tokenData.access_token;

  const expiresInSeconds = Number(tokenData.expires_in) > 0 ? Number(tokenData.expires_in) : 1800;
  tokenExpiresAt = Date.now() + Math.max(expiresInSeconds - 60, 60) * 1000;

  return cachedToken;
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
