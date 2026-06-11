import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

export type ExportStatus =
  | "idle"
  | "running"
  | "completed"
  | "cancelled"
  | "failed";

export type RecentExportItemStatus = "created" | "updated" | "failed";

export interface RecentExportItem {
  clientId: string;
  clientName: string;
  status: RecentExportItemStatus;
  vendorName: string | null;
  errorMessage?: string;
}

export interface ExportProgress {
  status: ExportStatus;
  connectionId: string;
  startedAt: string | null;
  finishedAt: string | null;
  params: { includeBlingSourced?: boolean; responsavelId?: string } | null;
  currentPage: number;
  totalFetched: number;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  vendorLinksCreated: number;
  currentClient: string | null;
  recentItems: RecentExportItem[];
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
      responsavelId?: string;
    }) => {
      const response = await apiRequest(
        "POST",
        `/api/bling-accounts/${payload.connectionId}/export-clients`,
        {
          includeBlingSourced: payload.includeBlingSourced,
          responsavelId: payload.responsavelId,
        },
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
