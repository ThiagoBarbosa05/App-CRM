import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { extractApiMessage } from "@/lib/api-error";
import { getPdvCurrentUnitId } from "@/lib/pdv-unit";
import { saoPauloRange } from "@shared/sao-paulo-date";
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
import { AlertCircle } from "lucide-react";
import { OrderDetailSheet } from "@/components/restaurant-pdv/order-detail-sheet";
import type { RestaurantOrder } from "@shared/schema";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
  outros: "Outros",
};

type ClosedOrder = RestaurantOrder & {
  paymentsCount: number;
  waiterName: string | null;
};

const PAGE_SIZE = 20;

/**
 * Comandas fechadas do período do relatório, com drill-down no detalhe.
 *
 * `dateField=closed` é essencial: o relatório agrega por `closedAt`, então
 * recortar por abertura (o default do histórico) faria esta lista divergir
 * do card "Nº de Comandas" logo acima.
 */
export function ClosedOrdersSection({ from, to }: { from: string; to: string }) {
  const [page, setPage] = useState(0);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const unitId = getPdvCurrentUnitId();

  const { data, isLoading, isError, error, refetch } = useQuery<ClosedOrder[]>({
    queryKey: [
      "/api/restaurant-pdv/orders",
      { status: "fechada", dateField: "closed", from, to, unitId },
    ],
    queryFn: async () => {
      // O endpoint /orders faz `new Date(from)` cru: mandar "YYYY-MM-DD" viraria
      // meia-noite UTC (21h do dia anterior em SP) e cortaria o fim do último
      // dia. Converter para a mesma janela civil de SP usada pelo relatório
      // mantém esta lista igual ao card "Nº de Comandas".
      const range = saoPauloRange(from, to);
      const res = await apiRequest(
        "GET",
        `/api/restaurant-pdv/orders?status=fechada&dateField=closed&from=${encodeURIComponent(range.from.toISOString())}&to=${encodeURIComponent(range.to.toISOString())}`,
      );
      return (await res.json()) as ClosedOrder[];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-destructive">Não foi possível carregar</p>
          <p className="text-sm text-muted-foreground">{extractApiMessage(error)}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  const orders = data ?? [];
  const pageCount = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageOrders = orders.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nº</TableHead>
            <TableHead>Mesa</TableHead>
            <TableHead>Garçom</TableHead>
            <TableHead>Fechada em</TableHead>
            <TableHead>Pagamento</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageOrders.map((order) => (
            <TableRow
              key={order.id}
              className="cursor-pointer"
              onClick={() => setSelectedOrderId(order.id)}
            >
              <TableCell className="font-medium">#{order.orderNumber}</TableCell>
              <TableCell>{order.tableNumber}</TableCell>
              <TableCell>{order.waiterName ?? "—"}</TableCell>
              <TableCell className="tabular-nums">
                {order.closedAt
                  ? new Date(order.closedAt).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : "—"}
              </TableCell>
              <TableCell>
                {order.paymentsCount > 1
                  ? `${order.paymentsCount} pagamentos`
                  : order.paymentMethod
                    ? (PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod)
                    : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(order.total)}
              </TableCell>
            </TableRow>
          ))}
          {orders.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Nenhuma comanda fechada no período
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {pageCount > 1 && (
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {orders.length} comanda(s) · página {currentPage + 1} de {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
            >
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage(currentPage + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <OrderDetailSheet
        orderId={selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
      />
    </div>
  );
}
