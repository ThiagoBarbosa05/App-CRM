import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

export function useWhatsappSettings() {
  return useQuery<Record<string, string>>({
    queryKey: ["/api/whatsapp/settings"],
  });
}

export function useWhatsappStatus() {
  return useQuery<{ enabled: boolean; configured: boolean }>({
    queryKey: ["/api/whatsapp/settings/status"],
  });
}

export function useUpdateWhatsappSettings() {
  return useMutation({
    mutationFn: (data: Record<string, string>) =>
      apiRequest("PUT", "/api/whatsapp/settings", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/settings/status"] });
    },
  });
}
