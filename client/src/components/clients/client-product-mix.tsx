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

interface ClientProductMixProps {
  productMix: ClientPurchaseInsightsResponse["productMix"];
  inactiveProducts: ClientPurchaseInsightsResponse["inactiveProducts"];
}

function formatDateLabel(date: string | null) {
  if (!date) return "-";
  try {
    return format(parseISO(`${date}T12:00:00`), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return date;
  }
}

export function ClientProductMix({
  productMix,
  inactiveProducts,
}: ClientProductMixProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-black text-slate-950 dark:text-white">
            Mix de produtos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-[1.35rem] border border-slate-200 dark:border-slate-800">
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
              {productMix.slice(0, 8).map((product) => (
                <TableRow key={`${product.productId ?? product.description}-${product.lastPurchaseDate ?? "none"}`}>
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
        </CardContent>
      </Card>

      <Card className="rounded-[1.75rem] border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-black text-slate-950 dark:text-white">
            Itens que sumiram do ciclo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {inactiveProducts.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhum item recorrente esta fora do ciclo esperado.
            </p>
          ) : (
            inactiveProducts.slice(0, 6).map((product) => (
              <div
                key={`${product.productId ?? product.description}-${product.lastPurchaseDate ?? "none"}`}
                className="rounded-[1.35rem] border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-4 dark:border-slate-800 dark:from-slate-950/80 dark:to-slate-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {product.description}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                    {product.orderCount} recompra(s) historicas
                  </p>
                  </div>
                  <Badge variant="secondary">{product.riskStatus}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Ultima compra em {formatDateLabel(product.lastPurchaseDate)}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Receita acumulada de {formatCurrency(product.totalValue)} nesse item.
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
