import type { QueryClient, QueryKey } from "@tanstack/react-query";

interface CursorPage {
  nextCursor: string | null;
}

interface InfinitePageData<TPage> {
  pages: TPage[];
  pageParams: unknown[];
}

/**
 * Funde uma página recém-buscada (sem cursor = itens mais recentes) na página
 * 0 do cache, sem tocar nas páginas mais antigas já carregadas via scroll.
 * Pura — não depende do QueryClient — por isso é testável isoladamente.
 */
export function mergeFirstPage<TPage extends CursorPage>(
  old: InfinitePageData<TPage> | undefined,
  freshFirstPage: TPage,
): InfinitePageData<TPage> {
  if (!old || old.pages.length === 0) {
    return { pages: [freshFirstPage], pageParams: [null] };
  }
  return { ...old, pages: [freshFirstPage, ...old.pages.slice(1)] };
}

/**
 * Remove itens com `id` repetido, mantendo a PRIMEIRA ocorrência. Necessário ao
 * concatenar páginas de uma infinite query: `refreshFirstPage` rebusca só a
 * página 0 (itens mais recentes); se uma rajada maior que uma página chegar
 * entre a carga inicial e a busca de páginas antigas, a página 0 e a 1 passam a
 * se sobrepor e o mesmo id apareceria duas vezes — bolhas repetidas e warning de
 * key React duplicada. Pura, para ser testável isoladamente.
 */
export function dedupById<T>(items: T[], keyFn: (item: T) => string = defaultId): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function defaultId(item: unknown): string {
  return (item as { id: string }).id;
}

/**
 * Busca a página mais recente e funde no cache da infinite query indicada.
 * Usado pelo polling periódico e pelos eventos SSE — nunca refaz o fetch das
 * páginas antigas já carregadas pelo usuário via scroll.
 */
export async function refreshFirstPage<TPage extends CursorPage>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  fetchFirstPage: () => Promise<TPage>,
): Promise<void> {
  const freshFirstPage = await fetchFirstPage();
  queryClient.setQueryData<InfinitePageData<TPage>>(queryKey, (old) =>
    mergeFirstPage(old, freshFirstPage),
  );
}
