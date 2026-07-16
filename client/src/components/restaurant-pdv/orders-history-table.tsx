import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RestaurantOrder } from "@shared/schema";
import { OrderAuditLog } from "@/components/restaurant-pdv/order-audit-log";
import { OrderReceiptPrint } from "@/components/restaurant-pdv/order-receipt-print";

interface RestaurantOrderWithPaymentsCount extends RestaurantOrder {
  paymentsCount: number;
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  aberta: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400",
  fechada: "bg-slate-100 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300",
  mesclada: "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400",
};

interface OrdersHistoryTableProps {
  orders: RestaurantOrderWithPaymentsCount[];
  onContinueOrder: (orderId: string) => void;
}

export function OrdersHistoryTable({ orders, onContinueOrder }: OrdersHistoryTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Comandas</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mesa</TableHead>
              <TableHead>Pessoas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Aberta em</TableHead>
              <TableHead />
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>{order.tableNumber}</TableCell>
                <TableCell>{order.peopleCount}</TableCell>
                <TableCell>
                  <Badge className={STATUS_BADGE_CLASS[order.status] ?? ""} variant="outline">
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {order.paymentsCount > 1
                    ? `Dividido (${order.paymentsCount}x)`
                    : order.paymentMethod
                      ? PAYMENT_METHOD_LABELS[order.paymentMethod]
                      : "—"}
                </TableCell>
                <TableCell>{order.total ? formatCurrency(order.total) : "—"}</TableCell>
                <TableCell>
                  {new Date(order.openedAt).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                </TableCell>
                <TableCell>
                  <OrderAuditLog orderId={order.id} />
                </TableCell>
                <TableCell>
                  {order.status === "fechada" ? (
                    <OrderReceiptPrint orderId={order.id} label="Imprimir" />
                  ) : order.status === "aberta" ? (
                    <Button size="sm" variant="outline" onClick={() => onContinueOrder(order.id)}>
                      <ArrowUpRight className="mr-1.5 h-3.5 w-3.5" />
                      Continuar atendimento
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Nenhuma comanda encontrada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
