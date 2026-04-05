import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Eye, Package2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  ClientPurchaseHistorySource,
  ClientPurchaseInsightsResponse,
} from "@/hooks/use-client-purchase-insights";

interface ClientPurchaseHistoryProps {
  history: ClientPurchaseInsightsResponse["purchaseHistory"];
  historySource: ClientPurchaseHistorySource;
  onHistorySourceChange: (source: ClientPurchaseHistorySource) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

const historySourceOptions: Array<{
  value: ClientPurchaseHistorySource;
  label: string;
}> = [
  { value: "all", label: "Todas" },
  { value: "bling", label: "Bling" },
  { value: "connect", label: "Connect" },
];

function formatSaleDate(date: string): string {
  try {
    return format(parseISO(`${date}T12:00:00`), "dd MMM yyyy", {
      locale: ptBR,
    });
  } catch {
    return date;
  }
}

export function ClientPurchaseHistory({
  history,
  historySource,
  onHistorySourceChange,
  onPreviousPage,
  onNextPage,
}: ClientPurchaseHistoryProps) {
  return (
    <Card className="rounded-xl border-slate-200/80 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
      <CardHeader className="flex flex-col gap-4 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Historico de compras
          </CardTitle>
          <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
            Veja as compras mais recentes do cliente para entender seu
            comportamento e apoiar a proxima abordagem.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {history.total} compra(s)
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800/80">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-slate-800/50">
                <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Data
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Origem
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Pedido
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Vendedor
                </TableHead>
                <TableHead className="text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Valor
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.data.map((order) => (
                <TableRow
                  key={`${order.source}-${order.id}`}
                  className="transition-colors hover:bg-amber-50/40 dark:hover:bg-amber-900/10"
                >
                  <TableCell className="font-medium text-slate-700 dark:text-slate-200">
                    {formatSaleDate(order.saleDate)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "border-0 text-[10px] font-semibold uppercase",
                        order.source === "bling"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
                      )}
                    >
                      {order.source}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {order.orderNumber
                          ? `#${order.orderNumber}`
                          : "Importacao CSV"}
                      </p>
                      {order.items.length > 0 && (
                        <p className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                          <Package2 className="h-3 w-3" />
                          {order.items.length} item(ns)
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                    {order.sellerName ?? (
                      <span className="text-slate-400">Nao vinculado</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(order.totalValue)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {history.data.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200/80 bg-slate-50/50 px-4 py-10 text-center dark:border-slate-800 dark:bg-slate-950/40">
            <Package2 className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Nenhuma compra encontrada nesse filtro.
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Troque a origem acima para comparar o historico Bling com as
              importacoes Connect.
            </p>
          </div>
        )}

        {history.data.some((order) => order.items.length > 0) && (
          <div className="grid gap-3 xl:grid-cols-2">
            {history.data
              .filter((order) => order.items.length > 0)
              .slice(0, 2)
              .map((order) => (
                <div
                  key={`items-${order.source}-${order.id}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60"
                >
                  <p className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Eye className="h-4 w-4" />
                    Itens do pedido{" "}
                    {order.orderNumber ? `#${order.orderNumber}` : order.id}
                  </p>
                  <div className="space-y-2">
                    {order.items.map((item) => (
                      <div
                        key={`${order.id}-${item.productId ?? item.description}`}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="text-slate-600 dark:text-slate-300">
                          {item.description}
                        </span>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {item.quantity} x {formatCurrency(item.unitValue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Leitura operacional das compras mais recentes para apoiar a proxima
            abordagem.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPreviousPage}
              disabled={history.offset === 0}
              className="rounded-lg"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNextPage}
              disabled={!history.hasMore}
              className="rounded-lg"
            >
              Proxima
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
