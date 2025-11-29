import { useQuery } from "@tanstack/react-query";

interface CampaignStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

interface CampaignStatsResponse {
  campaignId: string;
  stats: CampaignStats;
  timestamp: string;
}

export function useCampaignStats(campaignId: string | undefined) {
  return useQuery<CampaignStatsResponse>({
    queryKey: ["campaign-stats", campaignId],
    queryFn: async () => {
      if (!campaignId) {
        throw new Error("Campaign ID is required");
      }

      const response = await fetch(`/api/umbler/campaigns/${campaignId}/stats`);

      if (!response.ok) {
        throw new Error("Falha ao buscar estatísticas da campanha");
      }

      return response.json();
    },
    enabled: !!campaignId,
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });
}
