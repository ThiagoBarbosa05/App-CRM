import { useQuery } from "@tanstack/react-query";

interface CampaignMessage {
  id: string;
  campaignId: string;
  contactId: string | null;
  contactName: string;
  phoneNumber: string;
  status: "scheduled" | "sent" | "failed" | "cancelled";
  scheduledAt: string;
  sentAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CampaignDetails {
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
  messages: CampaignMessage[];
}

export function useCampaignDetails(campaignId: string | undefined) {
  return useQuery<CampaignDetails>({
    queryKey: ["campaign-details", campaignId],
    queryFn: async () => {
      if (!campaignId) {
        throw new Error("Campaign ID is required");
      }

      const response = await fetch(`/api/umbler/campaigns/${campaignId}`);

      if (!response.ok) {
        throw new Error("Falha ao buscar detalhes da campanha");
      }

      return response.json();
    },
    enabled: !!campaignId,
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });
}
