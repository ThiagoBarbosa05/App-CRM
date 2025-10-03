import { useQuery } from "@tanstack/react-query";

export interface MessageJobsLog {
  id: string;
  automationId: string;
  clientId: string;
  scheduledSendAt: string;
  actualSendAt?: string;
  status: "agendado" | "enviado" | "falhou";
  attempts: number;
  lastError?: string;
  externalId?: string;
  createdAt: string;
  client: {
    id: string;
    name: string;
  } | null;
}

export interface UseMessageJobsLogsOptions {
  automationId?: string;
  page?: number;
  pageSize?: number;
  status?: "agendado" | "enviado" | "falhou" | "all";
}

export interface MessageJobsLogsResponse {
  data: MessageJobsLog[];
  total: number;
  page: number;
  pageSize: number;
}

export function useMessageJobsLogs({
  automationId,
  page = 1,
  pageSize = 20,
  status,
}: UseMessageJobsLogsOptions) {
  return useQuery<MessageJobsLogsResponse>({
    queryKey: ["message-jobs-logs", { automationId, page, pageSize, status }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (automationId) params.append("automationId", automationId);
      if (status && status !== "all") params.append("status", status);
      params.append("page", String(page));
      params.append("pageSize", String(pageSize));
      const response = await fetch(
        `/api/message-jobs-logs?${params.toString()}`
      );
      if (!response.ok) throw new Error("Failed to fetch message jobs logs");
      return response.json();
    },
  });
}
