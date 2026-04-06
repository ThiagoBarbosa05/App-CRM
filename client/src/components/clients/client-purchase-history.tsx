import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Package2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatCurrency } from "@/lib/utils";
import type { ClientPurchaseInsightsResponse } from "@/hooks/use-client-purchase-insights";

interface ClientPurchaseHistoryProps {
  history: ClientPurchaseInsightsResponse["purchaseHistory"];
  onPreviousPage: () => void;
  onNextPage: () => void;
}

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
  onPreviousPage,
  onNextPage,
}: ClientPurchaseHistoryProps) {
  return (
    <Card className="rounded-[24px] border-slate-200/80 bg-white shadow-[0_18px_40px_-36px_rgba(15,23,42,0.35)] dark:border-slate-800/80 dark:bg-slate-900">
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
        {history.data.length > 0 && (
          <div className="overflow-hidden rounded-[20px] border border-slate-200/80 bg-slate-50/40 dark:border-slate-800/80 dark:bg-slate-950/30">
            <Accordion type="multiple" className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
              {history.data.map((order) => (
                <AccordionItem
                  key={`${order.source}-${order.id}`}
                  value={`${order.source}-${order.id}`}
                  className="border-b-0 px-4"
                >
                  <AccordionTrigger className="gap-4 py-4 text-left hover:no-underline">
                    <div className="grid flex-1 gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] md:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {order.orderNumber
                              ? `Pedido #${order.orderNumber}`
                              : "Importacao CSV"}
                          </p>
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
                        </div>
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                          <Package2 className="h-3 w-3" />
                          {order.items.length} item(ns)
                        </p>
                      </div>
                      <div className="grid gap-1 text-sm text-slate-500 dark:text-slate-400 sm:grid-cols-2 md:grid-cols-1">
                        <span>{formatSaleDate(order.saleDate)}</span>
                        <span>
                          {order.sellerName ?? "Nao vinculado"}
                        </span>
                      </div>
                      <div className="text-left md:text-right">
                        <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                          {formatCurrency(order.totalValue)}
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="grid gap-4 rounded-[18px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/70 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/70">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Pedido
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                            {order.orderNumber
                              ? `#${order.orderNumber}`
                              : order.id}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/70">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Data da compra
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                            {formatSaleDate(order.saleDate)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/70">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Vendedor
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                            {order.sellerName ?? "Nao vinculado"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/70">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Valor total
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                            {formatCurrency(order.totalValue)}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-950/70">
                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Itens da compra
                        </p>
                        {order.items.length > 0 ? (
                          <div className="space-y-2">
                            {order.items.map((item) => (
                              <div
                                key={`${order.id}-${item.productId ?? item.description}`}
                                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
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
                        ) : (
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Nenhum item detalhado disponivel para esta compra.
                          </p>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        )}

        {history.data.length === 0 && (
          <div className="rounded-[20px] border border-dashed border-slate-200/80 bg-slate-50/50 px-4 py-10 text-center dark:border-slate-800 dark:bg-slate-950/40">
            <Package2 className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Nenhuma compra encontrada.
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Assim que houver pedidos vinculados ao cliente, eles aparecerao
              listados aqui.
            </p>
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
              className="rounded-xl"
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNextPage}
              disabled={!history.hasMore}
              className="rounded-xl"
            >
              Proxima
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
