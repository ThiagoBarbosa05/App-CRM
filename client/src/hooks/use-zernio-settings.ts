import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

export function useZernioSettings() {
  return useQuery<Record<string, string>>({
    queryKey: ["/api/zernio/settings"],
  });
}

export function useZernioStatus() {
  return useQuery<{ configured: boolean; ok?: boolean }>({
    queryKey: ["/api/zernio/status"],
  });
}

export function useUpdateZernioSettings() {
  return useMutation({
    mutationFn: (data: Record<string, string>) =>
      apiRequest("PUT", "/api/zernio/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/zernio/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/zernio/status"] });
    },
  });
}
