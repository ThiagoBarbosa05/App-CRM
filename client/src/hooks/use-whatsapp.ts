import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ---- Types ----

export interface WhatsappCampaign {
  id: string;
  title: string;
  status: "created" | "in_progress" | "paused" | "completed" | "failed" | "cancelled";
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
  status: "scheduled" | "sent" | "delivered" | "read" | "failed" | "cancelled";
  scheduledAt: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
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
    delivered: number;
    read: number;
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
  metaTemplateId?: string | null;
  metaStatus?: string | null;
  qualityScore?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsappFlow {
  id: string;
  metaFlowId: string;
  name: string;
  status: "DRAFT" | "PUBLISHED" | "DEPRECATED" | "BLOCKED";
  categories: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WhatsappBot {
  id: string;
  name: string;
  triggerType: "keyword" | "new_conversation";
  triggerKeyword?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: unknown[];
  quality_score?: { score?: string } | null;
  rejected_reason?: string | null;
}

export interface MetaTemplateCreatePayload {
  name: string;
  language: string;
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  parameter_format?: "NAMED" | "POSITIONAL";
  components: unknown[];
}

export interface WhatsappSettings {
  wa_phone_number_id: string;
  wa_access_token: string;
  wa_waba_id: string;
  wa_app_id: string;
  wa_webhook_verify_token: string;
  wa_api_version: string;
  wa_enabled: string;
  wa_message_delay_ms: string;
}

export interface WhatsappChannel {
  id: number;
  name: string;
  phoneNumberId: string;
  wabaId: string;
  displayPhone: string | null;
  userId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface MetaPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  code_verification_status: "VERIFIED" | "PENDING" | "EXPIRED" | "NOT_VERIFIED";
  quality_rating: "GREEN" | "YELLOW" | "RED" | "UNKNOWN";
  status: "CONNECTED" | "DISCONNECTED" | "PENDING" | "FLAGGED" | "RESTRICTED";
  platform_type?: string;
}

export interface CreateWhatsappChannelPayload {
  name: string;
  phoneNumberId: string;
  accessToken?: string;
  wabaId: string;
  displayPhone?: string;
  userId?: string | null;
  isActive?: boolean;
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
    // Atualiza ao vivo somente enquanto o disparo está efetivamente em andamento.
    refetchInterval: (query) => {
      const data = query.state.data as WhatsappCampaignDetails | undefined;
      return data?.status === "in_progress" ? 4000 : false;
    },
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
    refetchInterval: (query) => {
      const data = query.state.data as WhatsappCampaignStats | undefined;
      if (!data) return false;
      return data.stats.pending > 0 ? 4000 : false;
    },
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

export function useRetryFailedCampaign() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await apiRequest("POST", `/api/whatsapp/campaigns/${campaignId}/retry-failed`);
      return res.json() as Promise<{ campaignId: string; requeued: number }>;
    },
    onSuccess: (data, campaignId) => {
      toast({
        title: data.requeued > 0
          ? `${data.requeued} mensagem(ns) reenfileirada(s)`
          : "Nenhuma falha para reprocessar",
      });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "campaigns", campaignId, "stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao reprocessar falhas", description: error.message, variant: "destructive" });
    },
  });
}

function useCampaignControl(action: "pause" | "resume" | "cancel", successTitle: string) {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await apiRequest("POST", `/api/whatsapp/campaigns/${campaignId}/${action}`);
      return res.json();
    },
    onSuccess: (_data, campaignId) => {
      toast({ title: successTitle });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "campaigns", campaignId, "stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });
}

export const usePauseCampaign = () => useCampaignControl("pause", "Campanha pausada");
export const useResumeCampaign = () => useCampaignControl("resume", "Campanha retomada");
export const useCancelCampaign = () => useCampaignControl("cancel", "Campanha cancelada");

// Fonte única do hook de bots (envia o header x-user-id). Reexportado aqui por
// conveniência para quem já importa de "use-whatsapp".
export { useWhatsappBots } from "./use-whatsapp-bots";

// Creates a campaign (POST /api/campaigns) then dispatches (POST /api/whatsapp/campaigns)
export function useCreateCampaignWithDispatch() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      waTemplateId?: string;
      waBotId?: string;
      metaTemplateName?: string;
      metaTemplateLanguage?: string;
      metaTemplateCategory?: string;
      metaTemplateBodyParams?: string[];
      clientIds: string[];
      scheduledAt?: string; // ISO; se no futuro, a campanha fica agendada
    }) => {
      const campaignRes = await apiRequest("POST", "/api/campaigns", {
        name: data.name,
        description: data.description,
        type: "humano",
        waEnabled: true,
        waTemplateId: data.waTemplateId ?? null,
        waBotId: data.waBotId ?? null,
        metaTemplateName: data.metaTemplateName,
        metaTemplateLanguage: data.metaTemplateLanguage,
        metaTemplateCategory: data.metaTemplateCategory,
        metaTemplateBodyParams: data.metaTemplateBodyParams,
      });
      const campaign = await campaignRes.json();

      const dispatchRes = await apiRequest("POST", "/api/whatsapp/campaigns", {
        campaignId: campaign.id,
        clientIds: data.clientIds,
        scheduledAt: data.scheduledAt,
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

export function useSubmitMetaTemplate() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: MetaTemplateCreatePayload) => {
      const res = await apiRequest("POST", "/api/whatsapp/templates/meta", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Template enviado para aprovação da Meta" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "templates", "meta"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao enviar template", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteMetaTemplate() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest(
        "DELETE",
        `/api/whatsapp/templates/meta/${encodeURIComponent(name)}`,
      );
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Template excluído da Meta" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "templates", "meta"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao excluir template", description: error.message, variant: "destructive" });
    },
  });
}

export function useUploadTemplateMedia() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (file: File): Promise<{ handle: string }> => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/whatsapp/templates/meta/media", {
        method: "POST",
        headers: { "x-user-id": localStorage.getItem("userId") ?? "" },
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao enviar mídia");
      }
      return res.json();
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao carregar mídia", description: error.message, variant: "destructive" });
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

// ---- Channels ----

export function useWhatsappChannels() {
  return useQuery<WhatsappChannel[]>({
    queryKey: ["whatsapp", "channels"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/channels");
      if (!res.ok) throw new Error("Erro ao buscar canais");
      return res.json();
    },
  });
}

export function useCreateWhatsappChannel() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: CreateWhatsappChannelPayload) => {
      const res = await apiRequest("POST", "/api/whatsapp/channels", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Canal criado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "channels"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao criar canal", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateWhatsappChannel() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CreateWhatsappChannelPayload> }) => {
      const res = await apiRequest("PATCH", `/api/whatsapp/channels/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Canal atualizado com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "channels"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao atualizar canal", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteWhatsappChannel() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/whatsapp/channels/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Canal removido com sucesso" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "channels"] });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao remover canal", description: error.message, variant: "destructive" });
    },
  });
}

export function useWabaPhoneNumbers(enabled: boolean) {
  return useQuery<MetaPhoneNumber[]>({
    queryKey: ["whatsapp", "channels", "from-waba"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/channels/from-waba");
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? "Erro ao buscar números da WABA");
      }
      return res.json();
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useChannelStatus(id: number | null) {
  return useQuery<MetaPhoneNumber>({
    queryKey: ["whatsapp", "channels", id, "status"],
    queryFn: async () => {
      const res = await fetch(`/api/whatsapp/channels/${id}/status`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? "Erro ao buscar status");
      }
      return res.json();
    },
    enabled: id !== null,
    staleTime: 60_000,
    retry: false,
  });
}

export function useRequestVerificationCode() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, codeMethod }: { id: number; codeMethod: "SMS" | "VOICE" }) => {
      const res = await apiRequest("POST", `/api/whatsapp/channels/${id}/request-code`, { codeMethod });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Código enviado", description: "Verifique seu telefone." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao solicitar código", description: error.message, variant: "destructive" });
    },
  });
}

export function useVerifyPhoneNumber() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, code }: { id: number; code: string }) => {
      const res = await apiRequest("POST", `/api/whatsapp/channels/${id}/verify-code`, { code });
      return res.json();
    },
    onSuccess: (_data, { id }) => {
      toast({ title: "Número verificado com sucesso!" });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "channels", id, "status"] });
    },
    onError: (error: Error) => {
      toast({ title: "Código inválido", description: error.message, variant: "destructive" });
    },
  });
}

// ---- Flows ----

export function useWhatsappFlows() {
  return useQuery<WhatsappFlow[]>({
    queryKey: ["whatsapp", "flows"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/flows");
      if (!res.ok) throw new Error("Erro ao buscar flows");
      return res.json();
    },
  });
}

// ---- Monitor Meta ----

export interface WaAccountEvent {
  id: string;
  field: string;
  eventType: string;
  severity: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface WaMonitorHealth {
  throughputTier: string | null;
  templatesWithIssues: number;
  flowsBlocked: number;
  lastCriticalEvent: WaAccountEvent | null;
  totalEvents: number;
}

export interface WaMonitorEventsResult {
  events: WaAccountEvent[];
  total: number;
}

export function useWaMonitorHealth() {
  return useQuery<WaMonitorHealth>({
    queryKey: ["whatsapp", "monitor", "health"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/monitor/health");
      if (!res.ok) throw new Error("Erro ao buscar dados de saúde");
      return res.json();
    },
    refetchInterval: 60_000,
  });
}

export function useWaMonitorEvents(params?: { severity?: string; field?: string; limit?: number; offset?: number }) {
  return useQuery<WaMonitorEventsResult>({
    queryKey: ["whatsapp", "monitor", "events", params],
    queryFn: async () => {
      const qs = new URLSearchParams(
        Object.fromEntries(
          Object.entries(params ?? {})
            .filter(([, v]) => v !== undefined && v !== "")
            .map(([k, v]) => [k, String(v)]),
        ),
      ).toString();
      const res = await fetch(`/api/whatsapp/monitor/events${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Erro ao buscar eventos");
      return res.json();
    },
    refetchInterval: 60_000,
  });
}
