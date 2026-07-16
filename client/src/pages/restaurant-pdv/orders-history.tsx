import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import type { RestaurantOrder } from "@shared/schema";
import { OrdersHistoryStats } from "@/components/restaurant-pdv/orders-history-stats";
import {
  OrdersHistoryFilters,
  EMPTY_FILTERS,
  type OrdersHistoryFiltersValue,
} from "@/components/restaurant-pdv/orders-history-filters";
import { OrdersHistoryTable } from "@/components/restaurant-pdv/orders-history-table";

interface RestaurantOrderWithPaymentsCount extends RestaurantOrder {
  paymentsCount: number;
}

export default function RestaurantOrdersHistory() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<OrdersHistoryFiltersValue>(EMPTY_FILTERS);

  const { data: orders = [] } = useQuery<RestaurantOrderWithPaymentsCount[]>({
    queryKey: ["/api/restaurant-pdv/orders", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status !== "todas") params.append("status", filters.status);
      if (filters.from) params.append("from", filters.from);
      if (filters.to) params.append("to", filters.to);
      const res = await fetch(`/api/restaurant-pdv/orders?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Erro ao buscar histórico de comandas");
      return res.json();
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon
            icon={ClipboardList}
            color="text-orange-600 dark:text-orange-400"
            bgColor="bg-orange-50 dark:bg-orange-900/30"
          />
          <PageHeader.Text>
            <PageHeader.Title>Histórico de Comandas</PageHeader.Title>
            <PageHeader.Description>
              Acompanhe comandas abertas e fechadas do PDV Restaurante
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
      </PageHeader>

      <OrdersHistoryStats orders={orders} />
      <OrdersHistoryFilters value={filters} onChange={setFilters} />
      <OrdersHistoryTable
        orders={orders}
        onContinueOrder={(orderId) => setLocation(`/pdv-restaurante?orderId=${orderId}`)}
      />
    </div>
  );
}
