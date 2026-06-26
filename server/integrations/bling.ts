import { URLSearchParams } from "url";

const DEFAULT_API_BASE_URL = "https://api.bling.com.br/Api/v3";

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
  init?: RequestInit,
  maxRetries = 3,
): Promise<Response> {
  const url = new URL(`${getApiBaseUrl()}${path}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) =>
      url.searchParams.set(key, value),
    );
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${accessToken}`);

    if (!headers.has("Accept")) {
      headers.set("Accept", "application/json");
    }

    const response = await fetch(url.toString(), {
      ...init,
      method: init?.method ?? "GET",
      headers,
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

export interface BlingProdutoDetalheEstoque {
  minimo: number | null;
  maximo: number | null;
  crossdocking: number | null;
  localizacao: string | null;
  saldoVirtualTotal: number;
}

export interface BlingProdutoDetalheFornecedor {
  id: number;
  contato: { id: number; nome: string } | null;
  codigo: string | null;
  precoCusto: number | null;
  precoCompra: number | null;
}

export interface BlingProdutoDetalheDimensoes {
  largura: number | null;
  altura: number | null;
  profundidade: number | null;
  unidadeMedida: number | null;
}

export interface BlingProdutoDetalheTributacao {
  origem: number | null;
  ncm: string | null;
  cest: string | null;
  percentualTributos: number | null;
}

export interface BlingProdutoDetalheImagemInterna {
  link: string;
  linkMiniatura: string | null;
  validade: string | null;
  ordem: number | null;
}

export interface BlingProdutoDetalheImagemExterna {
  link: string;
}

export interface BlingProdutoDetalheVariacao {
  id: number;
  nome: string | null;
  codigo: string | null;
  preco: number | null;
  tipo: string | null;
  situacao: string | null;
  formato: string | null;
  descricaoCurta: string | null;
  imagemURL: string | null;
  unidade: string | null;
  pesoLiquido: number | null;
  pesoBruto: number | null;
  marca: string | null;
  estoque: BlingProdutoDetalheEstoque | null;
  fornecedor: BlingProdutoDetalheFornecedor | null;
  dimensoes: BlingProdutoDetalheDimensoes | null;
  categoria: { id: number } | null;
  tributacao: BlingProdutoDetalheTributacao | null;
  variacao: {
    nome: string | null;
    ordem: number | null;
    produtoPai: { id: number } | null;
  } | null;
}

export interface BlingProdutoDetalhe {
  id: number;
  nome: string | null;
  codigo: string | null;
  preco: number | null;
  tipo: string | null;
  situacao: string | null;
  formato: string | null;
  descricaoCurta: string | null;
  imagemURL: string | null;
  unidade: string | null;
  pesoLiquido: number | null;
  pesoBruto: number | null;
  marca: string | null;
  categoria: { id: number } | null;
  estoque: BlingProdutoDetalheEstoque | null;
  fornecedor: BlingProdutoDetalheFornecedor | null;
  dimensoes: BlingProdutoDetalheDimensoes | null;
  tributacao: BlingProdutoDetalheTributacao | null;
  midia: {
    video: { url: string | null } | null;
    imagens: {
      externas: BlingProdutoDetalheImagemExterna[];
      internas: BlingProdutoDetalheImagemInterna[];
    } | null;
  } | null;
  variacoes: BlingProdutoDetalheVariacao[];
}

/**
 * Busca os detalhes completos de um produto pelo ID no Bling.
 *
 * Em caso de 401/403 (token expirado), chama `onTokenRefresh` para obter um
 * novo access token e repete a requisição uma única vez.
 *
 * @param accessToken    - Token de acesso OAuth2 válido do Bling.
 * @param produtoId      - ID do produto no Bling.
 * @param onTokenRefresh - Callback opcional que renova o token e retorna o novo access token.
 */
export async function getBlingProduto(
  accessToken: string,
  produtoId: number,
  onTokenRefresh?: () => Promise<string>,
): Promise<BlingProdutoDetalhe> {
  let token = accessToken;

  let response = await fetchBlingApi(token, `/produtos/${produtoId}`);

  if ((response.status === 401 || response.status === 403) && onTokenRefresh) {
    token = await onTokenRefresh();
    response = await fetchBlingApi(token, `/produtos/${produtoId}`);
  }

  if (response.status === 404) {
    throw new Error(`Produto ${produtoId} não encontrado no Bling`);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha ao buscar produto do Bling: ${errorText || response.statusText}`,
    );
  }

  const body = (await response.json()) as { data: BlingProdutoDetalhe };
  return body.data;
}

// ---------------------------------------------------------------------------
// Categorias de produto
// ---------------------------------------------------------------------------

export interface BlingCategoriaProduto {
  id: number;
  descricao: string;
  categoriaPai: { id: number } | null;
}

/**
 * Busca os dados de uma categoria de produto pelo ID no Bling.
 *
 * Em caso de 401/403 (token expirado), chama `onTokenRefresh` para obter um
 * novo access token e repete a requisição uma única vez.
 *
 * @param accessToken       - Token de acesso OAuth2 válido do Bling.
 * @param categoriaProdutoId - ID da categoria de produto no Bling.
 * @param onTokenRefresh    - Callback opcional que renova o token e retorna o novo access token.
 */
export async function getBlingCategoriaProduto(
  accessToken: string,
  categoriaProdutoId: number,
  onTokenRefresh?: () => Promise<string>,
): Promise<BlingCategoriaProduto> {
  let token = accessToken;
  const path = `/categorias/produtos/${categoriaProdutoId}`;

  let response = await fetchBlingApi(token, path);

  if ((response.status === 401 || response.status === 403) && onTokenRefresh) {
    token = await onTokenRefresh();
    response = await fetchBlingApi(token, path);
  }

  if (response.status === 404) {
    throw new Error(
      `Categoria de produto ${categoriaProdutoId} não encontrada no Bling`,
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha ao buscar categoria de produto do Bling: ${errorText || response.statusText}`,
    );
  }

  const body = (await response.json()) as {
    data: {
      id: number;
      descricao: string;
      categoriaPai?: { id: number } | null;
    };
  };

  return {
    id: body.data.id,
    descricao: body.data.descricao,
    categoriaPai: body.data.categoriaPai ?? null,
  };
}

/**
 * Lista as categorias de produto cadastradas no Bling com suporte a paginação.
 *
 * O Bling retorna no máximo 100 categorias por página. Para a listagem
 * completa, continue incrementando `pagina` até receber um array vazio ou com
 * menos de `limite` itens. Categorias raiz vêm com `categoriaPai: { id: 0 }`,
 * normalizado aqui para `null`.
 *
 * @param accessToken    - Token de acesso OAuth2 válido do Bling.
 * @param pagina         - Página de resultados (opcional, default 1).
 * @param limite         - Quantidade de itens por página (opcional, default 100).
 * @param onTokenRefresh - Callback opcional que renova o token e retorna o novo access token.
 */
export async function getBlingCategoriasProdutos(
  accessToken: string,
  pagina?: number,
  limite?: number,
  onTokenRefresh?: () => Promise<string>,
): Promise<BlingCategoriaProduto[]> {
  let token = accessToken;

  const params: Record<string, string> = {};
  if (pagina !== undefined) params.pagina = String(pagina);
  if (limite !== undefined) params.limite = String(limite);

  let response = await fetchBlingApi(token, "/categorias/produtos", params);

  if ((response.status === 401 || response.status === 403) && onTokenRefresh) {
    token = await onTokenRefresh();
    response = await fetchBlingApi(token, "/categorias/produtos", params);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha ao listar categorias de produto do Bling: ${errorText || response.statusText}`,
    );
  }

  const body = (await response.json()) as {
    data: Array<{
      id: number;
      descricao: string;
      categoriaPai?: { id: number } | null;
    }>;
  };

  return (body.data ?? []).map((item) => ({
    id: item.id,
    descricao: item.descricao,
    categoriaPai:
      item.categoriaPai && item.categoriaPai.id > 0 ? item.categoriaPai : null,
  }));
}

export interface BlingCategoriaProdutoPayload {
  descricao: string;
  categoriaPai?: { id: number };
}

interface BlingApiErrorField {
  code?: number;
  msg?: string;
  element?: string;
  namespace?: string;
  collection?: Array<{
    index?: number;
    code?: number;
    msg?: string;
    element?: string;
    namespace?: string;
  }>;
}

/**
 * Erro de uma chamada à API do Bling. Carrega o `status` HTTP e uma `message`
 * já formatada/segura (sem token), permitindo ao chamador classificar a falha
 * (auth, validação, rate limit) e traduzi-la em mensagem amigável ao usuário.
 */
export class BlingApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "BlingApiError";
    this.status = status;
  }
}

/**
 * Converte o corpo de erro padrão da API do Bling
 * (`{ error: { type, message, description, fields: [...] } }`) em uma mensagem
 * legível, incluindo as mensagens de validação por campo. Retorna o corpo cru
 * (ou o fallback) quando o JSON não segue esse formato.
 */
function formatBlingApiError(rawBody: string, fallback: string): string {
  try {
    const parsed = JSON.parse(rawBody) as {
      error?: {
        type?: string;
        message?: string;
        description?: string;
        fields?: BlingApiErrorField[];
      };
    };

    const apiError = parsed.error;
    if (!apiError) return rawBody || fallback;

    const parts: string[] = [];
    if (apiError.message) parts.push(apiError.message);
    if (apiError.description && apiError.description !== apiError.message) {
      parts.push(apiError.description);
    }

    for (const field of apiError.fields ?? []) {
      if (field.msg) {
        parts.push(field.element ? `${field.element}: ${field.msg}` : field.msg);
      }
      for (const item of field.collection ?? []) {
        if (item.msg) {
          parts.push(item.element ? `${item.element}: ${item.msg}` : item.msg);
        }
      }
    }

    return parts.length > 0 ? parts.join(" | ") : rawBody || fallback;
  } catch {
    return rawBody || fallback;
  }
}

/**
 * Cria uma categoria de produto no Bling.
 *
 * Para criar uma subcategoria, informe `categoriaPai.id`. Categorias raiz
 * (ex: país do vinho) são criadas sem `categoriaPai`.
 *
 * @param accessToken    - Token de acesso OAuth2 válido do Bling.
 * @param payload        - Dados da categoria (descricao e categoriaPai opcional).
 * @param onTokenRefresh - Callback opcional que renova o token e retorna o novo access token.
 */
export async function createBlingCategoriaProduto(
  accessToken: string,
  payload: BlingCategoriaProdutoPayload,
  onTokenRefresh?: () => Promise<string>,
): Promise<{ id: number }> {
  let token = accessToken;

  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };

  let response = await fetchBlingApi(
    token,
    "/categorias/produtos",
    undefined,
    requestInit,
  );

  if ((response.status === 401 || response.status === 403) && onTokenRefresh) {
    token = await onTokenRefresh();
    response = await fetchBlingApi(
      token,
      "/categorias/produtos",
      undefined,
      requestInit,
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha ao criar categoria de produto no Bling: ${formatBlingApiError(errorText, response.statusText)}`,
    );
  }

  const body = (await response.json()) as { data: { id: number } };
  return { id: body.data.id };
}

export interface BlingProdutoPayloadMidia {
  video?: { url: string };
  /** No POST as imagens vão em `imagens.imagensURL[].link` (diferente do GET, que retorna `externas`/`internas`). */
  imagens?: { imagensURL: Array<{ link: string }> };
}

export interface BlingProdutoPayload {
  nome: string;
  /** "P" = produto, "S" = serviço, "N" = nota de entrada */
  tipo: string;
  /** "S" = simples, "V" = com variações, "E" = com composição */
  formato: string;
  /** Código/SKU — chave de deduplicação na replicação entre contas (quando ausente, a deduplicação é feita pelo nome) */
  codigo?: string;
  preco?: number;
  /** "A" = ativo, "I" = inativo */
  situacao?: string;
  descricaoCurta?: string;
  descricaoComplementar?: string;
  observacoes?: string;
  unidade?: string;
  pesoLiquido?: number;
  pesoBruto?: number;
  volumes?: number;
  itensPorCaixa?: number;
  gtin?: string;
  gtinEmbalagem?: string;
  marca?: string;
  freteGratis?: boolean;
  categoria?: { id: number };
  estoque?: {
    minimo?: number;
    maximo?: number;
    crossdocking?: number;
    localizacao?: string;
  };
  dimensoes?: {
    largura?: number;
    altura?: number;
    profundidade?: number;
    unidadeMedida?: number;
  };
  tributacao?: {
    origem?: number;
    ncm?: string;
    cest?: string;
    percentualTributos?: number;
  };
  midia?: BlingProdutoPayloadMidia;
}

interface BlingCreateProdutoResponse {
  data: {
    id: number;
    warnings?: string[];
  };
}

/**
 * Cria um produto no Bling (POST /produtos).
 *
 * Em caso de sucesso (201) o Bling retorna `{ data: { id, warnings? } }` —
 * os avisos são repassados ao chamador. Erros de validação (400/403) chegam
 * no formato `{ error: { fields: [...] } }` e são convertidos em mensagem
 * legível por `formatBlingApiError`.
 *
 * @param accessToken    - Token de acesso OAuth2 válido do Bling.
 * @param payload        - Dados do produto.
 * @param onTokenRefresh - Callback opcional que renova o token e retorna o novo access token.
 */
export async function createBlingProduto(
  accessToken: string,
  payload: BlingProdutoPayload,
  onTokenRefresh?: () => Promise<string>,
): Promise<{ id: number; warnings: string[] }> {
  let token = accessToken;

  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };

  let response = await fetchBlingApi(token, "/produtos", undefined, requestInit);

  if ((response.status === 401 || response.status === 403) && onTokenRefresh) {
    token = await onTokenRefresh();
    response = await fetchBlingApi(token, "/produtos", undefined, requestInit);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha ao criar produto no Bling: ${formatBlingApiError(errorText, response.statusText)}`,
    );
  }

  const body = (await response.json()) as BlingCreateProdutoResponse;
  return { id: body.data.id, warnings: body.data.warnings ?? [] };
}

// ---------------------------------------------------------------------------
// Mapeamento de categorias de produto para enums locais
// ---------------------------------------------------------------------------

export type BlingWineType =
  | "ESPUMANTE"
  | "BRANCO"
  | "ROSE"
  | "TINTO"
  | "PÓS-REFEIÇÃO";
export type BlingWineCountry =
  | "CHILE"
  | "ARGENTINA"
  | "URUGUAI"
  | "BRASIL"
  | "EUA"
  | "FRANÇA"
  | "ITÁLIA"
  | "PORTUGAL"
  | "ESPANHA"
  | "ALEMANHA"
  | "OUTROS";

/**
 * Normaliza uma string removendo acentos e convertendo para maiúsculas,
 * facilitando comparações case-insensitive sem dependência de locale.
 * Usada pelos mappers abaixo e pelo matching de categorias na replicação
 * de produtos entre contas Bling.
 */
export function normalizeBlingCategoryStr(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

/**
 * Mapeia a `descricao` da categoria Bling para o enum `type` da tabela
 * `products` (tipo do vinho). Retorna `"TINTO"` como fallback.
 */
export function mapBlingCategoryToWineType(descricao: string): BlingWineType {
  const n = normalizeBlingCategoryStr(descricao);

  if (n.includes("ESPUMANTE")) return "ESPUMANTE";
  if (n.includes("BRANCO")) return "BRANCO";
  if (n.includes("ROSE") || n.includes("ROSÊ")) return "ROSE";
  if (n.includes("POS") && n.includes("REFEIC")) return "PÓS-REFEIÇÃO";
  if (n.includes("TINTO")) return "TINTO";

  return "TINTO";
}

/**
 * Mapeia a `descricao` da categoria pai Bling para o enum `country` da tabela
 * `products` (país do vinho). Retorna `"OUTROS"` como fallback.
 */
export function mapBlingCategoryToCountry(descricao: string): BlingWineCountry {
  const n = normalizeBlingCategoryStr(descricao);

  if (n.includes("CHILE")) return "CHILE";
  if (n.includes("ARGENTIN")) return "ARGENTINA";
  if (n.includes("URUGUAI") || n.includes("URUGUAY")) return "URUGUAI";
  if (n.includes("BRASIL") || n.includes("BRAZIL")) return "BRASIL";
  if (
    n.includes("EUA") ||
    n.includes("USA") ||
    n.includes("ESTADOS UNIDOS") ||
    n.includes("ESTADOS-UNIDOS")
  )
    return "EUA";
  if (n.includes("FRANCA") || n.includes("FRANCE") || n.includes("FRANC"))
    return "FRANÇA";
  if (n.includes("ITALIA") || n.includes("ITALY")) return "ITÁLIA";
  if (n.includes("PORTUGAL")) return "PORTUGAL";
  if (n.includes("ESPANHA") || n.includes("SPAIN") || n.includes("ESPANA"))
    return "ESPANHA";
  if (n.includes("ALEMANHA") || n.includes("GERMANY") || n.includes("DEUTSCH"))
    return "ALEMANHA";

  return "OUTROS";
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

export interface BlingContatoEndereco {
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
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
  endereco: BlingContatoEndereco | null;
}

export interface BlingContatoSummary {
  id: number;
  nome: string | null;
  codigo: string | null;
  situacao: string | null;
  numeroDocumento: string | null;
  telefone: string | null;
  celular: string | null;
}

export type BlingContatoTipo = "J" | "F" | "E";

export interface BlingContatoPayloadEndereco {
  endereco?: string;
  cep?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  numero?: string;
  complemento?: string;
}

export interface BlingContatoPayload {
  nome: string;
  codigo?: string;
  situacao?: "A" | "I";
  numeroDocumento?: string;
  telefone?: string;
  celular?: string;
  fantasia?: string;
  tipo: BlingContatoTipo;
  indicadorIe?: number;
  ie?: string;
  rg?: string;
  inscricaoMunicipal?: string;
  orgaoEmissor?: string;
  email?: string;
  emailNotaFiscal?: string;
  orgaoPublico?: "S" | "N";
  endereco?: {
    geral?: BlingContatoPayloadEndereco;
    cobranca?: BlingContatoPayloadEndereco;
  };
  vendedor?: {
    id?: number;
  };
  dadosAdicionais?: {
    dataNascimento?: string;
    sexo?: string;
    naturalidade?: string;
  };
  financeiro?: {
    limiteCredito?: number;
    condicaoPagamento?: string;
    categoria?: {
      id?: number;
    };
  };
  pais?: {
    nome?: string;
  };
  tiposContato?: Array<{
    id?: number;
    descricao?: string;
  }>;
  pessoasContato?: Array<{
    id?: number;
    descricao?: string;
  }>;
}

interface BlingCreateContatoResponse {
  data: {
    id: number;
  };
}

export interface GetBlingContatosParams {
  telefone?: string;
  numeroDocumento?: string;
}

function normalizeBlingContatoPhoneQuery(phone: string): string {
  let digits = phone.replace(/\D/g, "");

  if (
    digits.startsWith("55") &&
    (digits.length === 12 || digits.length === 13)
  ) {
    digits = digits.slice(2);
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return phone.trim();
}

function normalizeBlingContatoDocumentQuery(document: string): string {
  return document.replace(/\D/g, "");
}

function normalizeBlingContatoValue(value: unknown): unknown {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    const normalizedItems = value
      .map((item) => normalizeBlingContatoValue(item))
      .filter((item) => item !== undefined);

    return normalizedItems.length > 0 ? normalizedItems : undefined;
  }

  if (value && typeof value === "object") {
    const normalizedEntries = Object.entries(value as Record<string, unknown>)
      .map(
        ([key, entryValue]) =>
          [key, normalizeBlingContatoValue(entryValue)] as const,
      )
      .filter(([, entryValue]) => entryValue !== undefined);

    return normalizedEntries.length > 0
      ? Object.fromEntries(normalizedEntries)
      : undefined;
  }

  return value;
}

function normalizeBlingContatoPayload(
  payload: BlingContatoPayload,
): BlingContatoPayload & { situacao: "A" | "I" } {
  const normalized = normalizeBlingContatoValue(payload) as
    | Partial<BlingContatoPayload>
    | undefined;

  const nome = normalized?.nome;

  if (!nome) {
    throw new Error(
      "Falha ao criar contato no Bling: campo 'nome' é obrigatório",
    );
  }

  const tipo = normalized?.tipo;

  if (tipo !== "J" && tipo !== "F" && tipo !== "E") {
    throw new Error(
      "Falha ao criar contato no Bling: campo 'tipo' deve ser 'J', 'F' ou 'E'",
    );
  }

  const situacao = normalized?.situacao ?? "A";

  if (situacao !== "A" && situacao !== "I") {
    throw new Error(
      "Falha ao criar contato no Bling: campo 'situacao' deve ser 'A' ou 'I'",
    );
  }

  return {
    ...(normalized ?? {}),
    nome,
    tipo,
    situacao,
  };
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
      endereco?: {
        endereco?: string | null;
        numero?: string | null;
        complemento?: string | null;
        bairro?: string | null;
        municipio?: string | null;
        uf?: string | null;
        cep?: string | null;
      } | null;
    };
  };

  const end = body.data.endereco;

  return {
    id: body.data.id,
    nome: body.data.nome ?? null,
    telefone: body.data.telefone ?? null,
    celular: body.data.celular ?? null,
    tipo: body.data.tipo ?? null,
    numeroDocumento: body.data.numeroDocumento ?? null,
    email: body.data.email ?? null,
    fantasia: body.data.fantasia ?? null,
    endereco: end
      ? {
          endereco: end.endereco ?? null,
          numero: end.numero ?? null,
          complemento: end.complemento ?? null,
          bairro: end.bairro ?? null,
          municipio: end.municipio ?? null,
          uf: end.uf ?? null,
          cep: end.cep ?? null,
        }
      : null,
  };
}

export async function getBlingContatos(
  accessToken: string,
  params: GetBlingContatosParams = {},
  onTokenRefresh?: () => Promise<string>,
): Promise<BlingContatoSummary[]> {
  let token = accessToken;

  const queryParams: Record<string, string> = {};

  if (params.telefone) {
    queryParams.telefone = normalizeBlingContatoPhoneQuery(params.telefone);
  }

  if (params.numeroDocumento) {
    queryParams.numeroDocumento = normalizeBlingContatoDocumentQuery(
      params.numeroDocumento,
    );
  }

  let response = await fetchBlingApi(token, "/contatos", queryParams);

  if ((response.status === 401 || response.status === 403) && onTokenRefresh) {
    token = await onTokenRefresh();
    response = await fetchBlingApi(token, "/contatos", queryParams);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Falha ao listar contatos do Bling: ${errorText || response.statusText}`,
    );
  }

  const body = (await response.json()) as { data: BlingContatoSummary[] };
  return body.data ?? [];
}

export async function createBlingContato(
  accessToken: string,
  payload: BlingContatoPayload,
  onTokenRefresh?: () => Promise<string>,
): Promise<{ id: number }> {
  let token = accessToken;

  const normalizedPayload = normalizeBlingContatoPayload(payload);
  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(normalizedPayload),
  };

  let response = await fetchBlingApi(
    token,
    "/contatos",
    undefined,
    requestInit,
  );

  if ((response.status === 401 || response.status === 403) && onTokenRefresh) {
    token = await onTokenRefresh();
    response = await fetchBlingApi(token, "/contatos", undefined, requestInit);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new BlingApiError(
      response.status,
      `Falha ao criar contato no Bling: ${formatBlingApiError(errorText, response.statusText)}`,
    );
  }

  const body = (await response.json()) as BlingCreateContatoResponse;
  return { id: body.data.id };
}

export async function updateBlingContato(
  accessToken: string,
  contatoId: number,
  payload: BlingContatoPayload,
  onTokenRefresh?: () => Promise<string>,
): Promise<void> {
  let token = accessToken;

  const normalizedPayload = normalizeBlingContatoPayload(payload);
  const requestInit: RequestInit = {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(normalizedPayload),
  };

  let response = await fetchBlingApi(
    token,
    `/contatos/${contatoId}`,
    undefined,
    requestInit,
  );

  if ((response.status === 401 || response.status === 403) && onTokenRefresh) {
    token = await onTokenRefresh();
    response = await fetchBlingApi(
      token,
      `/contatos/${contatoId}`,
      undefined,
      requestInit,
    );
  }

  if (response.status === 404) {
    throw new BlingApiError(
      404,
      `Contato ${contatoId} não encontrado no Bling`,
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new BlingApiError(
      response.status,
      `Falha ao atualizar contato no Bling: ${formatBlingApiError(errorText, response.statusText)}`,
    );
  }
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

const DEFAULT_OAUTH_BASE_URL = "https://api.bling.com.br/Api/v3/oauth";

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
