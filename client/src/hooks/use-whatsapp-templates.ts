import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

export interface WhatsappTemplate {
  id: string;
  name: string;
  languageCode: string;
  category: string | null;
  useCase: "birthday_today" | "birthday_days_before" | "post_call" | "campaign" | "custom";
  description: string | null;
  headerParams: unknown;
  bodyParams: unknown;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: unknown[];
}

export function useWhatsappTemplates() {
  return useQuery<WhatsappTemplate[]>({
    queryKey: ["/api/whatsapp/templates"],
  });
}

export function useMetaTemplates(enabled = false) {
  return useQuery<MetaTemplate[]>({
    queryKey: ["/api/whatsapp/templates/meta"],
    enabled,
    staleTime: 60_000,
  });
}

export function useCreateWhatsappTemplate() {
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest("POST", "/api/whatsapp/templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
    },
  });
}

export function useUpdateWhatsappTemplate() {
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<WhatsappTemplate> & { id: string }) =>
      apiRequest("PUT", `/api/whatsapp/templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
    },
  });
}

export function useDeleteWhatsappTemplate() {
  return useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/whatsapp/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
    },
  });
}
