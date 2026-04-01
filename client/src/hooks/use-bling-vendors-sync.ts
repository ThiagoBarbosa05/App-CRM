import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export interface BlingVendedor {
  id: number;
  descontoLimite: number;
  loja: { id: number };
  contato: {
    id: number;
    nome: string;
    situacao: string;
  };
}

export interface UserForSync {
  id: string;
  name: string;
  email: string;
  role: string;
  blingVendedorId: string | null;
}

async function apiRequest<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw Object.assign(new Error(data.error ?? res.statusText), { status: res.status });
  }

  return res.json() as Promise<T>;
}

export function useBlingVendedores() {
  return useQuery<BlingVendedor[], Error>({
    queryKey: ["/api/bling-accounts/vendors"],
    queryFn: async () => {
      const data = await apiRequest<{ success: boolean; data: BlingVendedor[] }>(
        "GET",
        "/api/bling-accounts/vendors",
      );
      return data.data;
    },
    retry: false,
  });
}

export function useUsersForSync() {
  return useQuery<UserForSync[], Error>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const data = await apiRequest<UserForSync[]>("GET", "/api/users");
      return data;
    },
    select: (users) => users.filter((u) => u.role === "vendedor" || u.role === "gerente"),
  });
}

export function useSyncBlingVendors() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<
    { success: boolean; data: { updated: number } },
    Error,
    Array<{ userId: string; blingVendedorId: string | null }>
  >({
    mutationFn: (mappings) =>
      apiRequest("POST", "/api/users/sync-bling-vendors", { mappings }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Mapeamento salvo",
        description: `${result.data.updated} usuário(s) atualizado(s) com sucesso.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Erro ao salvar mapeamento",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
