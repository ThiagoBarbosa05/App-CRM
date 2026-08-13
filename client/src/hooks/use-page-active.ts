import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { isPageActive, subscribePageActive } from "@/lib/page-active";

/**
 * `true` enquanto a aba está visível (ou oculta há menos que a carência).
 *
 * Use como dependência de efeitos que abrem conexões ou timers próprios — SSE
 * e `setInterval` de fetch — para que eles sejam desmontados quando a aba
 * ficar em segundo plano. O `refetchInterval` do TanStack Query não precisa:
 * ele já pausa sozinho ao perder o foco.
 */
export function useIsPageActive(): boolean {
  return useSyncExternalStore(
    subscribePageActive,
    isPageActive,
    // No servidor não há aba para ficar oculta.
    () => true,
  );
}

/**
 * Revalida o cache quando a página volta a ficar ativa. Montar uma vez, no
 * layout.
 *
 * Enquanto a aba esteve oculta os streams SSE ficaram fechados e o servidor não
 * guarda backlog, então o cache local está desatualizado. O QueryClient roda
 * com `staleTime: Infinity` e `refetchOnWindowFocus: false` (ver
 * client/src/lib/queryClient.ts), ou seja, nada revalidaria sozinho.
 */
export function useRevalidateOnPageActive(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    return subscribePageActive((active) => {
      if (active) void queryClient.invalidateQueries();
    });
  }, [queryClient]);
}
