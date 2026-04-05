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
export function ClientProductMixTable({ productMix }: ClientProductMixTableProps) {
  return (
    <Card className="rounded-xl border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">
          Mix de produtos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Pedidos</TableHead>
                <TableHead>Ultima compra</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productMix.slice(0, 10).map((product) => (
                <TableRow
                  key={`${product.productId ?? product.description}-${product.lastPurchaseDate ?? "none"}`}
                >
                  <TableCell>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {product.description}
                      </p>
                      {product.productCode && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Cod. {product.productCode}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{product.orderCount}</TableCell>
                  <TableCell>{formatDateLabel(product.lastPurchaseDate)}</TableCell>
                  <TableCell className="text-right font-bold text-slate-900 dark:text-white">
                    {formatCurrency(product.totalValue)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {productMix.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Nenhum produto encontrado.
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
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
export function ClientInactiveProducts({ inactiveProducts }: ClientInactiveProductsProps) {
  return (
    <Card className="rounded-xl border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold uppercase tracking-wide text-slate-900 dark:text-white">
          Itens que sumiram do ciclo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {inactiveProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center dark:border-slate-800 dark:bg-slate-950/60">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Nenhum item recorrente esta fora do ciclo esperado.
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Produtos que deixaram de ser comprados aparecerão aqui.
            </p>
          </div>
        ) : (
          inactiveProducts.map((product) => (
            <div
              key={`${product.productId ?? product.description}-${product.lastPurchaseDate ?? "none"}`}
              className="relative overflow-hidden rounded-xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950/60"
            >
              <div className="absolute bottom-0 left-0 top-0 w-1 bg-rose-400" />
              <div className="flex items-center justify-between gap-2 pl-2">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {product.description}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-widest text-slate-400">
                    {product.orderCount} recompra(s) historicas
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className={
                    product.riskStatus === "abandonado"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                  }
                >
                  {product.riskStatus}
                </Badge>
              </div>
              <div className="mt-2 space-y-1 pl-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ultima compra em {formatDateLabel(product.lastPurchaseDate)}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Receita acumulada de {formatCurrency(product.totalValue)} nesse item.
                </p>
              </div>
            </div>
          ))
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
