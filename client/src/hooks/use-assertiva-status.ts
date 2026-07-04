import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

export interface AssertivaStatus {
  configured: boolean;
  connected: boolean;
  tokenExpiresAt: string | null;
  lastRefreshAt: string | null;
  lastError: string | null;
}

const STATUS_QUERY_KEY = ["/api/integrations/assertiva/status"];

export function useAssertivaStatus() {
  return useQuery<AssertivaStatus>({
    queryKey: STATUS_QUERY_KEY,
    refetchInterval: 30_000,
  });
}

export function useRefreshAssertivaToken() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/integrations/assertiva/refresh");
      return (await res.json()) as AssertivaStatus;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(STATUS_QUERY_KEY, data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
    },
  });
}
