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
import { formatCurrency } from "@/lib/utils";
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

function formatSaleDate(date: string) {
  try {
    return format(parseISO(`${date}T12:00:00`), "dd MMM yyyy", { locale: ptBR });
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
    <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <CardHeader className="flex flex-col gap-4 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base font-black text-slate-950 dark:text-white">
            Historico de compras
          </CardTitle>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Filtre a origem para revisar somente pedidos do ERP ou importacoes Connect.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {history.total} compra(s) vinculada(s)
          </span>
          <div className="flex rounded-full border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
            {historySourceOptions.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onHistorySourceChange(option.value)}
                className={
                  historySource === option.value
                    ? "rounded-full bg-white px-3 text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white"
                    : "rounded-full px-3 text-slate-500 dark:text-slate-400"
                }
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-[1.35rem] border border-slate-200 dark:border-slate-800">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Pedido</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.data.map((order) => (
              <TableRow key={`${order.source}-${order.id}`}>
                <TableCell className="font-medium text-slate-700 dark:text-slate-200">
                  {formatSaleDate(order.saleDate)}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className="uppercase">
                    {order.source}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {order.orderNumber ? `#${order.orderNumber}` : "Importacao CSV"}
                    </p>
                    {order.items.length > 0 && (
                      <p className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Package2 className="h-3.5 w-3.5" />
                        {order.items.length} item(ns)
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-slate-600 dark:text-slate-300">
                  {order.sellerName ?? "Nao vinculado"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="font-black text-slate-900 dark:text-white">
                    {formatCurrency(order.totalValue)}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>

        {history.data.length === 0 && (
          <div className="rounded-[1.35rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Nenhuma compra encontrada nesse filtro.
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Troque a origem acima para comparar o historico Bling com as importacoes Connect.
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
                  className="rounded-[1.35rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 dark:border-slate-800 dark:from-slate-950/80 dark:to-slate-900"
                >
                  <p className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                    <Eye className="h-4 w-4" />
                    Itens do pedido {order.orderNumber ? `#${order.orderNumber}` : order.id}
                  </p>
                  <div className="space-y-2">
                    {order.items.map((item) => (
                      <div
                        key={`${order.id}-${item.productId ?? item.description}`}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="text-slate-600 dark:text-slate-300">{item.description}</span>
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
            Leitura operacional das compras mais recentes para apoiar a proxima abordagem.
          </p>
          <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={onPreviousPage}
            disabled={history.offset === 0}
          >
            Anterior
          </Button>
          <Button variant="outline" onClick={onNextPage} disabled={!history.hasMore}>
            Proxima
          </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
