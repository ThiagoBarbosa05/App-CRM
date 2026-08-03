import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AlertCircle, AlertTriangle, ClipboardList, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { extractApiMessage } from "@/lib/api-error";
import { getPdvCurrentUnitId } from "@/lib/pdv-unit";
import type { RestaurantOrder } from "@shared/schema";
import {
  OrdersHistoryFilters,
  EMPTY_FILTERS,
  type OrdersHistoryFiltersValue,
} from "@/components/restaurant-pdv/orders-history-filters";
import { OrdersHistoryTable } from "@/components/restaurant-pdv/orders-history-table";

interface RestaurantOrderWithPaymentsCount extends RestaurantOrder {
  paymentsCount: number;
  waiterName: string | null;
}

export default function RestaurantOrdersHistory() {
  const [, setLocation] = useLocation();
  const [filters, setFilters] = useState<OrdersHistoryFiltersValue>(EMPTY_FILTERS);

  const unitId = getPdvCurrentUnitId();

  const {
    data: orders = [],
    isError,
    error,
    refetch,
  } = useQuery<RestaurantOrderWithPaymentsCount[]>({
    queryKey: ["/api/restaurant-pdv/orders", filters, unitId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status !== "todas") params.append("status", filters.status);
      if (filters.from) params.append("from", filters.from);
      if (filters.to) params.append("to", filters.to);
      // `apiRequest` e não `fetch` cru: é ele que injeta o header
      // X-PDV-Unit-Id, sem o qual esta rota devolve 400 e a tela mostrava
      // "nenhuma comanda encontrada" para sempre.
      const res = await apiRequest(
        "GET",
        `/api/restaurant-pdv/orders?${params.toString()}`,
      );
      return (await res.json()) as RestaurantOrderWithPaymentsCount[];
    },
  });

  // Contado sobre a lista já carregada — nenhum endpoint novo.
  const comProblema = orders.filter(
    (o) =>
      o.status === "fechada" &&
      (o.blingSyncStatus === "bloqueado" ||
        o.blingSyncStatus === "erro" ||
        o.blingCheckStatus === "divergente"),
  ).length;

  return (
    <div className="w-full space-y-6 p-4">
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
              Acompanhe comandas abertas, fechadas, canceladas e mescladas do PDV
              Restaurante
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>
      </PageHeader>

      {isError && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-destructive">
              Não foi possível carregar o histórico
            </p>
            <p className="text-sm text-muted-foreground">{extractApiMessage(error)}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {comProblema > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-900 dark:text-amber-100">
            <strong>{comProblema}</strong> comanda(s) fechada(s) com pendência no Bling —
            não enviadas ou com valor divergente. Clique no status na coluna{" "}
            <strong>Bling</strong> para ver o motivo e reenviar.
          </p>
        </div>
      )}

      <OrdersHistoryFilters value={filters} onChange={setFilters} />
      <OrdersHistoryTable
        orders={orders}
        onContinueOrder={(orderId) => setLocation(`/pdv-restaurante/comanda/${orderId}`)}
      />

      <Button onClick={() => setLocation("/pdv-restaurante")}>
        <Plus className="mr-1.5 h-4 w-4" />
        Nova Comanda
      </Button>
    </div>
  );
}
