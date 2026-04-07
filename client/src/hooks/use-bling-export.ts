import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export type ExportStatus =
  | "idle"
  | "running"
  | "completed"
  | "cancelled"
  | "failed";

export interface ExportProgress {
  status: ExportStatus;
  connectionId: string;
  startedAt: string | null;
  finishedAt: string | null;
  params: { includeBlingSourced?: boolean } | null;
  currentPage: number;
  totalFetched: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ clientId: string; clientName: string; error: string }>;
  cancelRequested: boolean;
}

interface ExportStatusResponse {
  success: boolean;
  data: ExportProgress;
}

export function useExportStatus(connectionId: string | null) {
  return useQuery<ExportProgress>({
    queryKey: ["/api/bling-accounts", connectionId, "export-status"],
    enabled: !!connectionId,
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/api/bling-accounts/${connectionId}/export-status`,
      );
      const body = (await response.json()) as ExportStatusResponse;
      return body.data;
    },
    refetchInterval: (query) => {
      return query.state.data?.status === "running" ? 2000 : false;
    },
  });
}

export function useStartExport() {
  return useMutation({
    mutationFn: async (payload: {
      connectionId: string;
      includeBlingSourced?: boolean;
    }) => {
      const response = await apiRequest(
        "POST",
        `/api/bling-accounts/${payload.connectionId}/export-clients`,
        { includeBlingSourced: payload.includeBlingSourced },
      );
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: [
          "/api/bling-accounts",
          variables.connectionId,
          "export-status",
        ],
      });
    },
  });
}

export function useCancelExport() {
  return useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await apiRequest(
        "POST",
        `/api/bling-accounts/${connectionId}/export-cancel`,
      );
      return response.json();
    },
    onSuccess: (_data, connectionId) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/bling-accounts", connectionId, "export-status"],
      });
    },
  });
}
