import { useQuery } from "@tanstack/react-query";

interface Campaign {
  id: string;
  title: string;
  status: "created" | "in_progress" | "completed" | "failed" | "cancelled";
  totalContacts: number;
  scheduledMessages: number;
  sentMessages: number;
  failedMessages: number;
  startDate: string;
  endDate: string | null;
  completedAt: string | null;
  botId: string;
  botTriggerName: string;
  channelId: string;
  fromPhone: string;
  intervalSeconds: number;
  exclusiveTagFilter: boolean;
  tagIds: string[];
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

interface CampaignsResponse {
  campaigns: Campaign[];
  total: number;
}

interface UseCampaignsParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export function useCampaigns(params?: UseCampaignsParams) {
  return useQuery<CampaignsResponse>({
    queryKey: ["campaigns", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();

      if (params?.status) searchParams.append("status", params.status);
      if (params?.limit) searchParams.append("limit", String(params.limit));
      if (params?.offset) searchParams.append("offset", String(params.offset));

      const response = await fetch(
        `/api/umbler/campaigns?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error("Falha ao buscar campanhas");
      }

      return response.json();
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });
}
