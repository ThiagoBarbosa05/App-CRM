import { useQuery } from "@tanstack/react-query";

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
  id: string;
  name: string;
  description: string | null;
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
  return useQuery<BotsResponse>({
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

      const response = await fetch(
        `/api/umbler/bots?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error("Falha ao buscar bots");
      }

      return response.json();
    },
  });
}
