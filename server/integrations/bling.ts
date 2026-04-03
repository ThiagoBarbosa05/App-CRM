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
    Object.entries(params).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
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

    console.warn(
      `Bling rate limit atingido. Aguardando ${waitMs}ms antes da tentativa ${attempt + 2}/${maxRetries + 1}.`,
    );
    await sleep(waitMs);
  }

  // Nunca alcançado, mas satisfaz o TypeScript
  throw new Error("fetchBlingApi: loop de retry encerrado inesperadamente");
}

export interface BlingPedidoVendaItem {
  id: number;
  codigo: string;
  unidade: string;
  quantidade: number;
  desconto: number;
  valor: number;
  aliquotaIPI: number;
  descricao: string;
  descricaoDetalhada: string;
  produto: { id: number };
  comissao: { base: number; aliquota: number; valor: number };
  naturezaOperacao: { id: number };
}

export interface BlingPedidoVendaParcela {
  id: number;
  dataVencimento: string;
  valor: number;
  observacoes: string;
  caut: string;
  formaPagamento: { id: number };
}

export interface BlingPedidoVenda {
  id: number;
  numero: number;
  numeroLoja: string | null;
  data: string;
  dataSaida: string | null;
  dataPrevista: string | null;
  totalProdutos: number;
  total: number;
  contato: {
    id: number;
    nome: string;
    tipoPessoa: string;
    numeroDocumento: string;
  };
  situacao: { id: number; valor: number };
  loja: { id: number; unidadeNegocio: { id: number } };
  numeroPedidoCompra: string | null;
  outrasDespesas: number;
  observacoes: string | null;
  observacoesInternas: string | null;
  desconto: { valor: number; unidade: string };
  categoria: { id: number } | null;
  notaFiscal: { id: number } | null;
  tributacao: { totalICMS: number; totalIPI: number };
  itens: BlingPedidoVendaItem[];
  parcelas: BlingPedidoVendaParcela[];
  transporte: {
    fretePorConta: number;
    frete: number;
    quantidadeVolumes: number;
    pesoBruto: number;
    prazoEntrega: number;
    contato: { id: number; nome: string } | null;
    etiqueta: {
      nome: string;
      endereco: string;
      numero: string;
      complemento: string;
      municipio: string;
      uf: string;
      cep: string;
      bairro: string;
      nomePais: string;
    } | null;
    volumes: Array<{ id: number; servico: string; codigoRastreamento: string }>;
  };
  vendedor: { id: number } | null;
  intermediador: { cnpj: string; nomeUsuario: string } | null;
  taxas: { taxaComissao: number; custoFrete: number; valorBase: number } | null;
}

/**
 * Busca os detalhes de um pedido de venda pelo ID no Bling.
 *
 * Em caso de 401/403 (token expirado), chama `onTokenRefresh` para obter um
 * novo access token e repete a requisição uma única vez.
 *
 * @param accessToken  - Token de acesso OAuth2 válido do Bling.
 * @param pedidoId     - ID do pedido de venda no Bling.
 * @param onTokenRefresh - Callback opcional que renova o token e retorna o novo access token.
 */
export async function getBlingPedidoVenda(
  accessToken: string,
  pedidoId: number,
  onTokenRefresh?: () => Promise<string>,
): Promise<BlingPedidoVenda> {
  let token = accessToken;

  let response = await fetchBlingApi(token, `/pedidos/vendas/${pedidoId}`);

  if ((response.status === 401 || response.status === 403) && onTokenRefresh) {
    token = await onTokenRefresh();
    response = await fetchBlingApi(token, `/pedidos/vendas/${pedidoId}`);
  }

  if (response.status === 404) {
    throw new Error(`Pedido de venda ${pedidoId} nao encontrado no Bling`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha ao buscar pedido de venda do Bling: ${errorText || response.statusText}`,
    );
  }

  const body = (await response.json()) as { data: BlingPedidoVenda };
  return body.data;
}

// ---------------------------------------------------------------------------
// Lista paginada de pedidos de venda
// ---------------------------------------------------------------------------

/**
 * Resumo de um pedido de venda retornado pelo endpoint de listagem.
 * Contém dados básicos — para itens e parcelas use `getBlingPedidoVenda`.
 */
export interface BlingPedidoVendaSummary {
  id: number;
  numero: number;
  numeroPedidoCompra: string | null;
  data: string;
  dataSaida: string | null;
  dataPrevista: string | null;
  totalProdutos: number;
  total: number;
  situacao: { id: number; valor: number };
  contato: {
    id: number;
    nome: string;
    tipoPessoa: string;
    numeroDocumento: string;
  };
  loja: { id: number };
  vendedor: { id: number } | null;
}

export interface GetBlingPedidosVendasParams {
  /** Página de resultados (default: 1) */
  pagina?: number;
  /** Itens por página — máximo 100 (default: 100) */
  limite?: number;
  /** Data inicial de venda no formato yyyy-MM-dd */
  dataInicial?: string;
  /** Data final de venda no formato yyyy-MM-dd */
  dataFinal?: string;
  idContato?: number;
  idVendedor?: number;
  idSituacao?: number;
  idLoja?: number;
  numero?: number;
}

/**
 * Lista pedidos de venda do Bling com suporte a paginação.
 *
 * O Bling retorna no máximo 100 pedidos por página. Para importação completa,
 * continue incrementando `pagina` até receber um array vazio ou com menos de
 * `limite` itens.
 *
 * @param accessToken    - Token de acesso OAuth2 válido do Bling.
 * @param params         - Filtros e paginação.
 * @param onTokenRefresh - Callback opcional que renova o token e retorna o novo access token.
 */
export async function getBlingPedidosVendas(
  accessToken: string,
  params: GetBlingPedidosVendasParams = {},
  onTokenRefresh?: () => Promise<string>,
): Promise<BlingPedidoVendaSummary[]> {
  let token = accessToken;

  const queryParams: Record<string, string> = {
    limite: String(params.limite ?? 100),
  };
  if (params.pagina !== undefined) queryParams.pagina = String(params.pagina);
  if (params.dataInicial) queryParams.dataInicial = params.dataInicial;
  if (params.dataFinal) queryParams.dataFinal = params.dataFinal;
  if (params.idContato !== undefined)
    queryParams.idContato = String(params.idContato);
  if (params.idVendedor !== undefined)
    queryParams.idVendedor = String(params.idVendedor);
  if (params.idSituacao !== undefined)
    queryParams.idSituacao = String(params.idSituacao);
  if (params.idLoja !== undefined) queryParams.idLoja = String(params.idLoja);
  if (params.numero !== undefined) queryParams.numero = String(params.numero);

  let response = await fetchBlingApi(token, "/pedidos/vendas", queryParams);

  if ((response.status === 401 || response.status === 403) && onTokenRefresh) {
    token = await onTokenRefresh();
    response = await fetchBlingApi(token, "/pedidos/vendas", queryParams);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha ao listar pedidos de venda do Bling: ${errorText || response.statusText}`,
    );
  }

  const body = (await response.json()) as { data: BlingPedidoVendaSummary[] };
  return body.data ?? [];
}

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------

export interface BlingProdutoEstoque {
  saldoVirtualTotal: number;
}

export interface BlingProduto {
  id: number;
  idProdutoPai: number | null;
  nome: string;
  codigo: string;
  preco: number;
  precoCusto: number;
  estoque: BlingProdutoEstoque;
  tipo: string;
  situacao: string;
  formato: string;
  descricaoCurta: string | null;
  imagemURL: string | null;
}

/**
 * Lista produtos cadastrados no Bling.
 *
 * Em caso de 401/403 (token expirado), chama `onTokenRefresh` para obter um
 * novo access token e repete a requisição uma única vez.
 *
 * @param accessToken    - Token de acesso OAuth2 válido do Bling.
 * @param pagina         - Página de resultados (opcional).
 * @param limite         - Quantidade de itens por página (opcional).
 * @param onTokenRefresh - Callback opcional que renova o token e retorna o novo access token.
 */
export async function getBlingProdutos(
  accessToken: string,
  pagina?: number,
  limite?: number,
  onTokenRefresh?: () => Promise<string>,
): Promise<BlingProduto[]> {
  let token = accessToken;

  const params: Record<string, string> = {};
  if (pagina !== undefined) params.pagina = String(pagina);
  if (limite !== undefined) params.limite = String(limite);

  let response = await fetchBlingApi(token, "/produtos", params);

  if ((response.status === 401 || response.status === 403) && onTokenRefresh) {
    token = await onTokenRefresh();
    response = await fetchBlingApi(token, "/produtos", params);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha ao buscar produtos do Bling: ${errorText || response.statusText}`,
    );
  }

  const body = (await response.json()) as { data: BlingProduto[] };
  return body.data;
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
export async function getBlingVendedores(
  accessToken: string,
): Promise<BlingVendedor[]> {
  const response = await fetchBlingApi(accessToken, "/vendedores", {
    situacaoContato: "A",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha ao buscar vendedores do Bling: ${errorText || response.statusText}`,
    );
  }

  const body = (await response.json()) as { data: BlingVendedor[] };
  return body.data;
}

export interface BlingCompanyInfo {
  id: string;
}

/**
 * Retorna o ID da empresa (companyId) a partir dos dados básicos da conta Bling.
 *
 * Necessário para vincular o companyId recebido no webhook à conexão correta.
 *
 * @param accessToken    - Token de acesso OAuth2 válido do Bling.
 * @param onTokenRefresh - Callback opcional que renova o token e retorna o novo access token.
 */
export async function getBlingCompanyInfo(
  accessToken: string,
  onTokenRefresh?: () => Promise<string>,
): Promise<BlingCompanyInfo> {
  let token = accessToken;

  let response = await fetchBlingApi(token, "/empresas/me/dados-basicos");

  if ((response.status === 401 || response.status === 403) && onTokenRefresh) {
    token = await onTokenRefresh();
    response = await fetchBlingApi(token, "/empresas/me/dados-basicos");
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha ao buscar dados da empresa no Bling: ${errorText || response.statusText}`,
    );
  }

  const body = (await response.json()) as { data: { id: string } };
  return { id: String(body.data.id) };
}

export interface BlingContato {
  id: number;
  nome: string | null;
  telefone: string | null;
  celular: string | null;
  tipo: string | null;
  numeroDocumento: string | null;
  email: string | null;
  fantasia: string | null;
}

/**
 * Retorna os dados de um contato pelo ID no Bling.
 *
 * Usado para enriquecer os dados do pedido recebido via webhook com telefone,
 * celular, tipo de pessoa e CPF/CNPJ do contato.
 *
 * @param accessToken    - Token de acesso OAuth2 válido do Bling.
 * @param contatoId      - ID do contato no Bling.
 * @param onTokenRefresh - Callback opcional que renova o token e retorna o novo access token.
 */
export async function getBlingContato(
  accessToken: string,
  contatoId: number,
  onTokenRefresh?: () => Promise<string>,
): Promise<BlingContato> {
  let token = accessToken;

  let response = await fetchBlingApi(token, `/contatos/${contatoId}`);

  if ((response.status === 401 || response.status === 403) && onTokenRefresh) {
    token = await onTokenRefresh();
    response = await fetchBlingApi(token, `/contatos/${contatoId}`);
  }

  if (response.status === 404) {
    throw new Error(`Contato ${contatoId} não encontrado no Bling`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha ao buscar contato do Bling: ${errorText || response.statusText}`,
    );
  }

  const body = (await response.json()) as {
    data: {
      id: number;
      nome: string | null;
      telefone: string | null;
      celular: string | null;
      tipo: string | null;
      numeroDocumento: string | null;
      email: string | null;
      fantasia: string | null;
    };
  };

  return {
    id: body.data.id,
    nome: body.data.nome ?? null,
    telefone: body.data.telefone ?? null,
    celular: body.data.celular ?? null,
    tipo: body.data.tipo ?? null,
    numeroDocumento: body.data.numeroDocumento ?? null,
    email: body.data.email ?? null,
    fantasia: body.data.fantasia ?? null,
  };
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

function getBasicAuthorizationHeader(
  credentialsInput: BlingOAuthClientCredentials,
): string {
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
    throw new Error(
      `Falha ao obter token do Bling: ${errorText || response.statusText}`,
    );
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
  return postOAuthToken(
    {
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
    },
    {
      grant_type: "authorization_code",
      code,
    },
  );
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
    throw new Error(
      `Falha ao revogar token do Bling: ${errorText || response.statusText}`,
    );
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
