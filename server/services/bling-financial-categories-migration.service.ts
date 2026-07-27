import { createHash } from "node:crypto";
import { decryptToken } from "../lib/token-crypto";
import { TokenBucket } from "../lib/token-bucket";
import {
  createBlingFinancialCategory,
  getBlingFinancialCategories,
  normalizeBlingCategoryStr,
  type BlingFinancialCategory,
} from "../integrations/bling";
import { blingConnectionsService } from "./bling-connections.service";

const PAGE_SIZE = 100;
const MAX_REPORTED_ERRORS = 50;
const PATH_SEPARATOR = "\u001f";

export type FinancialCategoryPreviewAction =
  | "create"
  | "reuse"
  | "conflict";

export interface FinancialCategoryPreviewNode {
  sourceId: number;
  parentSourceId: number;
  descricao: string;
  depth: number;
  path: string[];
  action: FinancialCategoryPreviewAction;
  targetCategoryId: number | null;
  issue: string | null;
  children: FinancialCategoryPreviewNode[];
}

export interface FinancialCategoryPreview {
  source: { id: string; name: string };
  target: { id: string; name: string };
  generatedAt: string;
  fingerprint: string;
  canMigrate: boolean;
  totals: {
    total: number;
    create: number;
    reuse: number;
    conflicts: number;
    maxDepth: number;
  };
  validations: string[];
  categories: FinancialCategoryPreviewNode[];
  tree: FinancialCategoryPreviewNode[];
}

export interface FinancialCategoryMigrationCounters {
  total: number;
  processed: number;
  created: number;
  reused: number;
  failed: number;
  blocked: number;
}

export type FinancialCategoryMigrationEvent =
  | {
      type: "start";
      counters: FinancialCategoryMigrationCounters;
    }
  | {
      type: "category";
      sourceId: number;
      path: string[];
      action: "created" | "reused" | "failed" | "blocked";
      detail?: string;
      counters: FinancialCategoryMigrationCounters;
    }
  | {
      type: "progress";
      counters: FinancialCategoryMigrationCounters;
    }
  | {
      type: "done";
      cancelled: boolean;
      counters: FinancialCategoryMigrationCounters;
      errors: Array<{ sourceId: number; path: string; error: string }>;
    }
  | { type: "error"; message: string };

interface AccountContext {
  id: string;
  name: string;
  getToken: () => string;
  onTokenRefresh: () => Promise<string>;
  limiter: TokenBucket;
}

interface HierarchyMeta {
  depth: number;
  path: string[];
  key: string;
}

const activeMigrations = new Set<string>();

function pathKey(path: string[]): string {
  return path.map(normalizeBlingCategoryStr).join(PATH_SEPARATOR);
}

function sortCategories(
  categories: BlingFinancialCategory[],
): BlingFinancialCategory[] {
  return [...categories].sort((left, right) => left.id - right.id);
}

function buildFingerprint(
  sourceConnectionId: string,
  targetConnectionId: string,
  sourceCategories: BlingFinancialCategory[],
  targetCategories: BlingFinancialCategory[],
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        sourceConnectionId,
        targetConnectionId,
        sourceCategories: sortCategories(sourceCategories),
        targetCategories: sortCategories(targetCategories),
      }),
    )
    .digest("hex");
}

function resolveHierarchy(
  categories: BlingFinancialCategory[],
): {
  metaById: Map<number, HierarchyMeta>;
  issuesById: Map<number, string>;
} {
  const byId = new Map<number, BlingFinancialCategory>();
  const issuesById = new Map<number, string>();

  for (const category of categories) {
    if (byId.has(category.id)) {
      issuesById.set(category.id, `ID de categoria duplicado: ${category.id}`);
    }
    byId.set(category.id, category);
  }

  const metaById = new Map<number, HierarchyMeta>();

  const resolve = (id: number, ancestry: number[]): HierarchyMeta => {
    const cached = metaById.get(id);
    if (cached) return cached;

    if (ancestry.includes(id)) {
      const cycle = [...ancestry.slice(ancestry.indexOf(id)), id].join(" → ");
      throw new Error(`Ciclo detectado na hierarquia: ${cycle}`);
    }

    const category = byId.get(id);
    if (!category) {
      throw new Error(`Categoria ${id} não encontrada`);
    }

    let path: string[];
    let depth: number;

    if (category.idCategoriaPai === 0) {
      path = [category.descricao];
      depth = 0;
    } else {
      const parent = byId.get(category.idCategoriaPai);
      if (!parent) {
        throw new Error(
          `Pai ${category.idCategoriaPai} não encontrado para "${category.descricao}"`,
        );
      }
      const parentMeta = resolve(parent.id, [...ancestry, id]);
      path = [...parentMeta.path, category.descricao];
      depth = parentMeta.depth + 1;
    }

    const meta = { path, depth, key: pathKey(path) };
    metaById.set(id, meta);
    return meta;
  };

  for (const category of categories) {
    if (issuesById.has(category.id)) continue;
    try {
      resolve(category.id, []);
    } catch (error) {
      issuesById.set(
        category.id,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return { metaById, issuesById };
}

function cloneNode(node: FinancialCategoryPreviewNode): FinancialCategoryPreviewNode {
  return { ...node, path: [...node.path], children: [] };
}

export function buildFinancialCategoryPreview(params: {
  sourceConnectionId: string;
  sourceName: string;
  targetConnectionId: string;
  targetName: string;
  sourceCategories: BlingFinancialCategory[];
  targetCategories: BlingFinancialCategory[];
  generatedAt?: string;
}): FinancialCategoryPreview {
  const sourceHierarchy = resolveHierarchy(params.sourceCategories);
  const targetHierarchy = resolveHierarchy(params.targetCategories);
  const validations = new Set<string>();

  for (const issue of Array.from(sourceHierarchy.issuesById.values())) {
    validations.add(issue);
  }
  for (const issue of Array.from(targetHierarchy.issuesById.values())) {
    validations.add(`Destino: ${issue}`);
  }

  const targetIdsByPath = new Map<string, number[]>();
  for (const category of params.targetCategories) {
    const meta = targetHierarchy.metaById.get(category.id);
    if (!meta) continue;
    const ids = targetIdsByPath.get(meta.key) ?? [];
    ids.push(category.id);
    targetIdsByPath.set(meta.key, ids);
  }

  const categories = params.sourceCategories
    .map<FinancialCategoryPreviewNode>((category) => {
      const meta = sourceHierarchy.metaById.get(category.id);
      const structuralIssue = sourceHierarchy.issuesById.get(category.id);

      if (!meta || structuralIssue) {
        return {
          sourceId: category.id,
          parentSourceId: category.idCategoriaPai,
          descricao: category.descricao,
          depth: 0,
          path: [category.descricao],
          action: "conflict",
          targetCategoryId: null,
          issue: structuralIssue ?? "Hierarquia inválida",
          children: [],
        };
      }

      const targetIds = targetIdsByPath.get(meta.key) ?? [];
      if (targetIds.length > 1) {
        const issue = `Mais de uma categoria no destino corresponde ao caminho "${meta.path.join(" / ")}"`;
        validations.add(issue);
        return {
          sourceId: category.id,
          parentSourceId: category.idCategoriaPai,
          descricao: category.descricao,
          depth: meta.depth,
          path: meta.path,
          action: "conflict",
          targetCategoryId: null,
          issue,
          children: [],
        };
      }

      return {
        sourceId: category.id,
        parentSourceId: category.idCategoriaPai,
        descricao: category.descricao,
        depth: meta.depth,
        path: meta.path,
        action: targetIds.length === 1 ? "reuse" : "create",
        targetCategoryId: targetIds[0] ?? null,
        issue: null,
        children: [],
      };
    })
    .sort(
      (left, right) =>
        left.depth - right.depth ||
        left.path.join(" / ").localeCompare(right.path.join(" / "), "pt-BR") ||
        left.sourceId - right.sourceId,
    );

  const nodeById = new Map(
    categories.map((category) => [category.sourceId, cloneNode(category)]),
  );
  const tree: FinancialCategoryPreviewNode[] = [];

  for (const category of categories) {
    const node = nodeById.get(category.sourceId);
    if (!node) continue;
    const parent =
      category.parentSourceId === 0
        ? undefined
        : nodeById.get(category.parentSourceId);
    if (parent) parent.children.push(node);
    else tree.push(node);
  }

  const totals = {
    total: categories.length,
    create: categories.filter((category) => category.action === "create").length,
    reuse: categories.filter((category) => category.action === "reuse").length,
    conflicts: categories.filter(
      (category) => category.action === "conflict",
    ).length,
    maxDepth: categories.reduce(
      (maximum, category) => Math.max(maximum, category.depth),
      0,
    ),
  };

  if (totals.total === 0) {
    validations.add("Nenhuma categoria de despesa foi encontrada na origem");
  }

  return {
    source: {
      id: params.sourceConnectionId,
      name: params.sourceName,
    },
    target: {
      id: params.targetConnectionId,
      name: params.targetName,
    },
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    fingerprint: buildFingerprint(
      params.sourceConnectionId,
      params.targetConnectionId,
      params.sourceCategories,
      params.targetCategories,
    ),
    canMigrate:
      totals.total > 0 && validations.size === 0 && totals.conflicts === 0,
    totals,
    validations: Array.from(validations),
    categories,
    tree,
  };
}

async function makeAccountContext(
  connectionId: string,
  label: "origem" | "destino",
): Promise<AccountContext> {
  const connection = await blingConnectionsService.getById(connectionId);
  if (!connection) {
    throw new Error(`Conta Bling de ${label} não encontrada`);
  }
  if (connection.status !== "connected" || !connection.accessTokenEncrypted) {
    throw new Error(
      `Conta Bling de ${label} não está conectada. Reconecte-a antes de continuar.`,
    );
  }

  let accessToken = decryptToken(connection.accessTokenEncrypted);
  const onTokenRefresh = async (): Promise<string> => {
    await blingConnectionsService.refreshConnection(connectionId);
    const refreshed = await blingConnectionsService.getById(connectionId);
    if (!refreshed?.accessTokenEncrypted) {
      throw new Error(`Não foi possível renovar o token da conta de ${label}`);
    }
    accessToken = decryptToken(refreshed.accessTokenEncrypted);
    return accessToken;
  };

  return {
    id: connection.id,
    name: connection.blingAccountName ?? connection.name,
    getToken: () => accessToken,
    onTokenRefresh,
    limiter: new TokenBucket(1, 3),
  };
}

async function loadAllCategories(
  account: AccountContext,
  signal?: AbortSignal,
): Promise<BlingFinancialCategory[]> {
  const categories: BlingFinancialCategory[] = [];
  let page = 1;

  while (!signal?.aborted) {
    await account.limiter.consume();
    const pageItems = await getBlingFinancialCategories(
      account.getToken(),
      page,
      PAGE_SIZE,
      account.onTokenRefresh,
    );
    categories.push(...pageItems);
    if (pageItems.length < PAGE_SIZE) break;
    page++;
  }

  return categories;
}

export async function generateFinancialCategoryPreview(
  sourceConnectionId: string,
  targetConnectionId: string,
  signal?: AbortSignal,
): Promise<FinancialCategoryPreview> {
  if (sourceConnectionId === targetConnectionId) {
    throw new Error("Conta de origem e destino devem ser diferentes");
  }

  const [source, target] = await Promise.all([
    makeAccountContext(sourceConnectionId, "origem"),
    makeAccountContext(targetConnectionId, "destino"),
  ]);
  const [sourceCategories, targetCategories] = await Promise.all([
    loadAllCategories(source, signal),
    loadAllCategories(target, signal),
  ]);

  if (signal?.aborted) {
    throw new Error("Geração do snapshot cancelada");
  }

  return buildFinancialCategoryPreview({
    sourceConnectionId: source.id,
    sourceName: source.name,
    targetConnectionId: target.id,
    targetName: target.name,
    sourceCategories,
    targetCategories,
  });
}

export async function migrateFinancialCategories(
  sourceConnectionId: string,
  targetConnectionId: string,
  confirmedFingerprint: string,
  onProgress: (event: FinancialCategoryMigrationEvent) => void,
  signal?: AbortSignal,
  validatedPreview?: FinancialCategoryPreview,
): Promise<void> {
  const migrationKey = `${sourceConnectionId}:${targetConnectionId}`;
  if (activeMigrations.has(migrationKey)) {
    throw new Error("Já existe uma migração em andamento entre estas contas");
  }
  activeMigrations.add(migrationKey);

  try {
    const preview =
      validatedPreview ??
      (await generateFinancialCategoryPreview(
        sourceConnectionId,
        targetConnectionId,
        signal,
      ));
    if (
      preview.source.id !== sourceConnectionId ||
      preview.target.id !== targetConnectionId
    ) {
      throw new Error("O snapshot informado não pertence às contas selecionadas");
    }
    if (preview.fingerprint !== confirmedFingerprint) {
      throw new Error(
        "As categorias mudaram desde o snapshot. Gere um novo snapshot antes de migrar.",
      );
    }
    if (!preview.canMigrate) {
      throw new Error(
        "O snapshot possui conflitos estruturais e não pode ser migrado.",
      );
    }

    const target = await makeAccountContext(targetConnectionId, "destino");
    const counters: FinancialCategoryMigrationCounters = {
      total: preview.categories.length,
      processed: 0,
      created: 0,
      reused: 0,
      failed: 0,
      blocked: 0,
    };
    const errors: Array<{ sourceId: number; path: string; error: string }> = [];
    const targetIdBySourceId = new Map<number, number>();

    onProgress({ type: "start", counters: { ...counters } });

    for (const category of preview.categories) {
      if (signal?.aborted) break;

      if (category.action === "reuse" && category.targetCategoryId !== null) {
        targetIdBySourceId.set(category.sourceId, category.targetCategoryId);
        counters.reused++;
        counters.processed++;
        onProgress({
          type: "category",
          sourceId: category.sourceId,
          path: category.path,
          action: "reused",
          counters: { ...counters },
        });
        continue;
      }

      const parentTargetId =
        category.parentSourceId === 0
          ? 0
          : targetIdBySourceId.get(category.parentSourceId);

      if (parentTargetId === undefined) {
        const detail = "Categoria pai não foi criada ou reutilizada";
        counters.blocked++;
        counters.processed++;
        if (errors.length < MAX_REPORTED_ERRORS) {
          errors.push({
            sourceId: category.sourceId,
            path: category.path.join(" / "),
            error: detail,
          });
        }
        onProgress({
          type: "category",
          sourceId: category.sourceId,
          path: category.path,
          action: "blocked",
          detail,
          counters: { ...counters },
        });
        continue;
      }

      try {
        await target.limiter.consume();
        const created = await createBlingFinancialCategory(
          target.getToken(),
          {
            grupoDRE: 1,
            idCategoriaPai: parentTargetId,
            descricao: category.descricao,
            tipo: 1,
          },
          target.onTokenRefresh,
        );
        targetIdBySourceId.set(category.sourceId, created.id);
        counters.created++;
        onProgress({
          type: "category",
          sourceId: category.sourceId,
          path: category.path,
          action: "created",
          counters: { ...counters, processed: counters.processed + 1 },
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        counters.failed++;
        if (errors.length < MAX_REPORTED_ERRORS) {
          errors.push({
            sourceId: category.sourceId,
            path: category.path.join(" / "),
            error: detail,
          });
        }
        onProgress({
          type: "category",
          sourceId: category.sourceId,
          path: category.path,
          action: "failed",
          detail,
          counters: { ...counters, processed: counters.processed + 1 },
        });
      }

      counters.processed++;
      onProgress({ type: "progress", counters: { ...counters } });
    }

    onProgress({
      type: "done",
      cancelled: signal?.aborted ?? false,
      counters: { ...counters },
      errors,
    });
  } finally {
    activeMigrations.delete(migrationKey);
  }
}
