import { useQuery } from "@tanstack/react-query";

export type ClientPurchaseHistorySource = "all" | "bling" | "connect";

export interface ClientPurchaseInsightsResponse {
  linkStatus: "linked" | "unlinked" | "partial";
  summary: {
    totalPurchased: number;
    purchaseCount: number;
    averageTicket: number;
    monthlyFrequency: number;
    averageDaysBetweenPurchases: number | null;
    lastPurchaseDate: string | null;
    lastPurchaseValue: number | null;
    activeMonthsLast6: number;
    activeMonthsLast12: number;
  };
  predictiveAnalysis: {
    predictedNextPurchaseDate: string | null;
    daysSinceLastPurchase: number | null;
    daysLate: number | null;
    status:
      | "dentro_do_ciclo"
      | "atencao"
      | "reativacao"
      | "risco_de_queda"
      | "sem_base";
    explanation: string;
  };
  inactiveProducts: Array<{
    productId: string | null;
    productCode: string | null;
    description: string;
    orderCount: number;
    totalQuantity: number;
    totalValue: number;
    firstPurchaseDate: string | null;
    lastPurchaseDate: string | null;
    averageDaysBetweenPurchases: number | null;
    daysSinceLastPurchase: number | null;
    riskStatus: "ok" | "atencao" | "abandonado";
  }>;
  productMix: Array<{
    productId: string | null;
    productCode: string | null;
    description: string;
    orderCount: number;
    totalQuantity: number;
    totalValue: number;
    firstPurchaseDate: string | null;
    lastPurchaseDate: string | null;
  }>;
  purchaseHistory: {
    data: Array<{
      id: string;
      source: "bling" | "connect";
      saleDate: string;
      totalValue: number;
      contactName: string | null;
      sellerName: string | null;
      sellerId: string | null;
      appClientId: string | null;
      orderNumber: string | null;
      blingOrderId: string | null;
      situationValue: string | null;
      items: Array<{
        productId: string | null;
        productCode: string | null;
        description: string;
        quantity: number;
        unitValue: number;
      }>;
    }>;
    total: number;
    hasMore: boolean;
    limit: number;
    offset: number;
  };
}

export function useClientPurchaseInsights(
  clientId: string | undefined,
  params?: {
    historyLimit?: number;
    historyOffset?: number;
    historySource?: ClientPurchaseHistorySource;
  },
) {
  return useQuery<ClientPurchaseInsightsResponse>({
    queryKey: ["client-purchase-insights", clientId, params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.historyLimit) {
        searchParams.set("historyLimit", String(params.historyLimit));
      }
      if (params?.historyOffset) {
        searchParams.set("historyOffset", String(params.historyOffset));
      }
      if (params?.historySource) {
        searchParams.set("historySource", params.historySource);
      }

      const query = searchParams.toString();
      const response = await fetch(
        `/api/clients/${clientId}/purchase-insights${query ? `?${query}` : ""}`,
      );

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.message ?? "Falha ao buscar inteligência de compras");
      }

      return response.json();
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
  });
}
