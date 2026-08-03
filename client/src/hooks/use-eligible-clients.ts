import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface EligibleClient {
  id: string;
  name: string;
  blingContactId: string;
}

/**
 * Clientes já mapeados como contato Bling para a conexão — candidatos a
 * "Consumidor Final" da unidade.
 *
 * A busca é server-side com limite: a base tem milhares de contatos mapeados,
 * então nunca se carrega a lista inteira.
 */
export function useEligibleClients(connectionId: string | null, search: string) {
  return useQuery<EligibleClient[], Error>({
    queryKey: ["/api/restaurant-pdv/units/eligible-clients", connectionId, search],
    queryFn: async () => {
      const params = new URLSearchParams({ connectionId: connectionId ?? "" });
      if (search.trim()) params.set("q", search.trim());
      const res = await apiRequest(
        "GET",
        `/api/restaurant-pdv/units/eligible-clients?${params.toString()}`,
      );
      return res.json() as Promise<EligibleClient[]>;
    },
    enabled: !!connectionId,
  });
}
