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

export function useDeleteAutomationRule() {
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/automation-rules/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RULES_KEY }),
  });
}
