import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

// Types based on the API responses
export interface BlingOrder {
  id: number;
  blingOrderId: string;
  orderNumber: string;
  saleDate: string;
  totalValue: string;
  situationId: string;
  situationName?: string;
  storeId?: string;
  contactId?: string;
  contactName?: string;
  sellerId?: string;
  sellerName?: string;
  paymentMethod?: string;
  logisticService?: string;
  items?: BlingOrderItem[];
  installments?: BlingOrderInstallment[];
}

export interface BlingOrderItem {
  id: number;
  orderId: number;
  productId?: string;
  productCode?: string;
  description: string;
  quantity: string;
  value: string; // unit price
}

export interface BlingOrderInstallment {
  id: number;
  orderId: number;
  dueDate: string;
  value: string;
  obs?: string;
}

export interface SalesStatistics {
  totalOrders: number;
  totalValue: number;
  averageValue: number;
}

export interface TopSeller {
  sellerId: string;
  sellerName: string;
  totalOrders: number;
  totalValue: string;
}

export interface TopProduct {
  productId?: string;
  productCode?: string;
  description: string;
  totalQuantity: string;
  totalValue: string;
  orderCount: number;
}

interface OrderFilters {
  accountId?: string;
  userId?: string;
  contactId?: string;
  contactName?: string;
  sellerId?: string;
  storeId?: string;
  situationId?: string;
  startDate?: string;
  endDate?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

// Types for filter options
export interface SellerOption {
  sellerId: string | null;
  sellerName: string | null;
  orderCount: number;
}

export interface StoreOption {
  storeId: string;
  orderCount: number;
}

export interface SituationOption {
  situationId: string | null;
  situationValue: string | null;
  orderCount: number;
}

// Fetch functions
async function fetchOrders(filters: OrderFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.append(key, String(value));
    }
  });

  const response = await fetch(`/api/bling-orders?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Falha ao buscar pedidos");
  }
  const result = await response.json();
  return result.data as BlingOrder[];
}

async function fetchSalesStatistics(
  startDate: string,
  endDate: string,
  accountId?: string
) {
  const params = new URLSearchParams({ startDate, endDate });
  if (accountId) params.append("accountId", accountId);

  const response = await fetch(
    `/api/bling-orders/statistics/sales?${params.toString()}`
  );
  if (!response.ok) {
    throw new Error("Falha ao buscar estatísticas de vendas");
  }
  const result = await response.json();
  return result.data as SalesStatistics;
}

async function fetchTopSellers(
  startDate: string,
  endDate: string,
  limit?: number
) {
  const params = new URLSearchParams({ startDate, endDate });
  if (limit) params.append("limit", String(limit));

  const response = await fetch(
    `/api/bling-orders/statistics/top-sellers?${params.toString()}`
  );
  if (!response.ok) {
    throw new Error("Falha ao buscar top vendedores");
  }
  const result = await response.json();
  return result.data as TopSeller[];
}

async function fetchTopProducts(
  startDate: string,
  endDate: string,
  limit?: number
) {
  const params = new URLSearchParams({ startDate, endDate });
  if (limit) params.append("limit", String(limit));

  const response = await fetch(
    `/api/bling-orders/statistics/top-products?${params.toString()}`
  );
  if (!response.ok) {
    throw new Error("Falha ao buscar top produtos");
  }
  const result = await response.json();
  return result.data as TopProduct[];
}

async function fetchOrderById(blingOrderId: string) {
  const response = await fetch(`/api/bling-orders/${blingOrderId}`);
  if (!response.ok) {
    throw new Error("Falha ao buscar detalhes do pedido");
  }
  const result = await response.json();
  return result.data as BlingOrder;
}

// Hooks
export function useBlingOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: ["bling-orders", filters],
    queryFn: () => fetchOrders(filters),
    placeholderData: (previousData) => previousData, // Keep previous data while fetching new
  });
}

export function useSalesStatistics(
  startDate: string,
  endDate: string,
  accountId?: string
) {
  return useQuery({
    queryKey: ["bling-sales-stats", startDate, endDate, accountId],
    queryFn: () => fetchSalesStatistics(startDate, endDate, accountId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useTopSellers(
  startDate: string,
  endDate: string,
  limit?: number
) {
  return useQuery({
    queryKey: ["bling-top-sellers", startDate, endDate, limit],
    queryFn: () => fetchTopSellers(startDate, endDate, limit),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useTopProducts(
  startDate: string,
  endDate: string,
  limit?: number
) {
  return useQuery({
    queryKey: ["bling-top-products", startDate, endDate, limit],
    queryFn: () => fetchTopProducts(startDate, endDate, limit),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useBlingOrderById(blingOrderId: string | null) {
  return useQuery({
    queryKey: ["bling-order", blingOrderId],
    queryFn: () => fetchOrderById(blingOrderId!),
    enabled: !!blingOrderId,
  });
}

// Hooks for filter options
export function useAvailableSellers() {
  return useQuery({
    queryKey: ["bling-sellers"],
    queryFn: async () => {
      const response = await fetch("/api/bling-orders/filters/sellers");
      if (!response.ok) throw new Error("Falha ao buscar vendedores");
      const result = await response.json();
      return result.data as SellerOption[];
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

export function useAvailableStores() {
  return useQuery({
    queryKey: ["bling-stores"],
    queryFn: async () => {
      const response = await fetch("/api/bling-orders/filters/stores");
      if (!response.ok) throw new Error("Falha ao buscar lojas");
      const result = await response.json();
      return result.data as StoreOption[];
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

export function useAvailableSituations() {
  return useQuery({
    queryKey: ["bling-situations"],
    queryFn: async () => {
      const response = await fetch("/api/bling-orders/filters/situations");
      if (!response.ok) throw new Error("Falha ao buscar situações");
      const result = await response.json();
      return result.data as SituationOption[];
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}
