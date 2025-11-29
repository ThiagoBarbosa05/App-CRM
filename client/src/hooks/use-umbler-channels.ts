import { useQuery } from "@tanstack/react-query";

interface Channel {
  id: string;
  name: string;
  type: string;
  phoneNumber?: string;
  isActive: boolean;
}

interface ChannelsResponse {
  items: Channel[];
}

export function useUmblerChannels() {
  return useQuery<ChannelsResponse>({
    queryKey: ["umbler-channels"],
    queryFn: async () => {
      const response = await fetch("/api/umbler/channels");

      if (!response.ok) {
        throw new Error("Falha ao buscar canais");
      }

      return response.json();
    },
  });
}
