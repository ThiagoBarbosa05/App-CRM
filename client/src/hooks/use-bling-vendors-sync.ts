import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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

export interface BlingConnection {
  id: string;
  name: string;
  status: string;
}

export interface UserSellerMapping {
  connectionId: string;
  connectionName: string;
  blingVendedorId: string;
  blingVendedorName: string | null;
}

export interface ConnectionMapping {
  connectionId: string;
  blingVendedorId: string | null;
  blingVendedorName?: string | null;
}

export function useBlingVendedores() {
  return useQuery<BlingVendedor[], Error>({
    queryKey: ["/api/bling-accounts/vendors"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/bling-accounts/vendors");
        const data = (await res.json()) as { success: boolean; data: BlingVendedor[] };
        return data.data;
      } catch (err) {
        if (err instanceof Error) {
          const match = err.message.match(/^(\d+):/);
          if (match) {
            throw Object.assign(err, { status: parseInt(match[1], 10) });
          }
        }
        throw err;
      }
    },
    retry: false,
  });
}

export function useBlingVendedoresByConnection(connectionId: string | null) {
  return useQuery<BlingVendedor[], Error>({
    queryKey: ["/api/bling-accounts/vendors", connectionId],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", `/api/bling-accounts/vendors?connectionId=${connectionId}`);
        const data = (await res.json()) as { success: boolean; data: BlingVendedor[] };
        return data.data;
      } catch (err) {
        if (err instanceof Error) {
          const match = err.message.match(/^(\d+):/);
          if (match) {
            throw Object.assign(err, { status: parseInt(match[1], 10) });
          }
        }
        throw err;
      }
    },
    enabled: !!connectionId,
    retry: false,
  });
}

export function useBlingConnections() {
  return useQuery<BlingConnection[], Error>({
    queryKey: ["/api/bling-accounts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/bling-accounts");
      const data = (await res.json()) as { success: boolean; data: BlingConnection[] };
      return (data.data ?? []).filter((c) => c.status === "connected");
    },
  });
}

export function useUserSellerMappings(userId: string | null) {
  return useQuery<UserSellerMapping[], Error>({
    queryKey: ["/api/bling-accounts/seller-mappings", userId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/bling-accounts/seller-mappings?userId=${userId}`);
      const data = (await res.json()) as { success: boolean; data: UserSellerMapping[] };
      return data.data;
    },
    enabled: !!userId,
  });
}

export function useSetUserBlingMappings(userId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<{ success: boolean }, Error, ConnectionMapping[]>({
    mutationFn: async (connectionMappings) => {
      const res = await apiRequest("PUT", `/api/users/${userId}/bling-seller-mappings`, { connectionMappings });
      return res.json() as Promise<{ success: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bling-accounts/seller-mappings", userId] });
      toast({ title: "Mapeamento salvo", description: "Vínculos com o Bling atualizados com sucesso." });
    },
    onError: (error) => {
      toast({ title: "Erro ao salvar mapeamento", description: error.message, variant: "destructive" });
    },
  });
}

export function useUsersForSync() {
  return useQuery<UserForSync[], Error>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      return res.json() as Promise<UserForSync[]>;
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
    Array<{ userId: string; blingVendedorId: string | null; blingVendedorName: string | null }>
  >({
    mutationFn: async (mappings) => {
      const res = await apiRequest("POST", "/api/users/sync-bling-vendors", { mappings });
      return res.json() as Promise<{ success: boolean; data: { updated: number } }>;
    },
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
