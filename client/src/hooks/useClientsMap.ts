import { useQuery } from "@tanstack/react-query";

export interface Client {
  id: string;
  name: string;
}

export function useClientsMap() {
  return useQuery<Record<string, string>>({
    queryKey: ["clients-map"],
    queryFn: async () => {
      const response = await fetch("/api/clients?pageSize=1000");
      if (!response.ok) throw new Error("Failed to fetch clients");
      const result = await response.json();
      const clients: Client[] = result.data || result;
      // Map id -> name
      return clients.reduce((acc, c) => {
        acc[c.id] = c.name;
        return acc;
      }, {} as Record<string, string>);
    },
    staleTime: 1000 * 60 * 10, // 10 min
  });
}
