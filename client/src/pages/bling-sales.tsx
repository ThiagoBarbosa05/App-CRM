import { useState, useMemo } from "react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import {
  useUnifiedOrders,
  useUnifiedSalesComparison,
  useUnifiedSalesEvolution,
  useUnifiedTopSellers,
  type OrderSource,
} from "@/hooks/use-unified-orders";
import {
  useTopProducts,
  useCashbackStatistics,
  useCohortAnalysis,
  useTopClients,
  useBlingOrdersForExport,
} from "@/hooks/use-bling-orders";
import { useDebounce } from "@/hooks/use-debounce";
import { exportBlingOrdersToExcel } from "@/lib/excel-export";
import { useToast } from "@/hooks/use-toast";

// Bling components
import { BlingSalesHeader } from "@/components/bling-sales/bling-sales-header";
import { SalesStatisticsCards } from "@/components/bling-sales/sales-statistics-cards";
import { CashbackStatisticsCards } from "@/components/bling-sales/cashback-statistics-cards";
import { SalesEvolutionChart } from "@/components/bling-sales/sales-evolution-chart";
import { TopSellersChart } from "@/components/bling-sales/top-sellers-chart";
import { TopProductsChart } from "@/components/bling-sales/top-products-chart";
import { OrdersFilters } from "@/components/bling-sales/orders-filters";
import { CohortAnalysisTable } from "@/components/bling-sales/cohort-analysis-table";
import { TopClientsPanel } from "@/components/bling-sales/top-clients-panel";
import { UnifiedOrdersTable } from "@/components/bling-sales/unified-orders-table";

// Connect import
import { ConnectCsvImportModal } from "@/components/connect-sales/connect-csv-import-modal";

// UI
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload } from "lucide-react";

export default function BlingSalesPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [isExporting, setIsExporting] = useState(false);
  const [connectImportOpen, setConnectImportOpen] = useState(false);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 90)),
    to: new Date(),
  });
  const [contactName, setContactName] = useState("");
  const debouncedContact = useDebounce(contactName, 500);
  const [sellerId, setSellerId] = useState<string | undefined>();
  const [source, setSource] = useState<OrderSource>("all");
  const [storeId, setStoreId] = useState<string | undefined>();
  const [situationId, setSituationId] = useState<string | undefined>();
  const [minValue, setMinValue] = useState<number | undefined>();
  const [maxValue, setMaxValue] = useState<number | undefined>();
  const [paymentMethodId, setPaymentMethodId] = useState<string | undefined>();

  // ── Computed dates ────────────────────────────────────────────────────────
  const startDate = useMemo(
    () => (dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : ""),
    [dateRange?.from],
  );
  const endDate = useMemo(
    () => (dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : startDate),
    [dateRange?.to, startDate],
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

  // ── Unified queries ───────────────────────────────────────────────────────
  const { data: salesComparison, isLoading: isStatsLoading } =
    useUnifiedSalesComparison(startDate, endDate, source);
  const { data: salesEvolution, isLoading: isEvolutionLoading } =
    useUnifiedSalesEvolution(startDate, endDate, groupBy, source);
  const { data: topSellers, isLoading: isTopSellersLoading } =
    useUnifiedTopSellers(startDate, endDate, 5, source);
  const { data: ordersResponse, isLoading: isOrdersLoading } = useUnifiedOrders(
    {
      startDate,
      endDate,
      contactName: debouncedContact || undefined,
      sellerId,
      source,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    },
  );

  const orders = ordersResponse?.data ?? [];
  const pagination = ordersResponse?.pagination;
  const hasMore = pagination?.hasMore ?? false;
  const totalOrders = pagination?.total ?? 0;

  // ── Bling-only queries ────────────────────────────────────────────────────
  const { data: topProducts, isLoading: isTopProductsLoading } = useTopProducts(
    startDate,
    endDate,
    5,
    "F",
  );
  const { data: cashbackStats, isLoading: isCashbackStatsLoading } =
    useCashbackStatistics(startDate, endDate);
  const { data: cohortData, isLoading: isCohortLoading } = useCohortAnalysis(
    startDate,
    endDate,
  );
  const { data: topClients, isLoading: isTopClientsLoading } = useTopClients(
    startDate,
    endDate,
    20,
    "F",
  );

  // ── Export (Bling only) ───────────────────────────────────────────────────
  const { refetch: refetchExport, isFetching: isFetchingExport } =
    useBlingOrdersForExport(
      {
        startDate,
        endDate,
        contactType: "F",
        contactName: debouncedContact || undefined,
        sellerId,
        storeId,
        situationId,
        minValue,
        maxValue,
        paymentMethodId,
      },
      false,
    );

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const result = await refetchExport();
      if (!result.data || result.data.length === 0) {
        toast({
          title: "Nenhum dado",
          description: "Não há pedidos Bling com os filtros selecionados.",
          variant: "destructive",
        });
        return;
      }
      exportBlingOrdersToExcel(result.data);
      toast({
        title: "Sucesso!",
        description: `${result.data.length} pedido(s) Bling exportado(s).`,
      });
    } catch {
      toast({ title: "Erro na exportação", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // ── Data shape adapters ───────────────────────────────────────────────────
  // SalesEvolutionChart expects { date, totalOrders, totalValue }
  const evolutionForChart = (salesEvolution ?? []).map((e) => ({
    date: e.period,
    totalOrders: e.totalOrders,
    totalValue: e.totalValue,
  }));
  // TopSellersChart expects TopSeller with totalValue: string
  const topSellersForChart = (topSellers ?? []).map((s) => ({
    sellerId: s.sellerId,
    sellerName: s.sellerName,
    totalOrders: s.totalOrders,
    totalValue: String(s.totalValue),
  }));

  return (
    <div className="max-w-full overflow-x-hidden space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <BlingSalesHeader
            onExport={handleExport}
            isExporting={isExporting || isFetchingExport}
            disabled={!startDate || !endDate}
          />
        </div>
        <Button
          onClick={() => setConnectImportOpen(true)}
          className="bg-violet-600 hover:bg-violet-700 gap-2 mt-1 shrink-0"
        >
          <Upload className="h-4 w-4" />
          Importar CSV Connect
        </Button>
      </div>

      <ConnectCsvImportModal
        open={connectImportOpen}
        onOpenChange={setConnectImportOpen}
      />

      {/* Filters */}
      <OrdersFilters
        dateRange={dateRange}
        onDateRangeChange={(range) => {
          setDateRange(range);
          setPage(1);
        }}
        contactName={contactName}
        onContactNameChange={(name) => {
          setContactName(name);
          setPage(1);
        }}
        sellerId={sellerId}
        onSellerIdChange={(id) => {
          setSellerId(id);
          setPage(1);
        }}
        source={source}
        onSourceChange={(s) => {
          setSource(s);
          setPage(1);
        }}
        storeId={storeId}
        onStoreIdChange={(id) => {
          setStoreId(id);
          setPage(1);
        }}
        situationId={situationId}
        onSituationIdChange={(id) => {
          setSituationId(id);
          setPage(1);
        }}
        minValue={minValue}
        onMinValueChange={(val) => {
          setMinValue(val);
          setPage(1);
        }}
        maxValue={maxValue}
        onMaxValueChange={(val) => {
          setMaxValue(val);
          setPage(1);
        }}
        paymentMethodId={paymentMethodId}
        onPaymentMethodIdChange={(id) => {
          setPaymentMethodId(id);
          setPage(1);
        }}
        isLoading={isOrdersLoading}
      />

      {/* Unified statistics cards */}
      <SalesStatisticsCards
        totalOrders={salesComparison?.current.totalOrders}
        totalValue={salesComparison?.current.totalValue}
        averageValue={salesComparison?.current.averageValue}
        ordersChange={salesComparison?.changes.ordersChange}
        valueChange={salesComparison?.changes.valueChange}
        averageChange={salesComparison?.changes.averageChange}
        isLoading={isStatsLoading}
      />

      {/* Cashback & Clientes — Bling only */}
      <div className="space-y-3">
        <SectionHeader label="Cashback & Clientes Vinculados" blingOnly />
        <CashbackStatisticsCards
          data={cashbackStats}
          isLoading={isCashbackStatsLoading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <SalesEvolutionChart
            data={evolutionForChart}
            isLoading={isEvolutionLoading}
            groupBy={groupBy}
          />
        </div>
        <div className="space-y-8">
          <TopSellersChart
            data={topSellersForChart}
            isLoading={isTopSellersLoading}
          />
          {/* Top Products — Bling only */}
          <div className="space-y-2">
            <SectionHeader label="Top Produtos" blingOnly small />
            <TopProductsChart
              data={topProducts}
              isLoading={isTopProductsLoading}
            />
          </div>
        </div>
      </div>

      {/* Top 20 Clientes — Bling only */}
      <div className="space-y-3">
        <SectionHeader label="Top 20 Clientes" blingOnly />
        <TopClientsPanel data={topClients} isLoading={isTopClientsLoading} />
      </div>

      {/* Cohort — Bling only */}
      <div className="space-y-3">
        <SectionHeader label="Análise de Cohort" blingOnly />
        <CohortAnalysisTable
          data={cohortData}
          isLoading={isCohortLoading}
          startDate={startDate}
          endDate={endDate}
        />
      </div>

      {/* Unified orders table */}
      <UnifiedOrdersTable
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

// ── Section header with optional "Somente Bling" badge ───────────────────────
function SectionHeader({
  label,
  blingOnly = false,
  small = false,
}: {
  label: string;
  blingOnly?: boolean;
  small?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-1">
      <h2
        className={
          small
            ? "text-[9px] font-black uppercase tracking-widest text-slate-400"
            : "text-xs font-black uppercase tracking-widest text-slate-400"
        }
      >
        {label}
      </h2>
      {blingOnly && (
        <Badge
          variant="secondary"
          className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border-green-100 dark:border-green-800 h-auto"
        >
          Somente Bling
        </Badge>
      )}
      <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}
