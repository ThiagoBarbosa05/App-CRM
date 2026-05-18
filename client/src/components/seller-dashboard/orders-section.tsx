import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";
import { useUnifiedOrders, type OrderSource } from "@/hooks/use-unified-orders";
import { useBlingOrdersForExport } from "@/hooks/use-bling-orders";
import { exportBlingOrdersToExcel } from "@/lib/excel-export";
import { useToast } from "@/hooks/use-toast";
import { OrdersFilters } from "@/components/bling-sales/orders-filters";
import { UnifiedOrdersTable } from "@/components/bling-sales/unified-orders-table";

const PAGE_SIZE = 20;

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

      <UnifiedOrdersTable
        orders={orders}
        isLoading={isOrdersLoading}
        page={page}
        onPageChange={setPage}
        hasMore={hasMore}
        totalOrders={totalOrders}
      />
    </section>
  );
}
