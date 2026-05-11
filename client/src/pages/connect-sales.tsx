import { useState, useMemo } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import {
  useConnectOrders,
  useConnectSalesStatistics,
  useConnectTopSellers,
  useConnectSalesEvolution,
} from "@/hooks/use-connect-orders";
import { useDebounce } from "@/hooks/use-debounce";
import { ConnectSalesHeader } from "@/components/connect-sales/connect-sales-header";
import { ConnectCsvImportModal } from "@/components/connect-sales/connect-csv-import-modal";
import { ConnectOrdersTable } from "@/components/connect-sales/connect-orders-table";
import { SalesStatisticsCards } from "@/components/bling-sales/sales-statistics-cards";
import { TopSellersChart } from "@/components/bling-sales/top-sellers-chart";
import { SalesEvolutionChart } from "@/components/bling-sales/sales-evolution-chart";
import { OrdersFilters } from "@/components/bling-sales/orders-filters";

export default function ConnectSalesPage() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Filtros de data — padrão últimos 90 dias
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 90)),
    to: new Date(),
  });

  const [contactName, setContactName] = useState("");
  const debouncedContactName = useDebounce(contactName, 500);
  const [sellerId, setSellerId] = useState<string | undefined>();
  // Connect não tem filtros de loja/situação/pagamento — mantidos para compatibilidade
  const [storeId] = useState<string | undefined>();
  const [situationId] = useState<string | undefined>();
  const [minValue] = useState<number | undefined>();
  const [maxValue] = useState<number | undefined>();
  const [paymentMethodId] = useState<string | undefined>();

  const formattedStartDate = useMemo(
    () => (dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : ""),
    [dateRange?.from],
  );

  const formattedEndDate = useMemo(
    () =>
      dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : formattedStartDate,
    [dateRange?.to, formattedStartDate],
  );

  const groupBy = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return "day" as const;
    const days = Math.ceil(
      (dateRange.to.getTime() - dateRange.from.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (days > 90) return "month" as const;
    if (days > 30) return "week" as const;
    return "day" as const;
  }, [dateRange]);

  const handleFilterChange = () => setPage(1);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: stats, isLoading: isStatsLoading } = useConnectSalesStatistics(
    formattedStartDate,
    formattedEndDate,
  );

  const { data: topSellers = [], isLoading: isTopSellersLoading } =
    useConnectTopSellers(formattedStartDate, formattedEndDate, 5);

  const { data: evolution = [], isLoading: isEvolutionLoading } =
    useConnectSalesEvolution(formattedStartDate, formattedEndDate, groupBy);

  const { data: ordersResponse, isLoading: isOrdersLoading } = useConnectOrders({
    startDate: formattedStartDate,
    endDate: formattedEndDate,
    sellerId,
    contactName: debouncedContactName || undefined,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const orders = ordersResponse?.data ?? [];
  const pagination = ordersResponse?.pagination;
  const hasMore = pagination?.hasMore ?? false;
  const totalOrders = pagination?.total ?? 0;

  // Adaptar topSellers para o formato esperado pelo TopSellersChart
  const topSellersForChart = topSellers.map((s) => ({
    sellerId: s.sellerId ?? "",
    sellerName: s.sellerName,
    totalOrders: s.totalOrders,
    totalValue: String(s.totalValue),
  }));

  // Adaptar evolution para o formato do SalesEvolutionChart (campo "date")
  const evolutionForChart = evolution.map((e) => ({
    date: String(e.period),
    totalOrders: e.totalOrders,
    totalValue: e.totalValue,
  }));

  return (
    <div className="space-y-6 pb-10">
      <ConnectSalesHeader onImport={() => setImportModalOpen(true)} />

      <ConnectCsvImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onSuccess={() => {
          // Invalidação de cache ficará automática via React Query
        }}
      />

      {/* Filtros */}
      <OrdersFilters
        dateRange={dateRange}
        onDateRangeChange={(range) => {
          setDateRange(range);
          handleFilterChange();
        }}
        contactName={contactName}
        onContactNameChange={(name) => {
          setContactName(name);
          handleFilterChange();
        }}
        sellerId={sellerId}
        onSellerIdChange={(id) => {
          setSellerId(id);
          handleFilterChange();
        }}
        storeId={storeId}
        onStoreIdChange={() => {}}
        situationId={situationId}
        onSituationIdChange={() => {}}
        minValue={minValue}
        onMinValueChange={() => {}}
        maxValue={maxValue}
        onMaxValueChange={() => {}}
        paymentMethodId={paymentMethodId}
        onPaymentMethodIdChange={() => {}}
        isLoading={isOrdersLoading}
      />

      <SalesStatisticsCards
        totalOrders={stats?.totalOrders}
        totalValue={stats?.totalValue}
        averageValue={stats?.averageValue}
        isLoading={isStatsLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <SalesEvolutionChart
            data={evolutionForChart}
            isLoading={isEvolutionLoading}
            groupBy={groupBy}
          />
        </div>
        <div>
          <TopSellersChart
            data={topSellersForChart}
            isLoading={isTopSellersLoading}
          />
        </div>
      </div>

      <ConnectOrdersTable
        orders={orders}
        isLoading={isOrdersLoading}
        page={page}
        onPageChange={setPage}
        hasMore={hasMore}
        totalOrders={totalOrders}
      />
    </div>
  );
}
