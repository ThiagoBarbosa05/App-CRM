import { useQuery } from "@tanstack/react-query";

interface Tag {
  id: string;
  name: string;
  color?: string;
}

interface TagsResponse {
  items: Tag[];
}

interface UseTagsParams {
  query?: string;
}

export function useUmblerTags(params?: UseTagsParams) {
  return useQuery<TagsResponse>({
    queryKey: ["umbler-tags", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.query) {
        searchParams.append("query", params.query);
      }

      const url = `/api/umbler/tags${
        searchParams.toString() ? `?${searchParams.toString()}` : ""
      }`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Falha ao buscar tags");
      }

      const data = await response.json();
      return data || [];
    },
  });
}
