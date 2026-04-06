import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import type { ClientPurchaseInsightsResponse } from "@/hooks/use-client-purchase-insights";

interface ClientProductMixTableProps {
  productMix: ClientPurchaseInsightsResponse["productMix"];
}

interface ClientInactiveProductsProps {
  inactiveProducts: ClientPurchaseInsightsResponse["inactiveProducts"];
}

function formatDateLabel(date: string | null): string {
  if (!date) return "-";
  try {
    return format(parseISO(`${date}T12:00:00`), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return date;
  }
}

/**
 * Standalone product mix table for the "Top Produtos" sub-tab.
 */
export function ClientProductMixTable({
  productMix,
}: ClientProductMixTableProps) {
  const maxValue =
    productMix.length > 0
      ? Math.max(...productMix.map((p) => p.totalValue))
      : 1;

  return (
    <Card className="rounded-[24px] border-slate-200/80 bg-white shadow-[0_18px_40px_-36px_rgba(15,23,42,0.35)] dark:border-slate-800/80 dark:bg-slate-900">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Mix de produtos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-[20px] border border-slate-200/80 dark:border-slate-800/80">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 dark:bg-slate-800/50">
                <TableHead className="w-8 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  #
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Produto
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Pedidos
                </TableHead>
                <TableHead className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Ultima compra
                </TableHead>
                <TableHead className="text-right text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Valor
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productMix.slice(0, 10).map((product, index) => (
                <TableRow
                  key={`${product.productId ?? product.description}-${product.lastPurchaseDate ?? "none"}`}
                  className="transition-colors hover:bg-amber-50/40 dark:hover:bg-amber-900/10"
                >
                  <TableCell>
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold ${
                        index === 0
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                          : index === 1
                            ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                            : index === 2
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
                              : "text-slate-400"
                      }`}
                    >
                      {index + 1}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {product.description}
                      </p>
                      {product.productCode && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                          Cod. {product.productCode}
                        </p>
                      )}
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-amber-400"
                          style={{
                            width: `${Math.round((product.totalValue / maxValue) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                    {product.orderCount}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                    {formatDateLabel(product.lastPurchaseDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-bold tabular-nums text-slate-900 dark:text-white">
                      {formatCurrency(product.totalValue)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {productMix.length === 0 && (
          <div className="rounded-[20px] border border-dashed border-slate-200/80 bg-slate-50/50 px-4 py-10 text-center dark:border-slate-800 dark:bg-slate-950/40">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Nenhum produto encontrado.
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              O mix de produtos sera exibido apos as primeiras compras.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Standalone inactive products list for the "Parou de Comprar" sub-tab.
 */
export function ClientInactiveProducts({
  inactiveProducts,
}: ClientInactiveProductsProps) {
  return (
    <Card className="rounded-[24px] border-slate-200/80 bg-white shadow-[0_18px_40px_-36px_rgba(15,23,42,0.35)] dark:border-slate-800/80 dark:bg-slate-900">
      <CardHeader className="pb-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          Itens que sumiram do ciclo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {inactiveProducts.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-slate-200/80 bg-slate-50/50 px-4 py-10 text-center dark:border-slate-800 dark:bg-slate-950/40">
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Nenhum item recorrente esta fora do ciclo esperado.
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Produtos que deixaram de ser comprados aparecerão aqui.
            </p>
          </div>
        ) : (
          inactiveProducts.map((product) => {
            const isAbandoned = product.riskStatus === "abandonado";
            return (
              <div
                key={`${product.productId ?? product.description}-${product.lastPurchaseDate ?? "none"}`}
                className={`relative overflow-hidden rounded-[20px] border bg-white px-4 py-4 dark:bg-slate-950/60 ${
                  isAbandoned
                    ? "border-rose-200/60 dark:border-rose-800/30"
                    : "border-amber-200/60 dark:border-amber-800/30"
                }`}
              >
                <div
                  className={`absolute bottom-0 left-0 top-0 w-[3px] ${
                    isAbandoned
                      ? "bg-gradient-to-b from-rose-300 to-rose-500"
                      : "bg-gradient-to-b from-amber-300 to-amber-500"
                  }`}
                />
                <div className="flex items-start justify-between gap-2 pl-3">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                      {product.description}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                      {product.orderCount} recompra(s) historicas
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`border-0 text-[10px] font-semibold uppercase ${
                      isAbandoned
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                    }`}
                  >
                    {product.riskStatus}
                  </Badge>
                </div>
                <div className="mt-2 space-y-0.5 pl-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ultima compra em {formatDateLabel(product.lastPurchaseDate)}
                  </p>
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    Receita acumulada de{" "}
                    <span className="font-bold">
                      {formatCurrency(product.totalValue)}
                    </span>
                  </p>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Combined view (legacy) for backward compatibility.
 */
export function ClientProductMix({
  productMix,
  inactiveProducts,
}: {
  productMix: ClientPurchaseInsightsResponse["productMix"];
  inactiveProducts: ClientPurchaseInsightsResponse["inactiveProducts"];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
      <ClientProductMixTable productMix={productMix} />
      <ClientInactiveProducts inactiveProducts={inactiveProducts} />
    </div>
  );
}
