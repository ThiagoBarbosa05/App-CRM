import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export type ImportStatus =
  | "idle"
  | "running"
  | "completed"
  | "cancelled"
  | "failed";

export interface ImportProgress {
  status: ImportStatus;
  connectionId: string;
  startedAt: string | null;
  finishedAt: string | null;
  params: {
    startDate: string;
    endDate: string;
    forceUpdate?: boolean;
    idSituacao?: number;
    idLoja?: number;
  } | null;
  currentPage: number;
  totalFetched: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ orderId: number; error: string }>;
  cancelRequested: boolean;
}

interface ImportStatusResponse {
  success: boolean;
  data: ImportProgress;
}

export function useImportStatus(connectionId: string | null) {
  return useQuery<ImportProgress>({
    queryKey: ["/api/bling-accounts", connectionId, "import-status"],
    enabled: !!connectionId,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/bling-accounts/${connectionId}/import-status`,
      );
      const body = (await response.json()) as ImportStatusResponse;
      return body.data;
    },
    refetchInterval: (query) => {
      return query.state.data?.status === "running" ? 2000 : false;
    },
  });
}

export function useStartImport() {
  return useMutation({
    mutationFn: async (payload: {
      connectionId: string;
      startDate: string;
      endDate: string;
      forceUpdate?: boolean;
      idSituacao?: number;
    }) => {
      const { connectionId, ...body } = payload;
      const response = await apiRequest(
        "POST",
        `/api/bling-accounts/${connectionId}/import-orders`,
        body,
      );
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [
          "/api/bling-accounts",
          variables.connectionId,
          "import-status",
        ],
      });
    },
  });
}

export function useCancelImport() {
  return useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await apiRequest(
        "POST",
        `/api/bling-accounts/${connectionId}/import-cancel`,
      );
      return response.json();
    },
    onSuccess: (_data, connectionId) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/bling-accounts", connectionId, "import-status"],
      });
    },
  });
}
