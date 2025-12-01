import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "./use-toast";

interface CreateCampaignRequest {
  title: string;
  tagIds: string[];
  contactIds?: string[]; // IDs específicos dos contatos selecionados
  exclusiveTagFilter: boolean;
  botId: string;
  botTriggerName: string;
  channelId: string;
  fromPhone: string;
  scheduledDate: string;
  intervalSeconds: number;
  cancelUpon: string[];
  organizationId: string;
}

interface CreateCampaignResponse {
  success: boolean;
  campaign: {
    bulkSessionId: string;
    title: string;
    botId: string;
    channelId: string;
    totalContacts: number;
    scheduledMessages: number;
    failedMessages: number;
    startDate: string;
    endDate: string;
    intervalSeconds: number;
    exclusiveTagFilter: boolean;
    tagIds: string[];
  };
  scheduledMessages: Array<{
    id: string;
    contactName: string;
    phoneNumber: string;
    scheduledAt: string;
  }>;
  failedMessages: Array<{
    contactName: string;
    phoneNumber: string;
    reason: string;
  }>;
}

export function useCreateCampaign() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation<CreateCampaignResponse, Error, CreateCampaignRequest>({
    mutationFn: async (data) => {
      const response = await fetch("/api/umbler/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || error.message || "Falha ao criar campanha"
        );
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Campanha criada com sucesso!",
        description: `${data.campaign.scheduledMessages} mensagens agendadas para ${data.campaign.totalContacts} contatos`,
      });
      queryClient.invalidateQueries({ queryKey: ["umbler-contacts"] });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar campanha",
        description: error.message,
      });
    },
  });
}
