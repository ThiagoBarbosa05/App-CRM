import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

export interface OpenAIStatus {
  configured: boolean;
  connected: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
}

export interface OpenAIConfig {
  models: { chat: string; test: string; profile: string };
  defaults: { temperature: number; maxTokens: number };
  uses: string[];
  keyHint: string | null;
  configured: boolean;
}

const STATUS_QUERY_KEY = ["/api/integrations/openai/status"];
const CONFIG_QUERY_KEY = ["/api/integrations/openai/config"];

export function useOpenAIStatus() {
  return useQuery<OpenAIStatus>({
    queryKey: STATUS_QUERY_KEY,
  });
}

export function useOpenAIConfig() {
  return useQuery<OpenAIConfig>({
    queryKey: CONFIG_QUERY_KEY,
  });
}

export function useTestOpenAIConnection() {
  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/integrations/openai/test");
      return (await res.json()) as OpenAIStatus;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(STATUS_QUERY_KEY, data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: STATUS_QUERY_KEY });
    },
  });
}
