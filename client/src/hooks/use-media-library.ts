import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type MediaType = "image" | "video" | "document";

export interface MediaLibraryItem {
  id: string;
  name: string;
  storageKey: string;
  mediaType: MediaType;
  mimeType: string;
  size: number;
  createdBy: string | null;
  createdAt: string;
  url: string;
}

const BASE = "/api/media-library";

export function useMediaLibrary(params: { type?: MediaType; search?: string }) {
  const qs = new URLSearchParams();
  if (params.type) qs.set("type", params.type);
  if (params.search && params.search.trim()) qs.set("search", params.search.trim());
  const query = qs.toString();

  return useQuery<MediaLibraryItem[]>({
    queryKey: [BASE, params.type ?? "all", params.search ?? ""],
    queryFn: async () => {
      const res = await fetch(`${BASE}${query ? `?${query}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao buscar mídias");
      return res.json();
    },
  });
}

export function useUploadMedia() {
  const queryClient = useQueryClient();
  return useMutation<MediaLibraryItem, Error, { file: File; name?: string }>({
    mutationFn: async ({ file, name }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (name) formData.append("name", name);
      const res = await fetch(BASE, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string }).message ?? "Falha ao enviar mídia");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BASE] });
    },
  });
}

export function useDeleteMedia() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const res = await fetch(`${BASE}/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha ao excluir mídia");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BASE] });
    },
  });
}
