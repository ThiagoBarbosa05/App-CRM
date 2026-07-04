const BASE_URL = "https://integracao.assertivasolucoes.com.br/v3";

let tokenCache: { token: string; expiresAt: number } | null = null;

async function fetchToken(): Promise<string> {
  const clientId = process.env.ASSERTIVA_CLIENT_ID;
  const clientSecret = process.env.ASSERTIVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("ASSERTIVA_NOT_CONFIGURED");
  }

  const res = await fetch(`${BASE_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const body = await res.text();
  console.log(`[Assertiva] token response ${res.status}:`, body.slice(0, 600));

  if (!res.ok) {
    throw new Error(`Assertiva auth failed: ${res.status} - ${body.slice(0, 300)}`);
  }

  const data = JSON.parse(body);
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
  const body = await res.text();
  console.log(`[Assertiva] CPF response ${res.status}:`, body.slice(0, 600));
  let data: any;
  try { data = JSON.parse(body); } catch { data = { raw: body }; }
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
