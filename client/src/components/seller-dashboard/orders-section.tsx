import { useState } from "react";
import { Download, Loader2, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDebounce } from "@/hooks/use-debounce";
import {
  useUnifiedOrders,
  useSellerTotalsWithGoals,
  type OrderSource,
  type SellerTotalWithGoal,
} from "@/hooks/use-unified-orders";
import { useBlingOrdersForExport } from "@/hooks/use-bling-orders";
import { exportBlingOrdersToExcel } from "@/lib/excel-export";
import { useToast } from "@/hooks/use-toast";
import { OrdersFilters } from "@/components/bling-sales/orders-filters";
import { UnifiedOrdersTable } from "@/components/bling-sales/unified-orders-table";
import { formatCurrency } from "@/lib/utils";

const PAGE_SIZE = 20;

function SellerCard({ seller }: { seller: SellerTotalWithGoal }) {
  const hasGoal = seller.salesGoal > 0;
  const progressPct = hasGoal
    ? Math.min(Math.round((seller.totalValue / seller.salesGoal) * 100), 100)
    : 0;
  const isOver = hasGoal && seller.totalValue > seller.salesGoal;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex min-w-[170px] max-w-[220px] shrink-0 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
              {seller.sellerName}
            </p>

            <div>
              <p className="text-base font-black tabular-nums text-slate-900 dark:text-slate-50">
                {formatCurrency(seller.totalValue)}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                {seller.totalOrders} pedido{seller.totalOrders !== 1 ? "s" : ""}
              </p>
            </div>

            {hasGoal && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <Target className="h-2.5 w-2.5" />
                    Meta
                  </span>
                  <span
                    className={`text-[10px] font-bold tabular-nums ${
                      isOver
                        ? "text-emerald-600 dark:text-emerald-400"
                        : progressPct >= 80
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {progressPct}%
                  </span>
                </div>
                <Progress
                  value={progressPct}
                  className={`h-1.5 ${
                    isOver
                      ? "[&>div]:bg-emerald-500"
                      : progressPct >= 80
                        ? "[&>div]:bg-amber-500"
                        : "[&>div]:bg-blue-500"
                  }`}
                />
              </div>
            )}

            {!hasGoal && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                Sem meta cadastrada
              </p>
            )}
          </div>
        </TooltipTrigger>
        {hasGoal && (
          <TooltipContent side="bottom" className="text-xs">
            <p>Meta: {formatCurrency(seller.salesGoal)}</p>
            <p>
              {isOver
                ? `Superou em ${formatCurrency(seller.totalValue - seller.salesGoal)}`
                : `Faltam ${formatCurrency(seller.salesGoal - seller.totalValue)}`}
            </p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

function SellerTotalsSection({
  startDate,
  endDate,
  contactName,
  sellerId,
  userId,
  source,
}: {
  startDate: string;
  endDate: string;
  contactName?: string;
  sellerId?: string;
  userId?: string;
  source: OrderSource;
}) {
  const { data: sellers = [], isLoading } = useSellerTotalsWithGoals({
    startDate,
    endDate,
    contactName,
    sellerId,
    userId,
    source,
  });

  if (!isLoading && sellers.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <TrendingUp className="h-3 w-3 text-slate-400" />
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">
          Totais por vendedor
        </span>
        <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 px-0.5">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton
                key={i}
                className="h-[110px] min-w-[170px] shrink-0 rounded-xl"
              />
            ))
          : sellers.map((seller) => (
              <SellerCard key={seller.sellerId} seller={seller} />
            ))}
      </div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
        {label}
      </h2>
      <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
    </div>
  );
}

export function OrdersSection({
  startDate,
  endDate,
  lockedUserId,
}: {
  startDate: string;
  endDate: string;
  lockedUserId?: string;
}) {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const [contactName, setContactName] = useState("");
  const debouncedContact = useDebounce(contactName, 500);
  const [sellerId, setSellerId] = useState<string | undefined>();
  const [source, setSource] = useState<OrderSource>("all");
  const [minValue, setMinValue] = useState<number | undefined>();
  const [maxValue, setMaxValue] = useState<number | undefined>();

  const { data: ordersResponse, isLoading: isOrdersLoading } = useUnifiedOrders(
    {
      startDate,
      endDate,
      contactName: debouncedContact || undefined,
      sellerId: lockedUserId ? undefined : sellerId,
      userId: lockedUserId,
      source,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    },
  );

  const orders = ordersResponse?.data ?? [];
  const pagination = ordersResponse?.pagination;
  const hasMore = pagination?.hasMore ?? false;
  const totalOrders = pagination?.total ?? 0;
  const totalValueNonCancelled = pagination?.totalValueNonCancelled ?? 0;

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
    <section className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
          Pedidos
        </h2>
        <Badge
          variant="secondary"
          className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800 h-auto"
        >
          Bling + Connect
        </Badge>
        <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
        <Button
          onClick={handleExport}
          disabled={!startDate || !endDate || isExporting || isFetchingExport}
          variant="outline"
          size="sm"
          className="gap-2 rounded-xl h-8 px-3 font-bold text-xs border-slate-200 dark:border-slate-700"
        >
          {isExporting || isFetchingExport ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Exportando…</span>
            </>
          ) : (
            <>
              <Download className="h-3 w-3" />
              <span>Exportar Excel</span>
            </>
          )}
        </Button>
      </div>

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
        hideSeller={!!lockedUserId}
        source={source}
        onSourceChange={(s) => {
          setSource(s);
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

      <SellerTotalsSection
        startDate={startDate}
        endDate={endDate}
        contactName={debouncedContact || undefined}
        sellerId={lockedUserId ? undefined : sellerId}
        userId={lockedUserId}
        source={source}
      />

      <UnifiedOrdersTable
        orders={orders}
        isLoading={isOrdersLoading}
        page={page}
        onPageChange={setPage}
        hasMore={hasMore}
        totalOrders={totalOrders}
        totalValueNonCancelled={totalValueNonCancelled}
      />
    </section>
  );
}
