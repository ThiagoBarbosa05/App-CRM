import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { format as formatDate, parseISO } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  CalendarIcon,
  ShoppingBag,
  TrendingUp,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Store,
  Package,
} from "lucide-react";

// ─── Tipos da resposta do endpoint /api/users/:id/seller-sales ───────────────

interface SellerSale {
  id: string | number;
  source: "bling" | "connect";
  saleDate: string | null;
  totalValue: string | null;
  contactName: string | null;
  contactType: string | null;
  situationValue: string | null;
  orderNumber: string | null;
  sellerName: string | null;
  items: { description: string; quantity: string; value: string }[];
}

interface SellerSalesResponse {
  success: boolean;
  seller: {
    id: string;
    name: string;
    blingVendedorId: string | null;
    blingVendedorName: string | null;
  };
  summary: {
    blingOrders: number;
    blingTotal: number;
    connectOrders: number;
    connectTotal: number;
    combinedTotal: number;
    totalOrders: number;
  };
  data: SellerSale[];
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
}

// ─── Componente ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function SellerPerformancePage() {
  const params = useParams<{ id: string }>();
  const userId = params.id;

  const [page, setPage] = useState(1);
  const [source, setSource] = useState<"all" | "bling" | "connect">("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setDate(new Date().getDate() - 90)),
    to: new Date(),
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  const startDate = useMemo(
    () => (dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : ""),
    [dateRange?.from],
  );
  const endDate = useMemo(
    () => (dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : startDate),
    [dateRange?.to, startDate],
  );

  const queryParams = new URLSearchParams({
    source,
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
    ...(startDate && { startDate }),
    ...(endDate && { endDate }),
  });

  const { data, isLoading } = useQuery<SellerSalesResponse>({
    queryKey: [`/api/users/${userId}/seller-sales`, source, startDate, endDate, page],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/seller-sales?${queryParams}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json as SellerSalesResponse;
    },
    enabled: !!userId,
  });

  const handleFilterChange = () => setPage(1);

  return (
    <div className="space-y-6 pb-10">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          {isLoading ? (
            <Skeleton className="h-8 w-48 mb-2" />
          ) : (
            <h1 className="text-2xl font-bold tracking-tight">
              {data?.seller.name ?? "Vendedor"}
            </h1>
          )}
          <p className="text-sm text-slate-500 mt-1">
            Histórico de vendas unificado · Bling + Connect
          </p>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2">
          {/* Seletor de plataforma */}
          <Select
            value={source}
            onValueChange={(v) => {
              setSource(v as "all" | "bling" | "connect");
              handleFilterChange();
            }}
          >
            <SelectTrigger className="w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas plataformas</SelectItem>
              <SelectItem value="bling">Bling</SelectItem>
              <SelectItem value="connect">Connect</SelectItem>
            </SelectContent>
          </Select>

          {/* Seletor de período */}
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 text-sm">
                <CalendarIcon className="h-4 w-4" />
                {dateRange?.from && dateRange?.to
                  ? `${format(dateRange.from, "dd/MM/yy")} – ${format(dateRange.to, "dd/MM/yy")}`
                  : "Selecionar período"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={(range) => {
                  setDateRange(range);
                  handleFilterChange();
                  if (range?.from && range?.to) setCalendarOpen(false);
                }}
                locale={ptBR}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Cards de resumo */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <ShoppingBag className="h-3.5 w-3.5" />
                Total de Pedidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">
                {data?.summary.totalOrders ?? 0}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {data?.summary.blingOrders ?? 0} Bling ·{" "}
                {data?.summary.connectOrders ?? 0} Connect
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                Faturamento Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(data?.summary.combinedTotal ?? 0)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <Store className="h-3.5 w-3.5 text-blue-500" />
                Vendas Bling
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(data?.summary.blingTotal ?? 0)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {data?.summary.blingOrders ?? 0} pedido(s)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <Package className="h-3.5 w-3.5 text-violet-500" />
                Vendas Connect
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(data?.summary.connectTotal ?? 0)}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {data?.summary.connectOrders ?? 0} pedido(s)
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela de vendas */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-400">
            Histórico de Vendas
          </h2>
          <div className="flex-1 h-px bg-slate-100 dark:bg-slate-800" />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : !data || data.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <ShoppingBag className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-sm font-medium">Nenhuma venda encontrada</p>
            <p className="text-xs mt-1">Ajuste os filtros ou importe dados</p>
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-slate-100 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Origem
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Data
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Pedido
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Cliente
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Produtos
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 uppercase tracking-wide text-right">
                      Valor
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((sale, i) => (
                    <TableRow key={`${sale.source}-${sale.id}-${i}`} className="hover:bg-slate-50">
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs font-medium",
                            sale.source === "bling"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-violet-50 text-violet-700",
                          )}
                        >
                          {sale.source === "bling" ? "Bling" : "Connect"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {sale.saleDate
                          ? formatDate(
                              typeof sale.saleDate === "string"
                                ? parseISO(sale.saleDate)
                                : sale.saleDate,
                              "dd/MM/yyyy",
                            )
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-mono text-slate-500">
                        {sale.orderNumber ?? "—"}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700 max-w-[180px] truncate">
                        {sale.contactName ?? (
                          <span className="text-slate-400 italic">Sem nome</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {sale.situationValue ? (
                          <Badge variant="outline" className="text-xs">
                            {sale.situationValue}
                          </Badge>
                        ) : (
                          <span className="text-slate-300 text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 max-w-[200px]">
                        {sale.items.length > 0 ? (
                          <span className="truncate block">
                            {sale.items
                              .map(
                                (item) =>
                                  `${item.description} (×${parseFloat(item.quantity).toFixed(0)})`,
                              )
                              .join(", ")}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">
                        {formatCurrency(parseFloat(sale.totalValue ?? "0"))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-sm text-slate-500 px-2">
                Página {page} · {data.pagination.total} venda(s)
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.pagination.hasMore}
                onClick={() => setPage((p) => p + 1)}
                className="gap-1"
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
