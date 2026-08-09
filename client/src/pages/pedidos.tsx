import { Package } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  DateRangeFilter,
  useDateRangeFilter,
} from "@/components/date-range-filter";
import { OrdersSection } from "@/components/seller-dashboard/orders-section";

/**
 * Página de Pedidos (Bling + Connect) — restrita a administradores.
 * O acesso é barrado no `Router` (App.tsx) e, de fato, no backend:
 * `GET /api/unified-orders` e `/statistics/seller-totals` exigem `requireAdmin`.
 *
 * Não passa `lockedUserId`: o admin enxerga todos os vendedores e usa o
 * seletor de vendedor que já existe dentro de `OrdersFilters`.
 */
export default function PedidosPage() {
  const { startDate, endDate, dateFilterProps } = useDateRangeFilter();

  return (
    <div className="space-y-6 pb-10">
      <PageHeader>
        <PageHeader.Info>
          <PageHeader.Icon
            icon={Package}
            color="text-primary"
            bgColor="bg-accent"
          />
          <PageHeader.Text>
            <PageHeader.Title>Pedidos</PageHeader.Title>
            <PageHeader.Description>
              Pedidos Bling e Connect em uma visão única
            </PageHeader.Description>
          </PageHeader.Text>
        </PageHeader.Info>

        <PageHeader.Actions className="flex-wrap items-center gap-2 w-full md:w-auto">
          <DateRangeFilter {...dateFilterProps} />
        </PageHeader.Actions>
      </PageHeader>

      <OrdersSection startDate={startDate} endDate={endDate} />
    </div>
  );
}
