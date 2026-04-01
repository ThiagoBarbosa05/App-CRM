import { URLSearchParams } from "url";

const DEFAULT_API_BASE_URL = "https://www.bling.com.br/Api/v3";

function getApiBaseUrl(): string {
  return process.env.BLING_API_BASE_URL || DEFAULT_API_BASE_URL;
}

/** Aguarda `ms` milissegundos. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executa uma requisição autenticada à API do Bling com retry automático
 * em caso de rate limit (HTTP 429). O Bling permite até 3 req/s, portanto
 * ao receber 429 aguarda o tempo indicado no header `Retry-After` (ou 400 ms
 * por padrão) antes de tentar novamente.
 */
async function fetchBlingApi(
  accessToken: string,
  path: string,
  params?: Record<string, string>,
  maxRetries = 3,
): Promise<Response> {
  const url = new URL(`${getApiBaseUrl()}${path}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (response.status !== 429) {
      return response;
    }

    if (attempt === maxRetries) {
      return response;
    }

    const retryAfter = response.headers.get("Retry-After");
    const waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : 400;

    console.warn(`Bling rate limit atingido. Aguardando ${waitMs}ms antes da tentativa ${attempt + 2}/${maxRetries + 1}.`);
    await sleep(waitMs);
  }

  // Nunca alcançado, mas satisfaz o TypeScript
  throw new Error("fetchBlingApi: loop de retry encerrado inesperadamente");
}

export interface BlingVendedor {
  id: number;
  descontoLimite: number;
  loja: {
    id: number;
  };
  contato: {
    id: number;
    nome: string;
    /** "A" = ativo, "I" = inativo */
    situacao: string;
  };
}

/**
 * Retorna os vendedores ativos cadastrados no Bling.
 *
 * Filtra por `situacaoContato=A` (somente ativos) conforme a API exige.
 * Respeita o rate limit de 3 req/s com retry automático em caso de HTTP 429.
 *
 * @param accessToken - Token de acesso OAuth2 válido do Bling.
 */
export async function getBlingVendedores(accessToken: string): Promise<BlingVendedor[]> {
  const response = await fetchBlingApi(accessToken, "/vendedores", { situacaoContato: "A" });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao buscar vendedores do Bling: ${errorText || response.statusText}`);
  }

  const body = (await response.json()) as { data: BlingVendedor[] };
  return body.data;
}

export interface BlingTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

interface JwtPayload {
  sub?: string;
  login?: string;
  user_id?: string;
  account_id?: string;
  account_name?: string;
  store_id?: string;
  [key: string]: unknown;
}

const DEFAULT_OAUTH_BASE_URL = "https://www.bling.com.br/Api/v3/oauth";

interface BlingOAuthClientCredentials {
  clientId: string;
  clientSecret: string;
}

function getOAuthBaseUrl(): string {
  return process.env.BLING_OAUTH_BASE_URL || DEFAULT_OAUTH_BASE_URL;
}

export function getBlingRedirectUri(): string {
  const redirectUri = process.env.BLING_REDIRECT_URI;

  if (!redirectUri) {
    throw new Error("BLING_REDIRECT_URI nao configurado");
  }

  return redirectUri;
}

function getBasicAuthorizationHeader(credentialsInput: BlingOAuthClientCredentials): string {
  const credentials = `${credentialsInput.clientId}:${credentialsInput.clientSecret}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

async function postOAuthToken(
  credentials: BlingOAuthClientCredentials,
  params: Record<string, string>,
): Promise<BlingTokenResponse> {
  const response = await fetch(`${getOAuthBaseUrl()}/token`, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthorizationHeader(credentials),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(params).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao obter token do Bling: ${errorText || response.statusText}`);
  }

  return (await response.json()) as BlingTokenResponse;
}

export function buildBlingAuthorizationUrl(
  state: string,
  credentials: Pick<BlingOAuthClientCredentials, "clientId">,
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: credentials.clientId,
    state,
  });

  return `${getOAuthBaseUrl()}/authorize?${params.toString()}`;
}

export async function exchangeAuthorizationCode(
  code: string,
  credentials: BlingOAuthClientCredentials,
): Promise<BlingTokenResponse> {
  return postOAuthToken({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
  }, {
    grant_type: "authorization_code",
    code,
  });
}

export async function refreshBlingAccessToken(
  refreshToken: string,
  credentials: BlingOAuthClientCredentials,
): Promise<BlingTokenResponse> {
  return postOAuthToken(credentials, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

export async function revokeBlingToken(
  token: string,
  credentials: BlingOAuthClientCredentials,
): Promise<void> {
  const response = await fetch(`${getOAuthBaseUrl()}/revoke`, {
    method: "POST",
    headers: {
      Authorization: getBasicAuthorizationHeader(credentials),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ token }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao revogar token do Bling: ${errorText || response.statusText}`);
  }
}

export function parseJwtPayload(token: string): JwtPayload | null {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}
