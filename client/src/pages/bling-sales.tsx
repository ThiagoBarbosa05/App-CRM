import { useState, useMemo } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import {
  useBlingOrders,
  useSalesComparison,
  useTopProducts,
  useTopSellers,
  useBlingOrdersForExport,
  useSalesEvolution,
} from "@/hooks/use-bling-orders";
import { useDebounce } from "@/hooks/use-debounce";
import { exportBlingOrdersToExcel } from "@/lib/excel-export";
import { useToast } from "@/hooks/use-toast";

// Components
import { BlingSalesHeader } from "@/components/bling-sales/bling-sales-header";
import { SalesStatisticsCards } from "@/components/bling-sales/sales-statistics-cards";
import { SalesEvolutionChart } from "@/components/bling-sales/sales-evolution-chart";
import { TopSellersChart } from "@/components/bling-sales/top-sellers-chart";
import { TopProductsChart } from "@/components/bling-sales/top-products-chart";
import { OrdersFilters } from "@/components/bling-sales/orders-filters";
import { OrdersTable } from "@/components/bling-sales/orders-table";

export default function BlingSalesPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [isExporting, setIsExporting] = useState(false);

  // Default to last 90 days
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 90)),
    to: new Date(),
  });

  // Advanced filters
  const [contactName, setContactName] = useState("");
  const debouncedContactName = useDebounce(contactName, 500);
  const [sellerId, setSellerId] = useState<string | undefined>();
  const [storeId, setStoreId] = useState<string | undefined>();
  const [situationId, setSituationId] = useState<string | undefined>();
  const [minValue, setMinValue] = useState<number | undefined>();
  const [maxValue, setMaxValue] = useState<number | undefined>();
  const [paymentMethodId, setPaymentMethodId] = useState<string | undefined>();

  const formattedStartDate = useMemo(() => 
    dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : "", 
  [dateRange?.from]);

  const formattedEndDate = useMemo(() => 
    dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : formattedStartDate,
  [dateRange?.to, formattedStartDate]);

  const groupBy = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return 'day';
    const days = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
    if (days > 90) return 'month';
    if (days > 30) return 'week';
    return 'day';
  }, [dateRange]);

  // Queries
  const { data: salesComparison, isLoading: isStatsLoading } = useSalesComparison(formattedStartDate, formattedEndDate);
  const { data: salesEvolution, isLoading: isEvolutionLoading } = useSalesEvolution(formattedStartDate, formattedEndDate, groupBy);
  const { data: topSellers, isLoading: isTopSellersLoading } = useTopSellers(formattedStartDate, formattedEndDate, 5);
  const { data: topProducts, isLoading: isTopProductsLoading } = useTopProducts(formattedStartDate, formattedEndDate, 5);

  const { data: ordersResponse, isLoading: isOrdersLoading } = useBlingOrders({
    startDate: formattedStartDate,
    endDate: formattedEndDate,
    contactName: debouncedContactName || undefined,
    sellerId,
    storeId,
    situationId,
    minValue,
    maxValue,
    paymentMethodId,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const orders = ordersResponse?.data || [];
  const pagination = ordersResponse?.pagination;
  const hasMore = pagination?.hasMore || false;
  const totalOrders = pagination?.total || 0;

  const handleFilterChange = () => setPage(1);

  // Export Hook
  const { refetch: refetchExport, isFetching: isFetchingExport } = useBlingOrdersForExport({
    startDate: formattedStartDate,
    endDate: formattedEndDate,
    contactName: debouncedContactName || undefined,
    sellerId,
    storeId,
    situationId,
    minValue,
    maxValue,
    paymentMethodId,
  }, false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const result = await refetchExport();
      if (!result.data || result.data.length === 0) {
        toast({ title: "Nenhum dado", description: "Não há pedidos com os filtros selecionados.", variant: "destructive" });
        return;
      }
      exportBlingOrdersToExcel(result.data);
      toast({ title: "Sucesso!", description: `${result.data.length} pedido(s) exportado(s).` });
    } catch {
      toast({ title: "Erro na exportação", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="max-w-full overflow-x-hidden space-y-8 pb-10">
      <BlingSalesHeader 
        onExport={handleExport} 
        isExporting={isExporting || isFetchingExport}
        disabled={!formattedStartDate || !formattedEndDate}
      />

      <OrdersFilters
        dateRange={dateRange}
        onDateRangeChange={(range) => { setDateRange(range); handleFilterChange(); }}
        contactName={contactName}
        onContactNameChange={(name) => { setContactName(name); handleFilterChange(); }}
        sellerId={sellerId}
        onSellerIdChange={(id) => { setSellerId(id); handleFilterChange(); }}
        storeId={storeId}
        onStoreIdChange={(id) => { setStoreId(id); handleFilterChange(); }}
        situationId={situationId}
        onSituationIdChange={(id) => { setSituationId(id); handleFilterChange(); }}
        minValue={minValue}
        onMinValueChange={(val) => { setMinValue(val); handleFilterChange(); }}
        maxValue={maxValue}
        onMaxValueChange={(val) => { setMaxValue(val); handleFilterChange(); }}
        paymentMethodId={paymentMethodId}
        onPaymentMethodIdChange={(id) => { setPaymentMethodId(id); handleFilterChange(); }}
        isLoading={isOrdersLoading}
      />

      <SalesStatisticsCards
        totalOrders={salesComparison?.current.totalOrders}
        totalValue={salesComparison?.current.totalValue}
        averageValue={salesComparison?.current.averageValue}
        ordersChange={salesComparison?.changes.ordersChange}
        valueChange={salesComparison?.changes.valueChange}
        averageChange={salesComparison?.changes.averageChange}
        isLoading={isStatsLoading}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <SalesEvolutionChart
            data={salesEvolution}
            isLoading={isEvolutionLoading}
            groupBy={groupBy}
          />
        </div>
        <div className="space-y-8">
          <TopSellersChart data={topSellers} isLoading={isTopSellersLoading} />
          <TopProductsChart data={topProducts} isLoading={isTopProductsLoading} />
        </div>
      </div>

      <OrdersTable
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
