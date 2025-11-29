import { useQuery } from "@tanstack/react-query";

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string;
  tags?: Array<{ id: string; name: string }>;
}

interface ContactsResponse {
  items: Contact[];
  totalCount: number;
}

interface UseContactsParams {
  query?: string;
  tagIds?: string[];
  exclusiveTag?: boolean;
}

export function useUmblerContacts(params?: UseContactsParams) {
  return useQuery<ContactsResponse>({
    queryKey: [
      "umbler-contacts",
      params?.query,
      params?.tagIds,
      params?.exclusiveTag,
    ],
    queryFn: async () => {
      const searchParams = new URLSearchParams();

      if (params?.query) searchParams.append("query", params.query);
      if (params?.tagIds && params.tagIds.length > 0) {
        params.tagIds.forEach((tagId) => searchParams.append("tags", tagId));
        if (params?.exclusiveTag !== undefined) {
          searchParams.append("exclusiveTag", String(params.exclusiveTag));
        }
      }

      const response = await fetch(
        `/api/umbler/contacts?${searchParams.toString()}`
      );

      if (!response.ok) {
        throw new Error("Falha ao buscar contatos");
      }

      const data = await response.json();
      return {
        items: data.items || [],
        totalCount: data.totalCount || 0,
      };
    },
  });
}
