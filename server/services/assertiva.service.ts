const BASE_URL = "https://integracao.assertivasolucoes.com.br/v3";

let tokenCache: { token: string; expiresAt: number } | null = null;

async function fetchToken(): Promise<string> {
  const clientId = process.env.ASSERTIVA_CLIENT_ID?.trim();
  const clientSecret = process.env.ASSERTIVA_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("ASSERTIVA_NOT_CONFIGURED");
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${BASE_URL}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${basicAuth}`,
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    throw new Error(`Assertiva auth failed: ${res.status} - ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

async function getToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }
  const token = await fetchToken();
  tokenCache = { token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return token;
}

async function doConsultarCPF(cpf: string, token: string) {
  const clean = cpf.replace(/\D/g, "");
  const res = await fetch(`${BASE_URL}/cpf/${clean}`, {
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
    tokenCache = null;
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
