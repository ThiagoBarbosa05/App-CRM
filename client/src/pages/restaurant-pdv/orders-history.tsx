import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export default function RestaurantOrdersHistory() {
  const { data: orders = [] } = useQuery<RestaurantOrderWithPaymentsCount[]>({
    queryKey: ["/api/restaurant-pdv/orders"],
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
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
                    <Badge variant={order.status === "aberta" ? "default" : "outline"}>
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
                    {order.status === "fechada" && (
                      <OrderReceiptPrint orderId={order.id} label="Imprimir" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Nenhuma comanda registrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
