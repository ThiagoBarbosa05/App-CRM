import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { useUnifiedOrders } from "@/hooks/use-unified-orders";
import {
  useCashbackStatistics,
  useCohortAnalysis,
  useBlingOrdersForExport,
} from "@/hooks/use-bling-orders";
import { useDebounce } from "@/hooks/use-debounce";
import { exportBlingOrdersToExcel } from "@/lib/excel-export";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Bling components
import { CashbackStatisticsCards } from "@/components/bling-sales/cashback-statistics-cards";
import { OrdersFilters } from "@/components/bling-sales/orders-filters";
import { CohortAnalysisTable } from "@/components/bling-sales/cohort-analysis-table";
import { UnifiedOrdersTable } from "@/components/bling-sales/unified-orders-table";

// Connect import
import { ConnectCsvImportModal } from "@/components/connect-sales/connect-csv-import-modal";

// UI
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Upload,
  Download,
  Loader2,
  HandCoins,
  CalendarIcon,
} from "lucide-react";

export default function BlingSalesPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [isExporting, setIsExporting] = useState(false);
  const [connectImportOpen, setConnectImportOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 90)),
    to: new Date(),
  });
  const [contactName, setContactName] = useState("");
  const debouncedContact = useDebounce(contactName, 500);
  const [sellerId, setSellerId] = useState<string | undefined>();
  const [minValue, setMinValue] = useState<number | undefined>();
  const [maxValue, setMaxValue] = useState<number | undefined>();

  // ── Computed dates ────────────────────────────────────────────────────────
  const startDate = useMemo(
    () => (dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : ""),
    [dateRange?.from],
  );
  const endDate = useMemo(
    () => (dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : startDate),
    [dateRange?.to, startDate],
  );

  // ── Unified queries ───────────────────────────────────────────────────────
  const { data: ordersResponse, isLoading: isOrdersLoading } = useUnifiedOrders(
    {
      startDate,
      endDate,
      contactName: debouncedContact || undefined,
      sellerId,
      source: "all",
      limit: pageSize,
      offset: (page - 1) * pageSize,
    },
  );

  const orders = ordersResponse?.data ?? [];
  const pagination = ordersResponse?.pagination;
  const hasMore = pagination?.hasMore ?? false;
  const totalOrders = pagination?.total ?? 0;

  // ── Bling-only queries ────────────────────────────────────────────────────
  const { data: cashbackStats, isLoading: isCashbackStatsLoading } =
    useCashbackStatistics(startDate, endDate);
  const { data: cohortData, isLoading: isCohortLoading } = useCohortAnalysis(
    startDate,
    endDate,
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
        minValue,
        maxValue,
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

  return (
    <div className="max-w-full overflow-x-hidden space-y-5 pb-12">
      {/* Header + Importar CSV */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 sm:px-6 py-5 rounded-2xl shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/5 dark:bg-green-400/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          {/* Left: title */}
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex-shrink-0 shadow-inner">
              <HandCoins className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
                Vendas Bling
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5 truncate">
                Acompanhe e analise o desempenho comercial integrado ao Bling
                ERP
              </p>
            </div>
          </div>

          {/* Right: badges + actions */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-xl px-3 py-1.5 flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Em Desenvolvimento
              </span>
            </div>

            <Button
              onClick={handleExport}
              disabled={
                !startDate || !endDate || isExporting || isFetchingExport
              }
              className="gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-slate-200 rounded-xl h-9 px-4 font-bold transition-all shadow-sm text-sm"
            >
              {isExporting || isFetchingExport ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Exportando…</span>
                </>
              ) : (
                <>
                  <Download className="h-3.5 w-3.5" />
                  <span>Exportar Excel</span>
                </>
              )}
            </Button>

            <Button
              onClick={() => setConnectImportOpen(true)}
              className="gap-2 bg-violet-600 hover:bg-violet-700 rounded-xl h-9 px-4 text-sm font-bold shrink-0"
            >
              <Upload className="h-3.5 w-3.5" />
              Importar CSV
            </Button>
          </div>
        </div>
      </div>

      <ConnectCsvImportModal
        open={connectImportOpen}
        onOpenChange={setConnectImportOpen}
      />

      {/* Global period selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-5 sm:px-6 py-4 rounded-2xl shadow-sm flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <CalendarIcon className="h-4 w-4" />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Período
          </span>
        </div>
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "justify-start text-left font-bold h-9 bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 rounded-xl px-4 transition-all hover:border-blue-400 dark:hover:border-blue-500",
                !dateRange && "text-slate-400",
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-blue-500" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <span>
                    {format(dateRange.from, "dd/MM/yy")} -{" "}
                    {format(dateRange.to, "dd/MM/yy")}
                  </span>
                ) : (
                  format(dateRange.from, "dd/MM/yy")
                )
              ) : (
                <span>Selecione um período</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0 rounded-2xl shadow-2xl border-slate-200 dark:border-slate-800"
            align="start"
          >
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={(range) => {
                setDateRange(range);
                setPage(1);
              }}
              numberOfMonths={2}
              locale={ptBR}
              className="rounded-2xl"
            />
          </PopoverContent>
        </Popover>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Afeta todos os gráficos e métricas da página
        </p>
      </div>

      {/* Cashback & Clientes — Bling only */}
      <section className="space-y-3">
        <SectionLabel label="Cashback & Clientes Vinculados" blingOnly />
        <CashbackStatisticsCards
          data={cashbackStats}
          isLoading={isCashbackStatsLoading}
        />
      </section>

      {/* Cohort — Bling only */}
      <section className="space-y-3">
        <SectionLabel label="Análise de Cohort" blingOnly />
        <CohortAnalysisTable
          data={cohortData}
          isLoading={isCohortLoading}
          startDate={startDate}
          endDate={endDate}
        />
      </section>

      {/* Table filters — affect only the orders table below */}
      <OrdersFilters
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
        isLoading={isOrdersLoading}
      />

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

// ── Section label with optional "Somente Bling" badge ────────────────────────
function SectionLabel({
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
