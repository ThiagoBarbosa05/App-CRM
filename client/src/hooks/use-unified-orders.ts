import { useQuery } from "@tanstack/react-query";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrderSource = "bling" | "connect" | "all";

export interface UnifiedOrder {
  id: string;
  source: "bling" | "connect";
  saleDate: string;
  totalValue: string;
  contactName: string | null;
  sellerName: string | null;
  sellerId: string | null;
  appClientId: string | null;
  // bling-only
  orderNumber: string | null;
  blingOrderId: string | null;
  situationValue: string | null;
  contactType: string | null;
  // connect-only
  appClientStatus: "found" | "created" | "not_found" | null;
}

export interface UnifiedSalesStatistics {
  totalOrders: number;
  totalValue: number;
  averageValue: number;
}

export interface UnifiedSalesComparison {
  current: UnifiedSalesStatistics;
  previous: UnifiedSalesStatistics;
  changes: {
    ordersChange: number;
    valueChange: number;
    averageChange: number;
  };
}

export interface UnifiedSalesEvolutionPoint {
  period: string;
  totalOrders: number;
  totalValue: number;
}

export interface UnifiedTopSeller {
  sellerId: string;
  sellerName: string;
  totalOrders: number;
  totalValue: number;
}

export interface UnifiedOrdersFilters {
  startDate: string;
  endDate: string;
  contactName?: string;
  sellerId?: string;
  source?: OrderSource;
  limit?: number;
  offset?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildQs(obj: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useUnifiedOrders(filters: UnifiedOrdersFilters) {
  const qs = buildQs(
    filters as unknown as Record<string, string | number | undefined>,
  );
  return useQuery<{
    data: UnifiedOrder[];
    pagination: { total: number; hasMore: boolean };
  }>({
    queryKey: ["/api/unified-orders", filters],
    queryFn: async () => {
      const res = await fetch(`/api/unified-orders?${qs}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json;
    },
    enabled: !!filters.startDate && !!filters.endDate,
  });
}

export function useUnifiedSalesStatistics(
  startDate: string,
  endDate: string,
  source: OrderSource = "all",
) {
  return useQuery<UnifiedSalesStatistics>({
    queryKey: [
      "/api/unified-orders/statistics/sales",
      startDate,
      endDate,
      source,
    ],
    queryFn: async () => {
      const res = await fetch(
        `/api/unified-orders/statistics/sales?startDate=${startDate}&endDate=${endDate}&source=${source}`,
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as UnifiedSalesStatistics;
    },
    enabled: !!startDate && !!endDate,
  });
}

export function useUnifiedSalesComparison(
  startDate: string,
  endDate: string,
  source: OrderSource = "all",
) {
  return useQuery<UnifiedSalesComparison>({
    queryKey: [
      "/api/unified-orders/statistics/sales-comparison",
      startDate,
      endDate,
      source,
    ],
    queryFn: async () => {
      const res = await fetch(
        `/api/unified-orders/statistics/sales-comparison?startDate=${startDate}&endDate=${endDate}&source=${source}`,
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as UnifiedSalesComparison;
    },
    enabled: !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUnifiedSalesEvolution(
  startDate: string,
  endDate: string,
  groupBy: "day" | "week" | "month",
  source: OrderSource = "all",
) {
  return useQuery<UnifiedSalesEvolutionPoint[]>({
    queryKey: [
      "/api/unified-orders/statistics/sales-evolution",
      startDate,
      endDate,
      groupBy,
      source,
    ],
    queryFn: async () => {
      const res = await fetch(
        `/api/unified-orders/statistics/sales-evolution?startDate=${startDate}&endDate=${endDate}&groupBy=${groupBy}&source=${source}`,
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as UnifiedSalesEvolutionPoint[];
    },
    enabled: !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUnifiedTopSellers(
  startDate: string,
  endDate: string,
  limit = 5,
  source: OrderSource = "all",
) {
  return useQuery<UnifiedTopSeller[]>({
    queryKey: [
      "/api/unified-orders/statistics/top-sellers",
      startDate,
      endDate,
      limit,
      source,
    ],
    queryFn: async () => {
      const res = await fetch(
        `/api/unified-orders/statistics/top-sellers?startDate=${startDate}&endDate=${endDate}&limit=${limit}&source=${source}`,
      );
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as UnifiedTopSeller[];
    },
    enabled: !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });
}
