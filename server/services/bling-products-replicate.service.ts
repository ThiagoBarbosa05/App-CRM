import { eq } from "drizzle-orm";
import { db } from "../db";
import { blingProductMappings } from "../../shared/schema";
import { decryptToken } from "../lib/token-crypto";
import { TokenBucket } from "../lib/token-bucket";
import {
  getBlingProdutos,
  getBlingProduto,
  getBlingCategoriaProduto,
  getBlingCategoriasProdutos,
  createBlingCategoriaProduto,
  createBlingProduto,
  normalizeBlingCategoryStr,
  type BlingCategoriaProduto,
  type BlingProdutoPayload,
} from "../integrations/bling";
import { blingConnectionsService } from "./bling-connections.service";

export interface ReplicateError {
  codigo: string | null;
  nome: string | null;
  error: string;
}

export interface ReplicateCounters {
  /** Produtos da origem percorridos */
  processed: number;
  /** Criados no destino (ou que SERIAM criados, em dry-run) */
  created: number;
  /** Código (ou nome, para produtos sem código) já existe no destino */
  skippedExisting: number;
  /** formato != "S" ou variação (idProdutoPai) */
  skippedNonSimple: number;
  /** situacao != "A" */
  skippedInactive: number;
  /** Categorias criadas (ou que seriam) no destino */
  categoriesCreated: number;
  /** Links locais (blingProductMappings) criados (ou que seriam) */
  linked: number;
  /** Produto criado mas sem mapping local na origem */
  linkSkipped: number;
  failed: number;
}

export type ReplicateProductAction =
  | "would-create"
  | "created"
  | "skipped-existing"
  | "skipped-non-simple"
  | "skipped-inactive"
  | "failed";

export type ReplicateProgressEvent =
  | { type: "start"; dryRun: boolean }
  | { type: "preload"; targetCategories: number; targetProducts: number }
  | { type: "progress"; page: number; counters: ReplicateCounters }
  | {
      type: "product";
      codigo: string | null;
      nome: string | null;
      action: ReplicateProductAction;
      detail?: string;
    }
  | {
      type: "done";
      dryRun: boolean;
      counters: ReplicateCounters;
      errors: ReplicateError[];
    }
  | { type: "error"; message: string };

const MAX_REPORTED_ERRORS = 50;

interface AccountContext {
  getToken: () => string;
  onTokenRefresh: () => Promise<string>;
  limiter: TokenBucket;
}

async function makeAccountContext(
  connectionId: string,
  userId: string,
  label: "origem" | "destino",
): Promise<AccountContext> {
  const connection = await blingConnectionsService.getById(connectionId, userId);

  if (!connection) {
    throw new Error(`Conexao Bling de ${label} nao encontrada`);
  }

  if (connection.status !== "connected") {
    throw new Error(
      `Conexao Bling de ${label} nao esta conectada. Reconecte a conta antes de replicar.`,
    );
  }

  if (!connection.accessTokenEncrypted) {
    throw new Error(`Token de acesso da conexao Bling de ${label} esta ausente`);
  }

  let accessToken = decryptToken(connection.accessTokenEncrypted);

  const onTokenRefresh = async (): Promise<string> => {
    await blingConnectionsService.refreshConnection(connectionId, userId);
    const refreshed = await blingConnectionsService.getById(connectionId, userId);
    if (!refreshed?.accessTokenEncrypted) {
      throw new Error(
        `Nao foi possivel obter o novo token da conta de ${label} apos refresh`,
      );
    }
    accessToken = decryptToken(refreshed.accessTokenEncrypted);
    return accessToken;
  };

  return {
    getToken: () => accessToken,
    onTokenRefresh,
    // Bling allows up to 3 req/s por conta. Capacity=1 elimina burst,
    // garantindo ~333 ms entre requisições — estritamente ≤ 3 req/s.
    limiter: new TokenBucket(1, 3),
  };
}

/**
 * Replica produtos de uma conta Bling (origem) para outra (destino).
 *
 * Pipeline por produto: paginação na origem → detalhes completos → categoria
 * (filha = tipo do vinho) e categoria pai (= país) → find-or-create da
 * categoria no destino → criação do produto no destino → link local em
 * blingProductMappings (conexão destino) quando o produto de origem já está
 * vinculado a um produto do CRM.
 *
 * Em modo dry-run (enquanto `createBlingProduto` não está implementado), o
 * pipeline roda completo mas nenhum POST é feito no destino e nada é gravado
 * no banco — os eventos relatam o que SERIA criado.
 */
export async function replicateBlingProducts(
  sourceConnectionId: string,
  targetConnectionId: string,
  userId: string,
  options: { dryRun: boolean },
  onProgress: (event: ReplicateProgressEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (sourceConnectionId === targetConnectionId) {
    throw new Error("Conta de origem e destino devem ser diferentes");
  }

  const { dryRun } = options;

  const source = await makeAccountContext(sourceConnectionId, userId, "origem");
  const target = await makeAccountContext(targetConnectionId, userId, "destino");

  onProgress({ type: "start", dryRun });

  const LIMIT = 100;

  // Mappings da origem: blingProductId → productId local (para o link no destino)
  const sourceMappingRows = await db
    .select({
      blingProductId: blingProductMappings.blingProductId,
      productId: blingProductMappings.productId,
    })
    .from(blingProductMappings)
    .where(eq(blingProductMappings.connectionId, sourceConnectionId));

  const sourceMappings = new Map<string, string>();
  for (const row of sourceMappingRows) {
    sourceMappings.set(row.blingProductId, row.productId);
  }

  // -------------------------------------------------------------------------
  // Preload: categorias do destino indexadas por descrição normalizada
  // -------------------------------------------------------------------------
  const targetCatById = new Map<number, BlingCategoriaProduto>();
  const targetRootIdByDesc = new Map<string, number>();
  const targetChildIdByKey = new Map<string, number>();

  const childKey = (parentDesc: string, childDesc: string): string =>
    `${normalizeBlingCategoryStr(parentDesc)}::${normalizeBlingCategoryStr(childDesc)}`;

  {
    let page = 1;
    while (true) {
      if (signal?.aborted) return;

      await target.limiter.consume();
      const categorias = await getBlingCategoriasProdutos(
        target.getToken(),
        page,
        LIMIT,
        target.onTokenRefresh,
      );

      if (categorias.length === 0) break;

      for (const categoria of categorias) {
        targetCatById.set(categoria.id, categoria);
      }

      if (categorias.length < LIMIT) break;
      page++;
    }

    // Indexa após carregar tudo para conseguir resolver a descrição do pai
    // mesmo quando o pai aparece em uma página posterior à da filha.
    // Em caso de descrições duplicadas (mesma chave normalizada), a última
    // categoria indexada vence — qualquer uma delas é um match correto.
    for (const categoria of Array.from(targetCatById.values())) {
      if (!categoria.categoriaPai) {
        targetRootIdByDesc.set(
          normalizeBlingCategoryStr(categoria.descricao),
          categoria.id,
        );
      } else {
        const parent = targetCatById.get(categoria.categoriaPai.id);
        const parentDesc = parent?.descricao ?? "";
        targetChildIdByKey.set(
          childKey(parentDesc, categoria.descricao),
          categoria.id,
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // Preload: códigos e nomes dos produtos do destino (chaves de deduplicação).
  // Produtos sem código são deduplicados pelo nome normalizado.
  // -------------------------------------------------------------------------
  const targetCodigos = new Set<string>();
  const targetNames = new Set<string>();
  let targetProductCount = 0;

  {
    let page = 1;
    while (true) {
      if (signal?.aborted) return;

      await target.limiter.consume();
      const produtos = await getBlingProdutos(
        target.getToken(),
        page,
        LIMIT,
        target.onTokenRefresh,
      );

      if (produtos.length === 0) break;

      targetProductCount += produtos.length;
      for (const produto of produtos) {
        const codigo = produto.codigo?.trim();
        if (codigo) targetCodigos.add(codigo);
        const nomeNormalizado = normalizeBlingCategoryStr(produto.nome ?? "");
        if (nomeNormalizado) targetNames.add(nomeNormalizado);
      }

      if (produtos.length < LIMIT) break;
      page++;
    }
  }

  onProgress({
    type: "preload",
    targetCategories: targetCatById.size,
    targetProducts: targetProductCount,
  });

  // -------------------------------------------------------------------------
  // Loop principal: paginação dos produtos da origem
  // -------------------------------------------------------------------------
  const counters: ReplicateCounters = {
    processed: 0,
    created: 0,
    skippedExisting: 0,
    skippedNonSimple: 0,
    skippedInactive: 0,
    categoriesCreated: 0,
    linked: 0,
    linkSkipped: 0,
    failed: 0,
  };
  const errors: ReplicateError[] = [];

  // Caches de categoria: a maioria dos vinhos compartilha poucas categorias
  const sourceCatCache = new Map<number, BlingCategoriaProduto>();
  const resolvedTargetCatId = new Map<number, number>();
  // Em dry-run, categorias "criadas" recebem ids fake negativos para que
  // produtos seguintes as reutilizem e categoriesCreated conte uma única vez.
  let dryRunNextFakeId = -1;

  const getSourceCategoria = async (
    categoriaId: number,
  ): Promise<BlingCategoriaProduto> => {
    const cached = sourceCatCache.get(categoriaId);
    if (cached) return cached;

    await source.limiter.consume();
    const categoria = await getBlingCategoriaProduto(
      source.getToken(),
      categoriaId,
      source.onTokenRefresh,
    );
    sourceCatCache.set(categoriaId, categoria);
    return categoria;
  };

  const findOrCreateTargetRoot = async (descricao: string): Promise<number> => {
    const key = normalizeBlingCategoryStr(descricao);
    const existing = targetRootIdByDesc.get(key);
    if (existing !== undefined) return existing;

    let id: number;
    if (dryRun) {
      id = dryRunNextFakeId--;
    } else {
      await target.limiter.consume();
      ({ id } = await createBlingCategoriaProduto(
        target.getToken(),
        { descricao },
        target.onTokenRefresh,
      ));
    }

    targetRootIdByDesc.set(key, id);
    counters.categoriesCreated++;
    return id;
  };

  const findOrCreateTargetChild = async (
    parentDesc: string,
    parentTargetId: number,
    descricao: string,
  ): Promise<number> => {
    const key = childKey(parentDesc, descricao);
    const existing = targetChildIdByKey.get(key);
    if (existing !== undefined) return existing;

    let id: number;
    if (dryRun) {
      id = dryRunNextFakeId--;
    } else {
      await target.limiter.consume();
      ({ id } = await createBlingCategoriaProduto(
        target.getToken(),
        { descricao, categoriaPai: { id: parentTargetId } },
        target.onTokenRefresh,
      ));
    }

    targetChildIdByKey.set(key, id);
    counters.categoriesCreated++;
    return id;
  };

  /**
   * Resolve a categoria do produto de origem para o id equivalente no destino,
   * criando pai (país) e filha (tipo do vinho) quando necessário.
   */
  const resolveTargetCategoryId = async (
    sourceCategoriaId: number,
  ): Promise<number> => {
    const resolved = resolvedTargetCatId.get(sourceCategoriaId);
    if (resolved !== undefined) return resolved;

    const child = await getSourceCategoria(sourceCategoriaId);
    const parentId =
      child.categoriaPai && child.categoriaPai.id > 0
        ? child.categoriaPai.id
        : null;

    let targetId: number;

    if (parentId) {
      const parent = await getSourceCategoria(parentId);
      const targetParentId = await findOrCreateTargetRoot(parent.descricao);
      targetId = await findOrCreateTargetChild(
        parent.descricao,
        targetParentId,
        child.descricao,
      );
    } else {
      // Categoria de origem sem pai: tratada como raiz também no destino
      targetId = await findOrCreateTargetRoot(child.descricao);
    }

    resolvedTargetCatId.set(sourceCategoriaId, targetId);
    return targetId;
  };

  let page = 1;

  while (true) {
    if (signal?.aborted) break;

    await source.limiter.consume();
    const blingProductList = await getBlingProdutos(
      source.getToken(),
      page,
      LIMIT,
      source.onTokenRefresh,
    );

    if (blingProductList.length === 0) break;

    for (const summary of blingProductList) {
      if (signal?.aborted) break;

      const codigo = summary.codigo?.trim() || null;
      const nome = summary.nome ?? null;

      // Filtros baratos via summary — sem gastar requisições extras
      if (summary.formato !== "S" || summary.idProdutoPai) {
        counters.skippedNonSimple++;
        counters.processed++;
        onProgress({
          type: "product",
          codigo,
          nome,
          action: "skipped-non-simple",
          detail: "Produto com variações/composição — apenas produtos simples são replicados",
        });
        continue;
      }

      if (summary.situacao !== "A") {
        counters.skippedInactive++;
        counters.processed++;
        onProgress({ type: "product", codigo, nome, action: "skipped-inactive" });
        continue;
      }

      // Deduplicação: por código quando existe; por nome normalizado quando não
      const nomeNormalizado = normalizeBlingCategoryStr(nome ?? "");

      if (codigo && targetCodigos.has(codigo)) {
        counters.skippedExisting++;
        counters.processed++;
        onProgress({
          type: "product",
          codigo,
          nome,
          action: "skipped-existing",
          detail: "Código já cadastrado no destino",
        });
        continue;
      }

      if (!codigo && nomeNormalizado && targetNames.has(nomeNormalizado)) {
        counters.skippedExisting++;
        counters.processed++;
        onProgress({
          type: "product",
          codigo,
          nome,
          action: "skipped-existing",
          detail: "Produto sem código — nome já cadastrado no destino",
        });
        continue;
      }

      try {
        await source.limiter.consume();
        const detalhe = await getBlingProduto(
          source.getToken(),
          summary.id,
          source.onTokenRefresh,
        );

        let targetCategoryId: number | null = null;

        if (detalhe.categoria?.id) {
          try {
            targetCategoryId = await resolveTargetCategoryId(detalhe.categoria.id);
          } catch (err) {
            console.warn(
              `[BlingReplicate] Não foi possível resolver categoria ${detalhe.categoria.id} do produto ${codigo} — criando sem categoria:`,
              err,
            );
          }
        }

        // Imagens: externas + internas + imagemURL, deduplicadas por link
        const imageLinks = new Set<string>();
        for (const img of detalhe.midia?.imagens?.externas ?? []) {
          if (img.link) imageLinks.add(img.link);
        }
        for (const img of detalhe.midia?.imagens?.internas ?? []) {
          if (img.link) imageLinks.add(img.link);
        }
        if (detalhe.imagemURL) imageLinks.add(detalhe.imagemURL);

        const payload: BlingProdutoPayload = {
          nome: detalhe.nome ?? summary.nome,
          tipo: detalhe.tipo ?? "P",
          formato: "S",
          ...(codigo ? { codigo } : {}),
          ...(detalhe.preco !== null && detalhe.preco !== undefined
            ? { preco: detalhe.preco }
            : {}),
          ...(detalhe.situacao ? { situacao: detalhe.situacao } : {}),
          ...(detalhe.descricaoCurta
            ? { descricaoCurta: detalhe.descricaoCurta }
            : {}),
          ...(detalhe.unidade ? { unidade: detalhe.unidade } : {}),
          ...(detalhe.pesoLiquido !== null && detalhe.pesoLiquido !== undefined
            ? { pesoLiquido: detalhe.pesoLiquido }
            : {}),
          ...(detalhe.pesoBruto !== null && detalhe.pesoBruto !== undefined
            ? { pesoBruto: detalhe.pesoBruto }
            : {}),
          ...(detalhe.marca ? { marca: detalhe.marca } : {}),
          // Ids fake (negativos) de dry-run nunca vão num payload real, mas em
          // dry-run o payload não é enviado — mantê-los aqui deixa o relatório coerente
          ...(targetCategoryId !== null
            ? { categoria: { id: targetCategoryId } }
            : {}),
          ...(detalhe.dimensoes
            ? {
                dimensoes: {
                  ...(detalhe.dimensoes.largura !== null
                    ? { largura: detalhe.dimensoes.largura }
                    : {}),
                  ...(detalhe.dimensoes.altura !== null
                    ? { altura: detalhe.dimensoes.altura }
                    : {}),
                  ...(detalhe.dimensoes.profundidade !== null
                    ? { profundidade: detalhe.dimensoes.profundidade }
                    : {}),
                  ...(detalhe.dimensoes.unidadeMedida !== null
                    ? { unidadeMedida: detalhe.dimensoes.unidadeMedida }
                    : {}),
                },
              }
            : {}),
          ...(detalhe.tributacao
            ? {
                tributacao: {
                  ...(detalhe.tributacao.origem !== null
                    ? { origem: detalhe.tributacao.origem }
                    : {}),
                  ...(detalhe.tributacao.ncm
                    ? { ncm: detalhe.tributacao.ncm }
                    : {}),
                  ...(detalhe.tributacao.cest
                    ? { cest: detalhe.tributacao.cest }
                    : {}),
                },
              }
            : {}),
          ...(imageLinks.size > 0
            ? {
                midia: {
                  imagens: {
                    imagensURL: Array.from(imageLinks).map((link) => ({ link })),
                  },
                },
              }
            : {}),
        };

        const localProductId = sourceMappings.get(String(summary.id));

        if (dryRun) {
          counters.created++;
          if (localProductId) {
            counters.linked++;
          } else {
            counters.linkSkipped++;
          }
          onProgress({
            type: "product",
            codigo,
            nome: payload.nome,
            action: "would-create",
            detail: localProductId
              ? "Link local seria criado (produto vinculado na origem)"
              : "Sem mapping local na origem — link local não seria criado",
          });
        } else {
          await target.limiter.consume();
          const { id: newBlingProductId, warnings } = await createBlingProduto(
            target.getToken(),
            payload,
            target.onTokenRefresh,
          );

          counters.created++;

          if (localProductId) {
            await db
              .insert(blingProductMappings)
              .values({
                connectionId: targetConnectionId,
                blingProductId: String(newBlingProductId),
                productId: localProductId,
              })
              .onConflictDoNothing();
            counters.linked++;
          } else {
            counters.linkSkipped++;
          }

          const linkDetail = localProductId
            ? "Link local criado"
            : "Sem mapping local na origem — link local não criado";

          onProgress({
            type: "product",
            codigo,
            nome: payload.nome,
            action: "created",
            detail:
              warnings.length > 0
                ? `${linkDetail}. Avisos do Bling: ${warnings.join("; ")}`
                : linkDetail,
          });
        }

        // Evita duplicar produtos repetidos dentro da própria origem nesta execução
        if (codigo) targetCodigos.add(codigo);
        if (nomeNormalizado) targetNames.add(nomeNormalizado);
      } catch (err) {
        counters.failed++;
        const message = err instanceof Error ? err.message : String(err);
        if (errors.length < MAX_REPORTED_ERRORS) {
          errors.push({ codigo, nome, error: message });
        }
        onProgress({
          type: "product",
          codigo,
          nome,
          action: "failed",
          detail: message,
        });
      }

      counters.processed++;
    }

    onProgress({ type: "progress", page, counters: { ...counters } });

    if (blingProductList.length < LIMIT) break;
    page++;
  }

  onProgress({ type: "done", dryRun, counters: { ...counters }, errors });
}
