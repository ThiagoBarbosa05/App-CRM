import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { PrintArea } from "./print-area";
import { Printer } from "lucide-react";
import type { RestaurantOrder, RestaurantOrderItem, RestaurantOrderPayment } from "@shared/schema";

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  dinheiro: "Dinheiro",
};

interface RestaurantOrderWithItems extends RestaurantOrder {
  items: RestaurantOrderItem[];
}

interface OrderReceiptPrintProps {
  orderId: string;
  label?: string;
}

export function OrderReceiptPrint({ orderId, label = "Imprimir" }: OrderReceiptPrintProps) {
  const { data: order } = useQuery<RestaurantOrderWithItems>({
    queryKey: ["/api/restaurant-pdv/orders", orderId],
  });

  const { data: payments = [] } = useQuery<RestaurantOrderPayment[]>({
    queryKey: ["/api/restaurant-pdv/orders", orderId, "payments"],
    queryFn: async () => {
      const res = await fetch(`/api/restaurant-pdv/orders/${orderId}/payments`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const printId = `order-receipt-print-${orderId}`;
  const items = order?.items ?? [];

  if (!order) {
    return (
      <Button size="sm" variant="outline" disabled>
        <Printer className="mr-1.5 h-3.5 w-3.5" />
        {label}
      </Button>
    );
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => window.print()}>
        <Printer className="mr-1.5 h-3.5 w-3.5" />
        {label}
      </Button>

      <PrintArea id={printId}>
        <div style={{ maxWidth: 380, margin: "0 auto", fontSize: 13 }}>
          <h2 style={{ textAlign: "center", marginBottom: 4 }}>PDV Restaurante</h2>
          <p style={{ textAlign: "center", marginBottom: 16 }}>
            Mesa {order.tableNumber} — {order.peopleCount} pessoa(s)
          </p>
          <hr />
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Item</th>
                <th style={{ textAlign: "center" }}>Qtd.</th>
                <th style={{ textAlign: "right" }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td style={{ textAlign: "center" }}>{item.quantity}</td>
                  <td style={{ textAlign: "right" }}>
                    {formatCurrency(Number(item.unitPrice) * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr style={{ marginTop: 8 }} />
          <div style={{ marginTop: 8 }}>
            {order.subtotal && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
            )}
            {(order.discountAmount || order.discountPercent) && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Desconto{order.discountReason ? ` (${order.discountReason})` : ""}</span>
                <span>
                  -
                  {formatCurrency(
                    order.discountAmount
                      ? order.discountAmount
                      : (Number(order.subtotal ?? 0) * Number(order.discountPercent ?? 0)) / 100,
                  )}
                </span>
              </div>
            )}
            {order.serviceFeeAmount && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Taxa de serviço ({order.serviceFeePercent}%)</span>
                <span>{formatCurrency(order.serviceFeeAmount)}</span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "bold",
                marginTop: 6,
              }}
            >
              <span>Total</span>
              <span>{order.total ? formatCurrency(order.total) : "—"}</span>
            </div>
          </div>
          {payments.length > 0 && (
            <>
              <hr style={{ marginTop: 8 }} />
              <div style={{ marginTop: 8 }}>
                <p style={{ fontWeight: "bold" }}>Pagamento{payments.length > 1 ? "s" : ""}</p>
                {payments.map((p) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>
                      {p.payerLabel ? `${p.payerLabel} — ` : ""}
                      {PAYMENT_METHOD_LABELS[p.method] ?? p.method}
                    </span>
                    <span>{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <p style={{ textAlign: "center", marginTop: 24, fontSize: 11 }}>
            Obrigado pela preferência!
          </p>
        </div>
      </PrintArea>
    </>
  );
}
