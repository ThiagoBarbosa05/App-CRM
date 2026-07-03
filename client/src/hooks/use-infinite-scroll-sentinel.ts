import { useEffect, useRef, type RefObject } from "react";

/**
 * Observa um elemento sentinela dentro de `containerRef` e chama `onIntersect`
 * quando ele entra na área visível — usado para infinite scroll (mensagens
 * antigas no topo do chat, conversas antigas no fim do sidebar).
 */
export function useInfiniteScrollSentinel(
  containerRef: RefObject<HTMLElement>,
  onIntersect: () => void,
  enabled: boolean,
) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    const sentinel = sentinelRef.current;
    const root = containerRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onIntersect();
      },
      { root, rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [containerRef, onIntersect, enabled]);

  return sentinelRef;
}
