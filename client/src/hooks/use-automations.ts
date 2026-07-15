import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import type {
  AutomationRule,
  InsertAutomationRule,
  MessageTemplate,
  InsertMessageTemplate,
} from "@shared/schema";

const TEMPLATES_KEY = ["/api/message-templates"];
const RULES_KEY = ["/api/automation-rules"];

export function useMessageTemplates() {
  return useQuery<MessageTemplate[]>({ queryKey: TEMPLATES_KEY });
}

export function useCreateMessageTemplate() {
  return useMutation({
    mutationFn: async (data: InsertMessageTemplate) => {
      const res = await apiRequest("POST", "/api/message-templates", data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useUpdateMessageTemplate() {
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<InsertMessageTemplate>;
    }) => {
      const res = await apiRequest("PUT", `/api/message-templates/${id}`, data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useDeleteMessageTemplate() {
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/message-templates/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useReorderMessageTemplates() {
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await apiRequest("PATCH", "/api/message-templates/reorder", {
        orderedIds,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TEMPLATES_KEY }),
  });
}

export function useTestSendMessageTemplate() {
  return useMutation({
    mutationFn: async ({ id, to }: { id: string; to: string }) => {
      const res = await apiRequest(
        "POST",
        `/api/message-templates/${id}/test-send`,
        { to },
      );
      return res.json();
    },
  });
}

export function useAutomationRules() {
  return useQuery<AutomationRule[]>({ queryKey: RULES_KEY });
}

export function useCreateAutomationRule() {
  return useMutation({
    mutationFn: async (data: InsertAutomationRule) => {
      const res = await apiRequest("POST", "/api/automation-rules", data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RULES_KEY }),
  });
}

export function useUpdateAutomationRule() {
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<InsertAutomationRule>;
    }) => {
      const res = await apiRequest("PUT", `/api/automation-rules/${id}`, data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RULES_KEY }),
  });
}

export function useToggleAutomationRule() {
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/automation-rules/${id}/toggle`, {
        isActive,
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RULES_KEY }),
  });
}

export function useReorderAutomationRules() {
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await apiRequest("PATCH", "/api/automation-rules/reorder", {
        orderedIds,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RULES_KEY }),
  });
}

export function useDeleteAutomationRule() {
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/automation-rules/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RULES_KEY }),
  });
}

export interface AutomationRuleOverview {
  id: string;
  name: string;
  trigger: AutomationRule["trigger"];
  triggerParams: Record<string, unknown> | null;
  isActive: boolean;
  activeClients: number;
  sentRecent: number;
  failedRecent: number;
  lastFailureAt: string | null;
  lastDispatchAt: string | null;
}

export interface AutomationRuleClientRow {
  clientId: string;
  clientName: string;
  attemptsSent: number | null;
  lastDispatchAt: string;
  lastStatus: "success" | "failed";
  successCount: number;
  failedCount: number;
  cashbackStatus: "active" | "expired" | "redeemed" | null;
  cashbackExpiresAt: string | null;
}

export interface AutomationHistoryRow {
  id: string;
  ruleId: string;
  ruleName: string;
  clientId: string | null;
  clientName: string | null;
  channel: "sms" | "email";
  status: "success" | "failed";
  errorMessage: string | null;
  createdAt: string;
}

export interface AutomationHistoryFilters {
  clientId?: string;
  clientName?: string;
  ruleId?: string;
  channel?: "sms" | "email";
  status?: "success" | "failed";
  page?: number;
  pageSize?: number;
}

export function useAutomationOverview() {
  return useQuery<AutomationRuleOverview[]>({
    queryKey: ["/api/automation-monitoring/overview"],
    refetchInterval: 60_000,
  });
}

export function useAutomationRuleClients(ruleId: string | null) {
  return useQuery<AutomationRuleClientRow[]>({
    queryKey: ["/api/automation-monitoring/rules", ruleId, "clients"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/automation-monitoring/rules/${ruleId}/clients`,
      );
      return res.json();
    },
    enabled: !!ruleId,
  });
}

export function useAutomationHistory(filters: AutomationHistoryFilters) {
  const params = new URLSearchParams();
  if (filters.clientId) params.set("clientId", filters.clientId);
  if (filters.clientName) params.set("clientName", filters.clientName);
  if (filters.ruleId) params.set("ruleId", filters.ruleId);
  if (filters.channel) params.set("channel", filters.channel);
  if (filters.status) params.set("status", filters.status);
  params.set("page", String(filters.page ?? 1));
  params.set("pageSize", String(filters.pageSize ?? 20));

  return useQuery<{
    data: AutomationHistoryRow[];
    total: number;
    page: number;
    pageSize: number;
  }>({
    queryKey: ["/api/automation-monitoring/history", filters],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/automation-monitoring/history?${params.toString()}`,
      );
      return res.json();
    },
  });
}
