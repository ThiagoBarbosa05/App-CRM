import { useQuery } from "@tanstack/react-query";
import { ManualStartBotResponse } from "server/integrations/umbler";

interface BotVariable {
  name: string;
  label: string;
  isRequired: boolean;
}

interface BotManualStart {
  id: string;
  name: string;
  description: string | null;
  variables: BotVariable[];
}

interface Bot {
  botId: string;
  botTitle: string;
  description: string | null;
  stepId: string;
  triggerName: string;
  hidden: boolean;
  manualStarts: BotManualStart[];
}

interface BotsResponse {
  items: Bot[];
  totalCount: number;
  skip: number;
  take: number;
}

interface UseBotsParams {
  query?: string;
  skip?: number;
  take?: number;
  hidden?: boolean;
}

export function useUmblerBots(params?: UseBotsParams) {
  return useQuery<ManualStartBotResponse>({
    queryKey: ["umbler-bots", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();

      if (params?.query) searchParams.append("query", params.query);
      if (params?.skip !== undefined)
        searchParams.append("skip", String(params.skip));
      if (params?.take !== undefined)
        searchParams.append("take", String(params.take));
      if (params?.hidden !== undefined)
        searchParams.append("hidden", String(params.hidden));

      console.log(
        "Fazendo requisição para bots com params:",
        searchParams.toString()
      );

      const response = await fetch(
        `/api/umbler/manual-starts/bot?${searchParams.toString()}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Erro na resposta da API:", errorData);
        throw new Error(errorData.message || "Falha ao buscar bots");
      }

      const data = await response.json();
      console.log("Dados recebidos da API:", data);

      return data;
    },
  });
}
