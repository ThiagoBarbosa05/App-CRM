import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

// Types based on the API responses
export interface BlingOrder {
  id: number;
  blingOrderId: string;
  orderNumber: string;
  storeOrderNumber?: string;
  saleDate: string;
  departureDate?: string;
  expectedDeliveryDate?: string;
  totalValue: string;
  situationId: string;
  situationName?: string;
  situationValue?: string;
  storeId?: string;
  contactId?: string;
  contactName?: string;
  contactType?: string;
  contactDocument?: string;
  sellerId?: string;
  sellerName?: string;
  observations?: string;
  internalObservations?: string;
  paymentMethod?: string;
  logisticService?: string;
  // Campos de integração com app (PF via Pub/Sub)
  appClientId?: string | null;
  contactPhone?: string | null;
  contactCellphone?: string | null;
  // Cashback gerado (enriquecido pelo controller)
  cashbackAmount?: string | null;
  cashbackRate?: string | null;
  // Último evento Pub/Sub recebido
  lastEventAction?: string | null;
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
  discount?: string;
}

export interface BlingOrderInstallment {
  id: number;
  orderId: number;
  dueDate: string;
  value: string;
  observations?: string;
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
  contactType?: string;
  sellerId?: string;
  storeId?: string;
  situationId?: string;
  startDate?: string;
  endDate?: string;
  minValue?: number;
  maxValue?: number;
  paymentMethodId?: string;
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

export interface PaymentMethodOption {
  paymentMethodId: string | null;
  paymentMethodName: string | null;
  orderCount: number;
}

export interface SalesEvolutionPoint {
  date: string;
  totalOrders: number;
  totalValue: number;
}

export interface SalesComparison {
  current: SalesStatistics;
  previous: SalesStatistics;
  changes: {
    ordersChange: number;
    valueChange: number;
    averageChange: number;
  };
}

export interface CashbackStatistics {
  totalPFOrders: number;
  linkedOrders: number;
  unlinkedOrders: number;
  totalCashbackGenerated: number;
  cashbackTransactionCount: number;
}

export interface OrderCashbackTransaction {
  id: string;
  clientId: string;
  cashbackAmount: string;
  cashbackRate: string;
  purchaseAmount: string;
  status: string;
  invoiceNumber: string | null;
  saleDate: string | null;
  expiresAt: string;
  notes: string | null;
  createdAt: string;
}

// Fetch functions
interface OrdersResponse {
  data: BlingOrder[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

async function fetchOrders(filters: OrderFilters): Promise<OrdersResponse> {
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
  return {
    data: result.data as BlingOrder[],
    pagination: result.pagination,
  };
}

async function fetchSalesStatistics(
  startDate: string,
  endDate: string,
  accountId?: string,
  contactType?: string,
) {
  const params = new URLSearchParams({ startDate, endDate });
  if (accountId) params.append("accountId", accountId);
  if (contactType) params.append("contactType", contactType);

  const response = await fetch(
    `/api/bling-orders/statistics/sales?${params.toString()}`,
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
  limit?: number,
  contactType?: string,
) {
  const params = new URLSearchParams({ startDate, endDate });
  if (limit) params.append("limit", String(limit));
  if (contactType) params.append("contactType", contactType);

  const response = await fetch(
    `/api/bling-orders/statistics/top-sellers?${params.toString()}`,
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
  limit?: number,
  contactType?: string,
) {
  const params = new URLSearchParams({ startDate, endDate });
  if (limit) params.append("limit", String(limit));
  if (contactType) params.append("contactType", contactType);

  const response = await fetch(
    `/api/bling-orders/statistics/top-products?${params.toString()}`,
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
    enabled: !!filters.startDate && !!filters.endDate, // Only fetch if dates are provided
  });
}

/**
 * Hook para buscar TODOS os pedidos de uma vez (para exportação)
 * Usa endpoint dedicado que retorna pedidos com itens e parcelas
 */
export function useBlingOrdersForExport(
  filters: Omit<OrderFilters, "limit" | "offset">,
  enabled: boolean = false,
) {
  return useQuery({
    queryKey: ["bling-orders-export", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.append(key, String(value));
        }
      });
      // Buscar sem limite de paginação
      params.append("limit", "10000"); // Limite alto para pegar todos
      params.append("offset", "0");

      const response = await fetch(
        `/api/bling-orders/export?${params.toString()}`,
      );
      if (!response.ok) {
        throw new Error("Falha ao buscar pedidos para exportação");
      }
      const result = await response.json();
      return result.data as BlingOrder[];
    },
    enabled: enabled && !!filters.startDate && !!filters.endDate,
    staleTime: 0, // Não cachear (dados podem mudar)
  });
}

export function useSalesStatistics(
  startDate: string,
  endDate: string,
  accountId?: string,
  contactType?: string,
) {
  return useQuery({
    queryKey: ["bling-sales-stats", startDate, endDate, accountId, contactType],
    queryFn: () =>
      fetchSalesStatistics(startDate, endDate, accountId, contactType),
    enabled: !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });
}

export function useTopSellers(
  startDate: string,
  endDate: string,
  limit?: number,
  contactType?: string,
) {
  return useQuery({
    queryKey: ["bling-top-sellers", startDate, endDate, limit, contactType],
    queryFn: () => fetchTopSellers(startDate, endDate, limit, contactType),
    enabled: !!startDate && !!endDate,
    staleTime: 10 * 60 * 1000,
  });
}

export function useTopProducts(
  startDate: string,
  endDate: string,
  limit?: number,
  contactType?: string,
) {
  return useQuery({
    queryKey: ["bling-top-products", startDate, endDate, limit, contactType],
    queryFn: () => fetchTopProducts(startDate, endDate, limit, contactType),
    enabled: !!startDate && !!endDate,
    staleTime: 10 * 60 * 1000,
  });
}

export interface TopClient {
  rank: number;
  contactId: string;
  contactName: string;
  appClientId?: string | null;
  totalOrders: number;
  totalValue: number;
  avgValue: number;
  firstOrder: string;
  lastOrder: string;
}

export function useTopClients(
  startDate: string,
  endDate: string,
  limit = 20,
  contactType?: string,
) {
  return useQuery({
    queryKey: ["bling-top-clients", startDate, endDate, limit, contactType],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate, limit: String(limit) });
      if (contactType) params.set("contactType", contactType);
      const res = await fetch(`/api/bling-orders/statistics/top-clients?${params.toString()}`);
      if (!res.ok) throw new Error("Falha ao buscar top clientes");
      const json = await res.json();
      return json.data as TopClient[];
    },
    enabled: !!startDate && !!endDate,
    staleTime: 10 * 60 * 1000,
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

export function useAvailablePaymentMethods() {
  return useQuery({
    queryKey: ["bling-payment-methods"],
    queryFn: async () => {
      const response = await fetch("/api/bling-orders/filters/payment-methods");
      if (!response.ok) throw new Error("Falha ao buscar formas de pagamento");
      const result = await response.json();
      return result.data as PaymentMethodOption[];
    },
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

// Hook for sales evolution (temporal chart data)
export function useSalesEvolution(
  startDate: string,
  endDate: string,
  groupBy: "day" | "week" | "month" = "day",
  accountId?: string,
  contactType?: string,
) {
  return useQuery({
    queryKey: [
      "bling-sales-evolution",
      startDate,
      endDate,
      groupBy,
      accountId,
      contactType,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate, groupBy });
      if (accountId) params.append("accountId", accountId);
      if (contactType) params.append("contactType", contactType);

      const response = await fetch(
        `/api/bling-orders/statistics/sales-evolution?${params.toString()}`,
      );
      if (!response.ok) throw new Error("Falha ao buscar evolução de vendas");
      const result = await response.json();
      return result.data as SalesEvolutionPoint[];
    },
    enabled: !!startDate && !!endDate,
    staleTime: 10 * 60 * 1000,
  });
}

export interface CashbackStatistics {
  totalPFOrders: number;
  linkedOrders: number;
  unlinkedOrders: number;
  totalCashbackGenerated: number;
  cashbackTransactionCount: number;
}

export interface OrderCashbackTransaction {
  id: string;
  clientId: string;
  cashbackAmount: string;
  cashbackRate: string;
  purchaseAmount: string;
  status: string;
  invoiceNumber: string | null;
  saleDate: string | null;
  expiresAt: string;
  notes: string | null;
  createdAt: string;
}

// Hook for sales comparison with previous period
export function useSalesComparison(
  startDate: string,
  endDate: string,
  accountId?: string,
  contactType?: string,
) {
  return useQuery({
    queryKey: [
      "bling-sales-comparison",
      startDate,
      endDate,
      accountId,
      contactType,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      if (accountId) params.append("accountId", accountId);
      if (contactType) params.append("contactType", contactType);

      const response = await fetch(
        `/api/bling-orders/statistics/sales-comparison?${params.toString()}`,
      );
      if (!response.ok) throw new Error("Falha ao buscar comparação de vendas");
      const result = await response.json();
      return result.data as SalesComparison;
    },
    enabled: !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCashbackStatistics(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["bling-cashback-stats", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const response = await fetch(
        `/api/bling-orders/statistics/cashback?${params.toString()}`,
      );
      if (!response.ok)
        throw new Error("Falha ao buscar estatísticas de cashback");
      const result = await response.json();
      return result.data as CashbackStatistics;
    },
    enabled: !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
  });
}

export interface CohortRetentionSlot {
  percentage: number | null;
  count: number | null;
}

export interface CohortData {
  cohorts: {
    cohortMonth: string;
    cohortSize: number;
    retention: CohortRetentionSlot[];
  }[];
  maxMonthOffset: number;
}

export interface CohortClient {
  contactId: string;
  contactName: string;
  retained: boolean;
}

export function useCohortAnalysis(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["bling-cohort-analysis", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate });
      const response = await fetch(
        `/api/bling-orders/statistics/cohort?${params.toString()}`,
      );
      if (!response.ok) throw new Error("Falha ao buscar análise de cohort");
      const result = await response.json();
      return result.data as CohortData;
    },
    enabled: !!startDate && !!endDate,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCohortClients(
  startDate: string,
  endDate: string,
  cohortMonth: string | null,
  monthOffset: number | null,
) {
  return useQuery({
    queryKey: ["bling-cohort-clients", startDate, endDate, cohortMonth, monthOffset],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate,
        endDate,
        cohortMonth: cohortMonth!,
        monthOffset: String(monthOffset),
      });
      const response = await fetch(
        `/api/bling-orders/statistics/cohort/clients?${params.toString()}`,
      );
      if (!response.ok) throw new Error("Falha ao buscar clientes do cohort");
      const result = await response.json();
      return result.data as CohortClient[];
    },
    enabled: !!startDate && !!endDate && cohortMonth !== null && monthOffset !== null,
    staleTime: 5 * 60 * 1000,
  });
}

export function useOrderCashback(blingOrderId: string | null) {
  return useQuery({
    queryKey: ["bling-order-cashback", blingOrderId],
    queryFn: async () => {
      const response = await fetch(
        `/api/bling-orders/${blingOrderId}/cashback`,
      );
      if (!response.ok) throw new Error("Falha ao buscar cashback do pedido");
      const result = await response.json();
      return result.data as OrderCashbackTransaction[];
    },
    enabled: !!blingOrderId,
  });
}
