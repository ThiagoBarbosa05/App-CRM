import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ---- Types ----

export interface WhatsappCampaign {
  id: string;
  title: string;
  status: "created" | "in_progress" | "completed" | "failed" | "cancelled";
  totalContacts: number;
  scheduledMessages: number;
  sentMessages: number;
  failedMessages: number;
  startDate: string;
  endDate?: string;
  completedAt?: string;
  createdAt: string;
}

export interface WhatsappCampaignMessage {
  id: string;
  campaignId: string;
  contactName: string;
  phoneNumber: string;
  status: "scheduled" | "sent" | "failed" | "cancelled";
  scheduledAt: string;
  sentAt?: string;
  errorMessage?: string;
}

export interface WhatsappCampaignDetails extends WhatsappCampaign {
  messages: WhatsappCampaignMessage[];
}

export interface WhatsappCampaignStats {
  campaignId: string;
  stats: {
    total: number;
    sent: number;
    failed: number;
    pending: number;
  };
  timestamp: string;
}

export interface WhatsappTemplate {
  id: string;
  name: string;
  languageCode: string;
  category?: string;
  useCase: "birthday_today" | "birthday_days_before" | "post_call" | "campaign" | "custom";
  description?: string;
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

export interface WhatsappSettings {
  wa_phone_number_id: string;
  wa_access_token: string;
  wa_waba_id: string;
  wa_webhook_verify_token: string;
  wa_api_version: string;
  wa_enabled: string;
  wa_message_delay_ms: string;
}

export interface WhatsappStatus {
  enabled: boolean;
  configured: boolean;
}

// ---- Campaigns ----

export function useWhatsappCampaigns(params?: { status?: string; limit?: number; offset?: number }) {
  return useQuery<{ campaigns: WhatsappCampaign[]; total: number }>({
    queryKey: ["whatsapp", "campaigns", params],
    queryFn: async () => {
      const search = new URLSearchParams();
      if (params?.status) search.set("status", params.status);
      if (params?.limit) search.set("limit", String(params.limit));
      if (params?.offset) search.set("offset", String(params.offset));
      const res = await fetch(`/api/whatsapp/campaigns?${search.toString()}`);
      if (!res.ok) throw new Error("Erro ao buscar campanhas");
      return res.json();
    },
  });
}

export function useWhatsappCampaignDetails(id: string | undefined) {
  return useQuery<WhatsappCampaignDetails>({
    queryKey: ["whatsapp", "campaigns", id],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/campaigns/${id}`);
      if (!res.ok) throw new Error("Erro ao buscar campanha");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useWhatsappCampaignStats(id: string | undefined) {
  return useQuery<WhatsappCampaignStats>({
    queryKey: ["whatsapp", "campaigns", id, "stats"],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/campaigns/${id}/stats`);
      if (!res.ok) throw new Error("Erro ao buscar estatísticas");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useExecuteCampaign() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await apiRequest("POST", `/api/whatsapp/campaigns/${campaignId}/execute`);
      return res.json();
    },
    onSuccess: (_, campaignId) => {
      toast({ title: "Campanha re-executada com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "campaigns", campaignId, "stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao executar campanha", description: error.message, variant: "destructive" });
    },
  });
}

// Creates a campaign (POST /api/campaigns) then dispatches (POST /api/whatsapp/campaigns)
export function useCreateCampaignWithDispatch() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      waTemplateId: string;
      clientIds: string[];
    }) => {
      const campaignRes = await apiRequest("POST", "/api/campaigns", {
        name: data.name,
        description: data.description,
        type: "humano",
        waEnabled: true,
        waTemplateId: data.waTemplateId,
      });
      const campaign = await campaignRes.json();

      const dispatchRes = await apiRequest("POST", "/api/whatsapp/campaigns", {
        campaignId: campaign.id,
        clientIds: data.clientIds,
      });
      return dispatchRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "campaigns"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar campanha", description: error.message, variant: "destructive" });
    },
  });
}

// ---- Templates ----

export function useWhatsappTemplates() {
  return useQuery<WhatsappTemplate[]>({
    queryKey: ["whatsapp", "templates"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/templates");
      if (!res.ok) throw new Error("Erro ao buscar templates");
      return res.json();
    },
  });
}

export function useWhatsappMetaTemplates() {
  return useQuery<MetaTemplate[]>({
    queryKey: ["whatsapp", "templates", "meta"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/templates/meta");
      if (!res.ok) throw new Error("Erro ao buscar templates da Meta");
      return res.json();
    },
  });
}

export function useCreateTemplate() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      useCase: WhatsappTemplate["useCase"];
      languageCode?: string;
      category?: string;
      description?: string;
      isActive?: boolean;
    }) => {
      const res = await apiRequest("POST", "/api/whatsapp/templates", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Template criado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "templates"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar template", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateTemplate() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, data }: {
      id: string;
      data: Partial<{
        name: string;
        useCase: WhatsappTemplate["useCase"];
        languageCode: string;
        category: string;
        description: string;
        isActive: boolean;
      }>;
    }) => {
      const res = await apiRequest("PUT", `/api/whatsapp/templates/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Template atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "templates"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar template", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteTemplate() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/whatsapp/templates/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Template excluído com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "templates"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir template", description: error.message, variant: "destructive" });
    },
  });
}

// ---- Settings ----

export function useWhatsappSettings() {
  return useQuery<WhatsappSettings>({
    queryKey: ["whatsapp", "settings"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/settings");
      if (!res.ok) throw new Error("Erro ao buscar configurações");
      return res.json();
    },
  });
}

export function useWhatsappStatus() {
  return useQuery<WhatsappStatus>({
    queryKey: ["whatsapp", "status"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/settings/status");
      if (!res.ok) throw new Error("Erro ao buscar status");
      return res.json();
    },
  });
}

export function useUpdateWhatsappSettings() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: Partial<WhatsappSettings>) => {
      const res = await apiRequest("PUT", "/api/whatsapp/settings", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Configurações salvas com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "settings"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "status"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar configurações", description: error.message, variant: "destructive" });
    },
  });
}
