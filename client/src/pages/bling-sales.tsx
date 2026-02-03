import { useState } from "react";
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
import { SalesStatisticsCards } from "@/components/bling-sales/sales-statistics-cards";
import { SalesEvolutionChart } from "@/components/bling-sales/sales-evolution-chart";
import { TopSellersChart } from "@/components/bling-sales/top-sellers-chart";
import { TopProductsChart } from "@/components/bling-sales/top-products-chart";
import { OrdersFilters } from "@/components/bling-sales/orders-filters";
import { OrdersTable } from "@/components/bling-sales/orders-table";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function BlingSalesPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [isExporting, setIsExporting] = useState(false);

  // Default to last 90 days to show data by default
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 90)),
    to: new Date(),
  });

  // Advanced filters
  const [contactName, setContactName] = useState("");
  const debouncedContactName = useDebounce(contactName, 500); // Debounce search
  const [sellerId, setSellerId] = useState<string | undefined>();
  const [storeId, setStoreId] = useState<string | undefined>();
  const [situationId, setSituationId] = useState<string | undefined>();
  const [minValue, setMinValue] = useState<number | undefined>();
  const [maxValue, setMaxValue] = useState<number | undefined>();
  const [paymentMethodId, setPaymentMethodId] = useState<string | undefined>();

  const formattedStartDate = dateRange?.from
    ? format(dateRange.from, "yyyy-MM-dd")
    : "";
  const formattedEndDate = dateRange?.to
    ? format(dateRange.to, "yyyy-MM-dd")
    : formattedStartDate; // Fallback to start date if end date is missing

  // Calculate the appropriate groupBy based on date range
  const calculateGroupBy = (): 'day' | 'week' | 'month' => {
    if (!dateRange?.from || !dateRange?.to) return 'day';
    const days = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
    if (days > 90) return 'month';
    if (days > 30) return 'week';
    return 'day';
  };

  // Fetch Sales Comparison (includes current and previous period stats)
  const { data: salesComparison, isLoading: isStatsLoading } = useSalesComparison(
    formattedStartDate,
    formattedEndDate
  );

  // Fetch Sales Evolution for chart
  const { data: salesEvolution, isLoading: isEvolutionLoading } = useSalesEvolution(
    formattedStartDate,
    formattedEndDate,
    calculateGroupBy()
  );

  // Fetch Top Sellers
  const { data: topSellers, isLoading: isTopSellersLoading } = useTopSellers(
    formattedStartDate,
    formattedEndDate,
    5
  );

  // Fetch Top Products
  const { data: topProducts, isLoading: isTopProductsLoading } = useTopProducts(
    formattedStartDate,
    formattedEndDate,
    5
  );

  // Fetch Orders with all filters
  const { data: ordersResponse, isLoading: isOrdersLoading } = useBlingOrders({
    startDate: formattedStartDate,
    endDate: formattedEndDate,
    contactName: debouncedContactName || undefined, // Use debounced value
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

  // Reset page when filters change
  const handleFilterChange = () => {
    setPage(1);
  };

  // Hook para exportação (só busca quando necessário)
  const {
    data: exportData,
    refetch: refetchExport,
    isFetching: isFetchingExport,
  } = useBlingOrdersForExport(
    {
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      contactName: debouncedContactName || undefined,
      sellerId,
      storeId,
      situationId,
      minValue,
      maxValue,
      paymentMethodId,
    },
    false // Não buscar automaticamente
  );

  // Função para exportar
  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      // Buscar dados
      const result = await refetchExport();
      
      if (!result.data || result.data.length === 0) {
        toast({
          title: "Nenhum dado para exportar",
          description: "Não há pedidos com os filtros selecionados.",
          variant: "destructive",
        });
        return;
      }

      // Exportar para Excel
      exportBlingOrdersToExcel(result.data);
      
      toast({
        title: "Exportação concluída!",
        description: `${result.data.length} pedido(s) exportado(s) com sucesso.`,
      });
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast({
        title: "Erro ao exportar",
        description: "Ocorreu um erro ao gerar o arquivo Excel. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Vendas Bling</h2>
        <Button 
          onClick={handleExport} 
          disabled={isExporting || isFetchingExport || !formattedStartDate || !formattedEndDate}
          className="gap-2"
        >
          {isExporting || isFetchingExport ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Exportando...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Exportar Excel
            </>
          )}
        </Button>
      </div>

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
        onStoreIdChange={(id) => {
          setStoreId(id);
          handleFilterChange();
        }}
        situationId={situationId}
        onSituationIdChange={(id) => {
          setSituationId(id);
          handleFilterChange();
        }}
        minValue={minValue}
        onMinValueChange={(value) => {
          setMinValue(value);
          handleFilterChange();
        }}
        maxValue={maxValue}
        onMaxValueChange={(value) => {
          setMaxValue(value);
          handleFilterChange();
        }}
        paymentMethodId={paymentMethodId}
        onPaymentMethodIdChange={(id) => {
          setPaymentMethodId(id);
          handleFilterChange();
        }}
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

      <SalesEvolutionChart
        data={salesEvolution}
        isLoading={isEvolutionLoading}
        groupBy={calculateGroupBy()}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        <TopSellersChart
          data={topSellers}
          isLoading={isTopSellersLoading}
        />
        <TopProductsChart
          data={topProducts}
          isLoading={isTopProductsLoading}
        />
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
