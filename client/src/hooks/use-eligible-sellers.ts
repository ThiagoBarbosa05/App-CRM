import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface EligibleSeller {
  id: string;
  name: string;
  email: string;
  blingVendedorId: string;
  blingVendedorName: string | null;
}

/** Usuários já mapeados como vendedor Bling para a conexão informada. */
export function useEligibleSellers(connectionId: string | null) {
  return useQuery<EligibleSeller[], Error>({
    queryKey: ["/api/restaurant-pdv/units/eligible-sellers", connectionId],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/restaurant-pdv/units/eligible-sellers?connectionId=${connectionId}`,
      );
      return res.json() as Promise<EligibleSeller[]>;
    },
    enabled: !!connectionId,
  });
}
