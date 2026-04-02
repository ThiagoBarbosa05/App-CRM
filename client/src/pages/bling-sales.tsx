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
  useCashbackStatistics,
  useCohortAnalysis,
  useTopClients,
} from "@/hooks/use-bling-orders";
import {
  useConnectOrders,
  useConnectSalesStatistics,
  useConnectTopSellers,
  useConnectSalesEvolution,
} from "@/hooks/use-connect-orders";
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
import { OrdersTable } from "@/components/bling-sales/orders-table";
import { CohortAnalysisTable } from "@/components/bling-sales/cohort-analysis-table";
import { TopClientsPanel } from "@/components/bling-sales/top-clients-panel";

// Connect components
import { ConnectCsvImportModal } from "@/components/connect-sales/connect-csv-import-modal";
import { ConnectOrdersTable } from "@/components/connect-sales/connect-orders-table";

// UI
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { cn } from "@/lib/utils";

type ActiveTab = "bling" | "connect";

export default function BlingSalesPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>("bling");

  // ── Bling state ─────────────────────────────────────────────────────────────
  const [blingPage, setBlingPage] = useState(1);
  const pageSize = 20;
  const [isExporting, setIsExporting] = useState(false);

  const [blingDateRange, setBlingDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 90)),
    to: new Date(),
  });
  const [blingContactName, setBlingContactName] = useState("");
  const debouncedBlingContact = useDebounce(blingContactName, 500);
  const [blingSellerId, setBlingSellerId] = useState<string | undefined>();
  const [blingStoreId, setBlingStoreId] = useState<string | undefined>();
  const [blingSituationId, setBlingSituationId] = useState<string | undefined>();
  const [blingMinValue, setBlingMinValue] = useState<number | undefined>();
  const [blingMaxValue, setBlingMaxValue] = useState<number | undefined>();
  const [blingPaymentMethodId, setBlingPaymentMethodId] = useState<string | undefined>();

  // ── Connect state ────────────────────────────────────────────────────────────
  const [connectPage, setConnectPage] = useState(1);
  const [connectImportOpen, setConnectImportOpen] = useState(false);

  const [connectDateRange, setConnectDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 90)),
    to: new Date(),
  });
  const [connectContactName, setConnectContactName] = useState("");
  const debouncedConnectContact = useDebounce(connectContactName, 500);
  const [connectSellerId, setConnectSellerId] = useState<string | undefined>();

  // ── Computed dates ────────────────────────────────────────────────────────────
  const blingStart = useMemo(
    () => (blingDateRange?.from ? format(blingDateRange.from, "yyyy-MM-dd") : ""),
    [blingDateRange?.from],
  );
  const blingEnd = useMemo(
    () =>
      blingDateRange?.to ? format(blingDateRange.to, "yyyy-MM-dd") : blingStart,
    [blingDateRange?.to, blingStart],
  );

  const connectStart = useMemo(
    () => (connectDateRange?.from ? format(connectDateRange.from, "yyyy-MM-dd") : ""),
    [connectDateRange?.from],
  );
  const connectEnd = useMemo(
    () =>
      connectDateRange?.to
        ? format(connectDateRange.to, "yyyy-MM-dd")
        : connectStart,
    [connectDateRange?.to, connectStart],
  );

  const blingGroupBy = useMemo(() => {
    if (!blingDateRange?.from || !blingDateRange?.to) return "day" as const;
    const days = Math.ceil(
      (blingDateRange.to.getTime() - blingDateRange.from.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (days > 90) return "month" as const;
    if (days > 30) return "week" as const;
    return "day" as const;
  }, [blingDateRange]);

  const connectGroupBy = useMemo(() => {
    if (!connectDateRange?.from || !connectDateRange?.to) return "day" as const;
    const days = Math.ceil(
      (connectDateRange.to.getTime() - connectDateRange.from.getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (days > 90) return "month" as const;
    if (days > 30) return "week" as const;
    return "day" as const;
  }, [connectDateRange]);

  // ── Bling queries ─────────────────────────────────────────────────────────────
  const { data: salesComparison, isLoading: isStatsLoading } =
    useSalesComparison(blingStart, blingEnd, undefined, "F");
  const { data: salesEvolution, isLoading: isEvolutionLoading } =
    useSalesEvolution(blingStart, blingEnd, blingGroupBy, undefined, "F");
  const { data: topSellers, isLoading: isTopSellersLoading } = useTopSellers(
    blingStart, blingEnd, 5, "F",
  );
  const { data: topProducts, isLoading: isTopProductsLoading } = useTopProducts(
    blingStart, blingEnd, 5, "F",
  );
  const { data: cashbackStats, isLoading: isCashbackStatsLoading } =
    useCashbackStatistics(blingStart, blingEnd);
  const { data: cohortData, isLoading: isCohortLoading } =
    useCohortAnalysis(blingStart, blingEnd);
  const { data: topClients, isLoading: isTopClientsLoading } = useTopClients(
    blingStart, blingEnd, 20, "F",
  );
  const { data: ordersResponse, isLoading: isOrdersLoading } = useBlingOrders({
    startDate: blingStart,
    endDate: blingEnd,
    contactType: "F",
    contactName: debouncedBlingContact || undefined,
    sellerId: blingSellerId,
    storeId: blingStoreId,
    situationId: blingSituationId,
    minValue: blingMinValue,
    maxValue: blingMaxValue,
    paymentMethodId: blingPaymentMethodId,
    limit: pageSize,
    offset: (blingPage - 1) * pageSize,
  });

  const blingOrders = ordersResponse?.data || [];
  const blingPagination = ordersResponse?.pagination;
  const blingHasMore = blingPagination?.hasMore || false;
  const blingTotalOrders = blingPagination?.total || 0;

  const { refetch: refetchExport, isFetching: isFetchingExport } =
    useBlingOrdersForExport(
      {
        startDate: blingStart,
        endDate: blingEnd,
        contactType: "F",
        contactName: debouncedBlingContact || undefined,
        sellerId: blingSellerId,
        storeId: blingStoreId,
        situationId: blingSituationId,
        minValue: blingMinValue,
        maxValue: blingMaxValue,
        paymentMethodId: blingPaymentMethodId,
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
          description: "Não há pedidos com os filtros selecionados.",
          variant: "destructive",
        });
        return;
      }
      exportBlingOrdersToExcel(result.data);
      toast({
        title: "Sucesso!",
        description: `${result.data.length} pedido(s) exportado(s).`,
      });
    } catch {
      toast({ title: "Erro na exportação", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // ── Connect queries ───────────────────────────────────────────────────────────
  const { data: connectStats, isLoading: isConnectStatsLoading } =
    useConnectSalesStatistics(connectStart, connectEnd);
  const { data: connectTopSellers = [], isLoading: isConnectSellersLoading } =
    useConnectTopSellers(connectStart, connectEnd, 5);
  const { data: connectEvolution = [], isLoading: isConnectEvolutionLoading } =
    useConnectSalesEvolution(connectStart, connectEnd, connectGroupBy);
  const { data: connectOrdersResponse, isLoading: isConnectOrdersLoading } =
    useConnectOrders({
      startDate: connectStart,
      endDate: connectEnd,
      sellerId: connectSellerId,
      contactName: debouncedConnectContact || undefined,
      limit: pageSize,
      offset: (connectPage - 1) * pageSize,
    });

  const connectOrders = connectOrdersResponse?.data ?? [];
  const connectPagination = connectOrdersResponse?.pagination;
  const connectHasMore = connectPagination?.hasMore ?? false;
  const connectTotal = connectPagination?.total ?? 0;

  const connectTopSellersForChart = connectTopSellers.map((s) => ({
    sellerId: s.sellerId ?? "",
    sellerName: s.sellerName,
    totalOrders: s.totalOrders,
    totalValue: String(s.totalValue),
  }));

  const connectEvolutionForChart = connectEvolution.map((e) => ({
    date: String(e.period),
    totalOrders: e.totalOrders,
    totalValue: e.totalValue,
  }));

  return (
    <div className="max-w-full overflow-x-hidden space-y-6 pb-10">
      {/* Header + Tabs */}
      <div className="space-y-4">
        <BlingSalesHeader
          onExport={handleExport}
          isExporting={isExporting || isFetchingExport}
          disabled={!blingStart || !blingEnd}
        />

        {/* Tab switcher */}
        <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab("bling")}
            className={cn(
              "px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px",
              activeTab === "bling"
                ? "border-green-500 text-green-600 dark:text-green-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            Bling
          </button>
          <button
            onClick={() => setActiveTab("connect")}
            className={cn(
              "px-5 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px",
              activeTab === "connect"
                ? "border-violet-500 text-violet-600 dark:text-violet-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300",
            )}
          >
            Connect
          </button>
        </div>
      </div>

      {/* ── ABA BLING ─────────────────────────────────────────────────────── */}
      {activeTab === "bling" && (
        <div className="space-y-8">
          <OrdersFilters
            dateRange={blingDateRange}
            onDateRangeChange={(range) => {
              setBlingDateRange(range);
              setBlingPage(1);
            }}
            contactName={blingContactName}
            onContactNameChange={(name) => {
              setBlingContactName(name);
              setBlingPage(1);
            }}
            sellerId={blingSellerId}
            onSellerIdChange={(id) => {
              setBlingSellerId(id);
              setBlingPage(1);
            }}
            storeId={blingStoreId}
            onStoreIdChange={(id) => {
              setBlingStoreId(id);
              setBlingPage(1);
            }}
            situationId={blingSituationId}
            onSituationIdChange={(id) => {
              setBlingSituationId(id);
              setBlingPage(1);
            }}
            minValue={blingMinValue}
            onMinValueChange={(val) => {
              setBlingMinValue(val);
              setBlingPage(1);
            }}
            maxValue={blingMaxValue}
            onMaxValueChange={(val) => {
              setBlingMaxValue(val);
              setBlingPage(1);
            }}
            paymentMethodId={blingPaymentMethodId}
            onPaymentMethodIdChange={(id) => {
              setBlingPaymentMethodId(id);
              setBlingPage(1);
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

          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
                Cashback & Clientes Vinculados
              </h2>
              <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
            </div>
            <CashbackStatisticsCards
              data={cashbackStats}
              isLoading={isCashbackStatsLoading}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <SalesEvolutionChart
                data={salesEvolution}
                isLoading={isEvolutionLoading}
                groupBy={blingGroupBy}
              />
            </div>
            <div className="space-y-8">
              <TopSellersChart data={topSellers} isLoading={isTopSellersLoading} />
              <TopProductsChart data={topProducts} isLoading={isTopProductsLoading} />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
                Top 20 Clientes
              </h2>
              <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
            </div>
            <TopClientsPanel data={topClients} isLoading={isTopClientsLoading} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
                Análise de Cohort
              </h2>
              <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
            </div>
            <CohortAnalysisTable
              data={cohortData}
              isLoading={isCohortLoading}
              startDate={blingStart}
              endDate={blingEnd}
            />
          </div>

          <OrdersTable
            orders={blingOrders}
            isLoading={isOrdersLoading}
            page={blingPage}
            onPageChange={setBlingPage}
            hasMore={blingHasMore}
            totalOrders={blingTotalOrders}
          />
        </div>
      )}

      {/* ── ABA CONNECT ───────────────────────────────────────────────────── */}
      {activeTab === "connect" && (
        <div className="space-y-8">
          {/* Import button */}
          <div className="flex justify-end">
            <Button
              onClick={() => setConnectImportOpen(true)}
              className="bg-violet-600 hover:bg-violet-700 gap-2"
            >
              <Upload className="h-4 w-4" />
              Importar CSV
            </Button>
          </div>

          <ConnectCsvImportModal
            open={connectImportOpen}
            onOpenChange={setConnectImportOpen}
          />

          <OrdersFilters
            dateRange={connectDateRange}
            onDateRangeChange={(range) => {
              setConnectDateRange(range);
              setConnectPage(1);
            }}
            contactName={connectContactName}
            onContactNameChange={(name) => {
              setConnectContactName(name);
              setConnectPage(1);
            }}
            sellerId={connectSellerId}
            onSellerIdChange={(id) => {
              setConnectSellerId(id);
              setConnectPage(1);
            }}
            storeId={undefined}
            onStoreIdChange={() => {}}
            situationId={undefined}
            onSituationIdChange={() => {}}
            minValue={undefined}
            onMinValueChange={() => {}}
            maxValue={undefined}
            onMaxValueChange={() => {}}
            paymentMethodId={undefined}
            onPaymentMethodIdChange={() => {}}
            isLoading={isConnectOrdersLoading}
          />

          <SalesStatisticsCards
            totalOrders={connectStats?.totalOrders}
            totalValue={connectStats?.totalValue}
            averageValue={connectStats?.averageValue}
            isLoading={isConnectStatsLoading}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <SalesEvolutionChart
                data={connectEvolutionForChart}
                isLoading={isConnectEvolutionLoading}
                groupBy={connectGroupBy}
              />
            </div>
            <div>
              <TopSellersChart
                data={connectTopSellersForChart}
                isLoading={isConnectSellersLoading}
              />
            </div>
          </div>

          <ConnectOrdersTable
            orders={connectOrders}
            isLoading={isConnectOrdersLoading}
            page={connectPage}
            onPageChange={setConnectPage}
            hasMore={connectHasMore}
            totalOrders={connectTotal}
          />
        </div>
      )}
    </div>
  );
}
