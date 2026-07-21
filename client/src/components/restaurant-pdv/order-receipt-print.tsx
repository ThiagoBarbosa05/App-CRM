import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { PrintArea, printArea } from "./print-area";
import { Printer } from "lucide-react";
import { calculateOrderTotals, formatPercent } from "@shared/restaurant-order-totals";
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

/** Agrupa itens pelo nome+preço, somando quantidades e unindo observações únicas. */
function groupItems(items: RestaurantOrderItem[]): {
  name: string;
  quantity: number;
  unitPrice: string;
  notes: string;
}[] {
  const map = new Map<string, { name: string; quantity: number; unitPrice: string; notes: Set<string> }>();
  for (const item of items) {
    const key = `${item.name}||${item.unitPrice}`;
    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      if (item.notes) existing.notes.add(item.notes);
    } else {
      map.set(key, {
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        notes: new Set(item.notes ? [item.notes] : []),
      });
    }
  }
  return Array.from(map.values()).map((g) => ({
    name: g.name,
    quantity: g.quantity,
    unitPrice: g.unitPrice,
    notes: Array.from(g.notes).join(" / "),
  }));
}

/**
 * Imprime a pré-conta diretamente, sem botão.
 * Chame após confirmar "PEDIR A CONTA" ou qualquer outro gatilho programático.
 */
export function printBillNow(
  order: RestaurantOrder,
  items: RestaurantOrderItem[],
  opts?: { serviceFeePercent?: string | number; discountAmount?: string | number; discountPercent?: string | number },
): void {
  const printId = "auto-bill-print";

  const computed = calculateOrderTotals({
    items,
    serviceFeePercent: opts?.serviceFeePercent ?? order.serviceFeePercent,
    discountAmount: opts?.discountAmount ?? order.discountAmount,
    discountPercent: opts?.discountPercent ?? order.discountPercent,
  });

  const subtotal = computed.subtotal;
  const discountAmount = computed.discountAmount;
  const serviceFee = computed.serviceFee;
  const total = computed.total;
  const serviceFeePercent = Number(order.serviceFeePercent ?? computed.serviceFeePercent);
  const hasDiscount = discountAmount > 0;
  const grouped = groupItems(items);

  const now = new Date().toLocaleString("pt-BR");

  const rows = grouped
    .map(
      (g) => `
      <tr>
        <td>${g.name}${g.notes ? `<div style="font-size:11px;font-style:italic">obs: ${g.notes}</div>` : ""}</td>
        <td style="text-align:center;vertical-align:top">${g.quantity}</td>
        <td style="text-align:right;vertical-align:top">${formatCurrency(Number(g.unitPrice) * g.quantity)}</td>
      </tr>`,
    )
    .join("");

  const html = `
    <div style="max-width:380px;margin:0 auto;font-size:13px;font-family:monospace">
      <h2 style="text-align:center;margin-bottom:4px">PDV Restaurante — Pré-Conta</h2>
      <p style="text-align:center;margin-bottom:4px">Mesa ${order.tableNumber} · ${order.peopleCount} pessoa(s)</p>
      <p style="text-align:center;font-size:11px;margin-bottom:12px">${now}</p>
      <hr/>
      <table style="width:100%;border-collapse:collapse;margin-top:8px">
        <thead>
          <tr>
            <th style="text-align:left">Item</th>
            <th style="text-align:center">Qtd.</th>
            <th style="text-align:right">Valor</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <hr style="margin-top:8px"/>
      <div style="margin-top:8px">
        <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
        ${hasDiscount ? `<div style="display:flex;justify-content:space-between"><span>Desconto${order.discountReason ? ` (${order.discountReason})` : ""}</span><span>-${formatCurrency(discountAmount)}</span></div>` : ""}
        <div style="display:flex;justify-content:space-between"><span>Taxa de serviço (${formatPercent(serviceFeePercent)})</span><span>${formatCurrency(serviceFee)}</span></div>
        <div style="display:flex;justify-content:space-between;font-weight:bold;margin-top:6px"><span>TOTAL</span><span>${formatCurrency(total)}</span></div>
      </div>
      <p style="text-align:center;margin-top:24px;font-size:11px">Obrigado pela preferência!</p>
    </div>`;

  // Reutiliza ou cria o nó de impressão
  let el = document.getElementById(printId);
  if (!el) {
    el = document.createElement("div");
    el.id = printId;

    // Estilo de tela: invisível; de impressão: visível quando ativo
    const style = document.createElement("style");
    style.textContent = `
      @media screen { #${printId} { display: none; } }
      @media print {
        body.printing-${printId} > *:not(#${printId}) { display: none !important; }
        body.printing-${printId} #${printId} { display: block !important; padding: 24px; font-family: monospace; color: #000; background: #fff; }
        body:not(.printing-${printId}) #${printId} { display: none !important; }
      }`;
    document.head.appendChild(style);
    document.body.appendChild(el);
  }

  el.innerHTML = html;
  printArea(printId);
}

/* ─────────────────────────────────────────────────────────────────────────── */

interface OrderReceiptPrintProps {
  orderId: string;
  label?: string;
}

/** Botão que imprime a conta de uma comanda (usável em qualquer lugar). */
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

  const computed = calculateOrderTotals({
    items,
    serviceFeePercent: order?.serviceFeePercent,
    discountAmount: order?.discountAmount,
    discountPercent: order?.discountPercent,
  });
  const isClosed = !!order?.total;
  const subtotal = isClosed ? Number(order!.subtotal ?? 0) : computed.subtotal;
  const discountAmount = computed.discountAmount;
  const serviceFee = isClosed ? Number(order!.serviceFeeAmount ?? 0) : computed.serviceFee;
  const total = isClosed ? Number(order!.total) : computed.total;
  const serviceFeePercent = Number(order?.serviceFeePercent ?? computed.serviceFeePercent);
  const hasDiscount = discountAmount > 0;

  const grouped = groupItems(items);

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
      <Button size="sm" variant="outline" onClick={() => printArea(printId)}>
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
              {grouped.map((item, i) => (
                <tr key={i}>
                  <td>
                    {item.name}
                    {item.notes && (
                      <div style={{ fontSize: 11, fontStyle: "italic" }}>obs: {item.notes}</div>
                    )}
                  </td>
                  <td style={{ textAlign: "center", verticalAlign: "top" }}>{item.quantity}</td>
                  <td style={{ textAlign: "right", verticalAlign: "top" }}>
                    {formatCurrency(Number(item.unitPrice) * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr style={{ marginTop: 8 }} />
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {hasDiscount && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Desconto{order.discountReason ? ` (${order.discountReason})` : ""}</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Taxa de serviço ({formatPercent(serviceFeePercent)})</span>
              <span>{formatCurrency(serviceFee)}</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "bold",
                marginTop: 6,
              }}
            >
              <span>Total</span>
              <span>{formatCurrency(total)}</span>
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
