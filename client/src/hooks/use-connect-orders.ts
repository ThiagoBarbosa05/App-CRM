import { useQuery } from "@tanstack/react-query";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ConnectOrder {
  id: number;
  saleDate: string;
  totalValue: string;
  contactName: string | null;
  contactCpf: string | null;
  contactPhone: string | null;
  contactCellphone: string | null;
  contactCity: string | null;
  sellerNameRaw: string | null;
  sellerId: string | null;
  appClientId: string | null;
  appClientStatus: "found" | "created" | "not_found" | null;
  sourceFile: string | null;
  importedAt: string;
}

export interface ConnectSalesStatistics {
  totalOrders: number;
  totalValue: number;
  averageValue: number;
}

export interface ConnectTopSeller {
  sellerId: string | null;
  sellerName: string;
  totalOrders: number;
  totalValue: number;
}

export interface ConnectSalesEvolutionPoint {
  period: string;
  totalOrders: number;
  totalValue: number;
}

// ─── Filtros da listagem ──────────────────────────────────────────────────────

export interface ConnectOrdersFilters {
  startDate?: string;
  endDate?: string;
  sellerId?: string;
  contactName?: string;
  limit?: number;
  offset?: number;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function buildParams(obj: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

export function useConnectOrders(filters: ConnectOrdersFilters) {
  const qs = buildParams(filters as Record<string, string | number | undefined>);
  return useQuery<{ data: ConnectOrder[]; pagination: { total: number; hasMore: boolean } }>({
    queryKey: ["/api/connect-orders", filters],
    queryFn: async () => {
      const res = await fetch(`/api/connect-orders?${qs}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json;
    },
    enabled: !!filters.startDate && !!filters.endDate,
  });
}

export function useConnectSalesStatistics(startDate: string, endDate: string) {
  return useQuery<ConnectSalesStatistics>({
    queryKey: ["/api/connect-orders/statistics/sales", startDate, endDate],
    queryFn: async () => {
      const res = await fetch(
        `/api/connect-orders/statistics/sales?startDate=${startDate}&endDate=${endDate}`,
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as ConnectSalesStatistics;
    },
    enabled: !!startDate && !!endDate,
  });
}

export function useConnectTopSellers(
  startDate: string,
  endDate: string,
  limit = 5,
) {
  return useQuery<ConnectTopSeller[]>({
    queryKey: ["/api/connect-orders/statistics/top-sellers", startDate, endDate, limit],
    queryFn: async () => {
      const res = await fetch(
        `/api/connect-orders/statistics/top-sellers?startDate=${startDate}&endDate=${endDate}&limit=${limit}`,
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as ConnectTopSeller[];
    },
    enabled: !!startDate && !!endDate,
  });
}

export function useConnectSalesEvolution(
  startDate: string,
  endDate: string,
  groupBy: "day" | "week" | "month" = "day",
) {
  return useQuery<ConnectSalesEvolutionPoint[]>({
    queryKey: ["/api/connect-orders/statistics/sales-evolution", startDate, endDate, groupBy],
    queryFn: async () => {
      const res = await fetch(
        `/api/connect-orders/statistics/sales-evolution?startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}`,
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as ConnectSalesEvolutionPoint[];
    },
    enabled: !!startDate && !!endDate,
  });
}
