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
