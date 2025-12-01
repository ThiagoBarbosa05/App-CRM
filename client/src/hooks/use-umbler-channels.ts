import { useQuery } from "@tanstack/react-query";

interface Channel {
  id: string;
  name: string;
  channelType: string;
  phoneNumber?: string;
  state: "Live" | "Disabled";
}

interface ChannelsResponse {
  items: Channel[];
}

export function useUmblerChannels() {
  return useQuery<Channel[]>({
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
