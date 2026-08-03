import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface BlingContactOption {
  /** Id do contato NA CONTA BLING, como texto. */
  id: string;
  nome: string;
  numeroDocumento: string | null;
}

/**
 * Busca contatos direto na conta Bling da conexão.
 *
 * Vai à API do Bling (`/contatos?pesquisa=`) e não à base local porque o
 * Consumidor Final costuma ser um contato genérico que só existe lá e nunca
 * foi importado para o CRM — procurar no espelho local não o encontraria.
 */
export function useBlingContacts(connectionId: string | null, search: string) {
  // Sem debounce, cada tecla vira uma chamada à API externa (que ainda tem
  // limite de 3 req/s).
  const debounced = useDebouncedValue(search, 400);
  const term = debounced.trim();

  return useQuery<BlingContactOption[], Error>({
    queryKey: ["/api/restaurant-pdv/units/bling-contacts", connectionId, term],
    queryFn: async () => {
      const params = new URLSearchParams({
        connectionId: connectionId ?? "",
        pesquisa: term,
      });
      const res = await apiRequest(
        "GET",
        `/api/restaurant-pdv/units/bling-contacts?${params.toString()}`,
      );
      return res.json() as Promise<BlingContactOption[]>;
    },
    // Busca vazia devolveria a lista inteira da conta — só consulta com termo.
    enabled: !!connectionId && term.length >= 2,
    staleTime: 60_000,
  });
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
