import { useQuery } from "@tanstack/react-query";

interface Tag {
  id: string;
  name: string;
  color?: string;
}

interface TagsResponse {
  items: Tag[];
}

export function useUmblerTags() {
  return useQuery<TagsResponse>({
    queryKey: ["umbler-tags"],
    queryFn: async () => {
      const response = await fetch("/api/umbler/tags");

      if (!response.ok) {
        throw new Error("Falha ao buscar tags");
      }

      const data = await response.json();
      return { items: data || [] };
    },
  });
}
